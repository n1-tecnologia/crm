---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 12
subsystem: api-persistencia, e2e, docs
tags: [migracoes, seco, dry-run, d-12, e2e, app-inject, postgres-local, context-md, d-03, d-15, vitest, fastify]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-01..07-11: rotasDeCrm sobre servicos/repositorios reais, buildApp({ crm }), testes/banco-crm.ts (describeComBanco, prepararBancoCrm, novoEspacoDeTeste, limparEspaco, semearMembro), os 409 ricos (CONTATO_BLOQUEADO, FUNIL_PADRAO, FUNIL_COM_NEGOCIOS, NEGOCIO_EXIGE_VALOR), podeNoCrm (D-14), src/dados/crm/ no web; 07-05: a 007 commitada com o trigger corrigido (D-12)"
provides:
  - "apps/api/src/persistencia/migrar.ts: migracoesPendentes(cliente = pool()) -> { aplicadas, pendentes } por leitura pura (to_regclass + select nome), sem criar schema nem tabela; EstadoDasMigracoes; migrar() le a pasta pelo mesmo arquivosDeMigracao()"
  - "apps/api/src/persistencia/migrar.cli.ts: npm run migrar -w @n1/api -- --seco imprime 'aplicada  <nome>' / 'pendente  <nome>' por arquivo em ordem e 'N pendente(s); nada foi aplicado (--seco).' (a conferencia de D-12 que 07-13 roda antes do primeiro migrar com a 007)"
  - "apps/api/src/persistencia/migrar-seco.test.ts: (a) banco vazio proprio sem o schema plataforma nascer, (b) tudo aplicado depois de migrar(), (c) o CLI --seco com a contagem de plataforma.migracoes igual antes e depois"
  - "apps/api/src/e2e/crm-fluxo.test.ts: o CRM inteiro por app.inject contra Postgres local — Funil padrao (D-13) -> Contato -> Empresa com admin (D-08) -> Negocio -> mover -> ganhar com a Regra do Funil (D-05) -> reabrir 403/200 por Papel (D-14) -> lixeira de Contato bloqueada (D-09) -> lixeira de Funil bloqueada (FUNIL_PADRAO, FUNIL_COM_NEGOCIOS) e resolvida por migracao (D-07) -> isolamento de Espaco (D-10)"
  - "CONTEXT.md (raiz), apps/api/CONTEXT.md, apps/api/src/rotas/CONTEXT.md, apps/api/src/servicos/CONTEXT.md, packages/dominio/CONTEXT.md e apps/web/CONTEXT.md documentando o CRM da Fase 7, as fronteiras novas e a limitacao de D-15"
  - ".planning/phases/07-.../deferred-items.md com as duas falhas pre-existentes do portao npm run check"
affects: [07-13, unificacao-do-crm, financeiro]

actuals:
  tokens: 11129
  tasks: 2
  commits: 3
plan_head_before: f1e876226432ffecf9bdd47f259a23a4a6ff900b
plan_head_after: 574ad31afbf5d8ca5116a139455f6ed7a466e9a4
commits: 3

tech-stack:
  added: []
  patterns:
    - "Leitura seca de migracoes: to_regclass('plataforma.migracoes') decide se a tabela de controle existe; so entao 'select nome'; nenhum 'create' no caminho — o mesmo arquivosDeMigracao() que migrar() usa garante a mesma ordem"
    - "Teste de banco vazio: 'create database seco_<8>' no container pelo pool() padrao, um new Pool apontado para ele (urlDoBanco troca so o pathname da DATABASE_URL), e 'drop database' no finally — o banco padrao do container ja pode ter sido migrado por outro arquivo da mesma execucao"
    - "CLI sob teste por execFileSync('npx', ['vite-node', ...], { cwd: apps/api, env: { ...process.env } }): a DATABASE_URL do teste vence o .env porque carregarEnv so preenche o que falta"
    - "E2E do CRM: um buildApp() por Espaco (o workspaceId e configuracao do servidor), SESSOES token -> { sub, membroId } e resolverMembro devolvendo o Membro do seed com id trocado; semearMembro grava members -> roles que o servico le"
    - "RED do classificador: a primeira assercao do alvo e um toBe de string (uma linha) — assercao de array/objeto gera YAML multilinha no TAP e o classificador devolve invalid_record ('Non-TAP data')"

key-files:
  created:
    - apps/api/src/persistencia/migrar-seco.test.ts
    - apps/api/src/e2e/crm-fluxo.test.ts
    - .planning/phases/07-crm-contatos-empresas-funis-e-negocios/deferred-items.md
  modified:
    - apps/api/src/persistencia/migrar.ts
    - apps/api/src/persistencia/migrar.cli.ts
    - CONTEXT.md
    - apps/api/CONTEXT.md
    - apps/api/src/rotas/CONTEXT.md
    - apps/api/src/servicos/CONTEXT.md
    - packages/dominio/CONTEXT.md
    - apps/web/CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "migracoesPendentes devolve { aplicadas, pendentes } (a assinatura do plano) e o CLI reconstroi a ordem dos arquivos com [...aplicadas, ...pendentes].sort() — a mesma ordenacao lexicografica de migrar(); nao foi acrescentado um terceiro campo com a ordem"
  - "O alvo RED do classificador foi o caso (c) do CLI (uma assercao de string na ultima linha de saida), nao (a)/(b): com migracoesPendentes ausente, (a)/(b) falham por TypeError (nao e assercao); (c) falha na assercao planejada porque o CLI de antes ignora --seco e imprime 'Nada a aplicar'"
  - "crm-fluxo.test.ts entrou no commit RED (test(07-12)) ja verde: e um cenario sobre comportamento entregue em 07-01..07-11, nao um comportamento novo — nao pode ser vermelho por desenho; o ajuste unico durante o RED foi do proprio teste (a lista GET /funis devolve FunilResumo { funil, totalEtapas, negociosAbertos }, nao Funil)"
  - "O e2e prova tambem o inverso do isolamento: a sessao do Espaco B chegando no app do Espaco A recebe 403 PERMISSAO — o servico le members -> roles DESTE Espaco (D-14), mesmo que a resolucao de sessao fosse frouxa"
  - "npm run check sai 1 por duas falhas pre-existentes fora do CRM (lote-contas-a-pagar 5/6, ja em STATE.md; e a suite de formularios-publicos.test.ts com seed 'Centro de Custo (Financeiro) aponta para um Campo que esta Lista nao tem', untouched desde 05-17) — reproduzidas isoladas no checkout, registradas em deferred-items.md e no WINDOWS.md (#5), nao corrigidas (fora de escopo); todo o resto do portao esta verde de verdade"
  - "A documentacao de D-15 em apps/web/CONTEXT.md nomeia as cinco superficies (Busca global, Lixeira, Notificacoes, /crm/meus-negocios, Caixa de Entrada) e o recuo das tres fichas para a tela antiga, como o plano pede; a verificacao foi grep no codigo (buscar/page.tsx, lixeira/page.tsx e meus-negocios/page.tsx leem useData do DataState)"
  - "Commits em main por decisao do orquestrador (branching_strategy: none), como em 07-01..07-11"

patterns-established:
  - "Conferencia seca antes de migrar: npm run migrar -w @n1/api -- --seco e o passo documentado nos CONTEXT.md da raiz e de apps/api antes de qualquer migrar com migracao nova"
  - "Cenario e2e do CRM em src/e2e/ com describeComBanco: o criterio da fase num arquivo so, it's sequenciais compartilhando ids, afterAll com limparEspaco dos Espacos e encerrar()"

requirements-completed: [CRM-V1, CRM-A1, CRM-W1]

duration: 21 min
completed: 2026-10-11
status: complete

coverage:
  - id: D1
    description: "migracoesPendentes() e leitura pura: num banco vazio todos os arquivos saem pendentes e o schema plataforma nao nasce; depois de migrar() tudo aplicado"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/migrar-seco.test.ts#(a) num banco vazio, todos os arquivos saem como pendentes e o schema plataforma NÃO é criado"
        status: pass
      - kind: integration
        ref: "apps/api/src/persistencia/migrar-seco.test.ts#(b) depois de migrar(), todos os arquivos saem como aplicados e nenhum pendente"
        status: pass
      - kind: other
        ref: "awk '/export async function migracoesPendentes/,/^}/' apps/api/src/persistencia/migrar.ts | grep -ci 'create ' -> 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "migrar --seco imprime uma linha por arquivo em ordem e a linha final, e nao aplica nada (contagem de plataforma.migracoes igual antes e depois); contra um banco vazio imprime 7 pendentes"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/migrar-seco.test.ts#(c) migrar.cli.ts --seco imprime uma linha por arquivo, na ordem, e não aplica nada"
        status: pass
      - kind: manual_procedural
        ref: "DATABASE_URL=postgres://postgres:x@localhost:55482/seco_manual npx vite-node src/persistencia/migrar.cli.ts --seco -> 7 linhas 'pendente', '7 pendente(s); nada foi aplicado (--seco).', pg_namespace sem 'plataforma'"
        status: pass
    human_judgment: false
  - id: D3
    description: "O CRM inteiro por HTTP contra Postgres local: Funil padrao, Contato, Empresa com admin, Negocio no padrao, mover, ganhar com a Regra do Funil, reabrir por Papel, lixeira de Contato e de Funil bloqueadas e resolvidas, isolamento de Espaco — sem nenhum teste pulado"
    requirement: CRM-V1
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/crm-fluxo.test.ts (8 casos d1-d4, e1-e3, f)"
        status: pass
      - kind: integration
        ref: "cd apps/api && TZ=America/Sao_Paulo DATABASE_URL=postgres://postgres:x@localhost:55482/postgres npx vitest run src/rotas/crm src/servicos/crm src/repositorios/crm src/persistencia/migrar-seco.test.ts src/e2e/crm-fluxo.test.ts -> 12 arquivos, 159 testes, 0 pulados"
        status: pass
    human_judgment: false
  - id: D4
    description: "Portao da fase: tipos, lint, tokens, contratos, testes dos tres workspaces e npm run build (com as rotas /crm/*)"
    requirement: CRM-V1
    verification:
      - kind: other
        ref: "npm run check -> typecheck 3/3 ok, lint 0 erros (3 avisos pre-existentes), tokens 445/0 falhas, contratos ok, web 507/507, dominio 1667/1667, api 1149 verdes + 5 falhas e 1 suite pre-existentes fora do CRM (deferred-items.md)"
        status: fail
      - kind: other
        ref: "npm run build -> exit 0; rotas /crm/contatos, /crm/contatos/[contato], /crm/empresas, /crm/empresas/[empresa], /crm/funis, /crm/funis/[funil], /crm/negocios, /crm/negocios/[negocio]"
        status: pass
    human_judgment: true
    rationale: "npm run check sai 1 por duas falhas pre-existentes do Financeiro contra o banco remoto (lote-contas-a-pagar.test.ts 5/6, ja em STATE.md; seed de formularios-publicos.test.ts), reproduzidas isoladas e nao desta fase; o dono decide se aceita o portao com essa ressalva ou se as corrige antes de 07-13"
  - id: D5
    description: "Os seis CONTEXT.md documentam o CRM da Fase 7: D-03/D-01 por camada, a segunda fronteira src/dados/crm/, CRM filtrado no servidor, --seco, e a limitacao de D-15"
    requirement: CRM-W1
    verification:
      - kind: other
        ref: "grep -c dados/crm apps/web/CONTEXT.md -> 2; grep -c crm/ packages/dominio/CONTEXT.md -> 4; grep -c rotas/crm apps/api/src/rotas/CONTEXT.md -> 1; grep -c meus-negocios apps/web/CONTEXT.md -> 1; grep -c 'Fase 7' CONTEXT.md -> 1; grep -c comTransacao apps/api/src/servicos/CONTEXT.md -> 1"
        status: pass
    human_judgment: true
    rationale: "A exatidao e a voz da prosa (pt-BR, estrutura de cada CONTEXT.md) sao julgamento do dono; os greps so provam a presenca dos termos"
---

# Phase 7 Plan 12: `migrar --seco`, o fluxo ponta a ponta do CRM e a documentação das três camadas Summary

**`migracoesPendentes()` + `npm run migrar -- --seco` provados como leitura pura (nem o schema nasce num banco vazio), o CRM inteiro percorrido por `app.inject` contra Postgres local em 8 casos sem nenhum pulado (159/159 na suíte de banco do CRM), e os seis `CONTEXT.md` com o CRM da Fase 7 — o portão `npm run check` fica verde em tudo, salvo duas falhas pré-existentes do Financeiro contra o banco remoto, reproduzidas e registradas em `deferred-items.md`.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-10-10T23:46:58Z
- **Completed:** 2026-10-11T00:08:40Z
- **Tasks:** 2
- **Files modified:** 11 (3 criados, 8 modificados; +651/-12)

## Accomplishments

- **A conferência seca de D-12 existe.** `migracoesPendentes(cliente = pool())` em `apps/api/src/persistencia/migrar.ts` lê a pasta na mesma ordem de `migrar()`, pergunta `to_regclass('plataforma.migracoes')` e só então lê a tabela — nunca `create`. O teste (a) cria um banco `seco_<8>` só para o caso e prova que, depois da leitura, `pg_namespace` não tem `plataforma`. `migrar.cli.ts --seco` imprime `aplicada  <nome>` / `pendente  <nome>` por arquivo e `N pendente(s); nada foi aplicado (--seco).`; o teste (c) roda o CLI de verdade por `execFileSync` e confere que a contagem de `plataforma.migracoes` não muda. Contra um banco vazio, à mão: 7 `pendente`, schema ausente.
- **O CRM inteiro passa por um teste ponta a ponta pelo HTTP** (`apps/api/src/e2e/crm-fluxo.test.ts`, `describeComBanco`, serviços e acesso reais): Administrador cria "Vendas" (nasce padrão, D-13; Membro recebe 403 ao tentar); Membro cria "Ana" (e-mail normalizado para `ana@alfa.com.br`) e "Alfa" com a Ana como admin (D-08); Negócio sem Funil cai em Vendas/Novo; mover para Proposta (50%); ganhar sem valor → 409 `NEGOCIO_EXIGE_VALOR` (D-05), com valor → `ganho`; reabrir → 403 `PERMISSAO` para o Membro e `aberto` para o Administrador (D-14); `DELETE /contatos/<Ana>` → 409 `CONTATO_BLOQUEADO` com Alfa em `bloqueios.empresas` e o Negócio em `bloqueios.negocios` (D-09); `DELETE /funis/<Vendas>` → 409 `FUNIL_PADRAO`, depois de "Pós-venda" virar padrão → 409 `FUNIL_COM_NEGOCIOS` com `total: 1`, depois de `migrar-negocios` → 200 `na_lixeira` (D-07); o Membro do Espaço B recebe 404 no Negócio, lista vazia de Contatos, e 403 se a sessão dele chegar ao Espaço A (D-10).
- **As três camadas documentam o CRM novo e as suas fronteiras**: raiz (`CONTEXT.md`, "Estado atual" com a Fase 7 e o `--seco`), `apps/api` (rotas/serviços/repositórios/testes/e2e do CRM na tabela e o `--seco` em "O que sai"), `rotas/` (envelope, 400/403/404/409, a divergência deliberada de `/operacoes`, Pitfall 4), `servicos/` (`comTransacao` com o `commit` dentro do `try`, pré-checagem dos 409 ricos com SQLSTATE como rede, `exigir`/`podeNoCrm`, `resolverProprietario`), `packages/dominio` ("CRM relacional (Fase 7)": `src/crm/*` sem barril, regras puras dos dois lados, modelo inglês intacto) e `apps/web` (a segunda fronteira `src/dados/crm/` por `chamarCrm` + SWR com invalidação por prefixo, o CRM filtrado no servidor, e a limitação de D-15 com as cinco superfícies e o recuo das fichas).
- **Portão:** `npm run build` verde com as oito rotas `/crm/*`; `npm run check` verde em tipos (3 workspaces), lint (0 erros, 3 avisos pré-existentes), tokens, contratos, `@n1/web` 507/507, `@n1/dominio` 1667/1667 e 1149 testes da api — menos as duas falhas pré-existentes abaixo.

## Task Commits

Each task was committed atomically:

1. **Task 1: `migrar --seco` (D-12) e o fluxo ponta a ponta do CRM por HTTP** — `fedacfd` (test, RED) → `8e910a5` (feat, GREEN); sem REFACTOR (nada a limpar: a suíte de banco do CRM inteira ficou 159/159 sem pulados)
2. **Task 2: Documentação das três camadas e o portão verde da fase** — `574ad31` (docs)

**Plan metadata:** ver o commit `docs(07-12): complete ...` (SUMMARY, STATE, ROADMAP, REQUIREMENTS, WINDOWS).

## TDD Gate Compliance

| Gate | Commit | Evidência |
|------|--------|-----------|
| RED | `fedacfd` | Alvo `(c) migrar.cli.ts --seco imprime uma linha por arquivo, na ordem, e não aplica nada` rodado isolado (`-t "migrar.cli.ts --seco imprime uma linha por arquivo"`, `--reporter=tap`, exit 1): `AssertionError: expected 'Nada a aplicar: o banco já está em di…' to be '0 pendente(s); nada foi aplicado (--s…'`. `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`, `report_errors: []`). Semântica: o alvo executou e falhou na asserção planejada pelo motivo certo (o CLI de antes ignora `--seco`). (a)/(b) no run completo falhavam com `migracoesPendentes is not a function` (a função ausente). O registro ficou em `.planning/red-tmp/` e foi apagado antes do commit. |
| GREEN | `8e910a5` | 11/11 nos dois arquivos; `tsc --noEmit` limpo; acceptance greps (1, 3, `create `=0). |
| REFACTOR | — | Não houve mudança a commitar. |

**Observação sobre o classificador:** a primeira tentativa, com a asserção de array primeiro, foi recusada como `invalid_record` ("Non-TAP data in report") porque o `actual`/`expected` multilinha do YAML quebra o parser; reordenar as asserções de (c) para começar pelo `toBe` da última linha (uma linha de string) deu o `RED_EVIDENCE_OK`. Mesmo padrão já anotado por executores anteriores.

## Files Created/Modified

- `apps/api/src/persistencia/migrar.ts` — `EstadoDasMigracoes`, `arquivosDeMigracao()`, `migracoesPendentes(cliente = pool())`; `migrar()` lê a pasta pela mesma função.
- `apps/api/src/persistencia/migrar.cli.ts` — a flag `--seco`; sem ela, o comportamento de antes.
- `apps/api/src/persistencia/migrar-seco.test.ts` — (a) banco vazio próprio, (b) tudo aplicado, (c) CLI por `execFileSync`.
- `apps/api/src/e2e/crm-fluxo.test.ts` — o cenário da fase em 8 `it`s sequenciais, dois Espaços, dois `buildApp()`.
- `CONTEXT.md`, `apps/api/CONTEXT.md`, `apps/api/src/rotas/CONTEXT.md`, `apps/api/src/servicos/CONTEXT.md`, `packages/dominio/CONTEXT.md`, `apps/web/CONTEXT.md` — as seções descritas acima.
- `.planning/phases/07-.../deferred-items.md` — as duas falhas pré-existentes do portão, com os nomes exatos dos testes.
- `.planning/WINDOWS.md` — entrada #5 (`deviation`): `npm run check` não verde por falhas fora do CRM.

## Decisions Made

Ver `key-decisions` no frontmatter. As que pesam para 07-13: o `--seco` é o comando a rodar contra o banco da plataforma antes do `migrar` com a 007 (lê, não escreve — provado nos casos (a) e (c) e à mão contra um banco vazio); e o portão da fase carrega a ressalva das duas falhas pré-existentes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Asserção do meu próprio e2e sobre a forma de `GET /funis`**
- **Found during:** Task 1 (RED, caso e3)
- **Issue:** a lista devolve `FunilResumo` (`{ funil, totalEtapas, negociosAbertos }`), não `Funil`; `itens.map((f) => f.id)` dava `[undefined]`.
- **Fix:** `itens.map((f) => f.funil.id)`. Só o teste mudou.
- **Files modified:** `apps/api/src/e2e/crm-fluxo.test.ts`
- **Verification:** 8/8 antes do commit RED.
- **Committed in:** `fedacfd`

**2. [Rule 3 - Blocking] Ordem das asserções de (c) para o classificador de RED**
- **Found during:** Task 1 (RED)
- **Issue:** `gsd_run check tdd-red-evidence` recusou o primeiro registro (`invalid_record`, "Non-TAP data") por causa do YAML multilinha da asserção de array.
- **Fix:** (c) começa pelo `toBe` da última linha (string de uma linha); o resto das asserções continua.
- **Files modified:** `apps/api/src/persistencia/migrar-seco.test.ts`
- **Verification:** `RED_EVIDENCE_OK`.
- **Committed in:** `fedacfd`

### Fora de escopo (não corrigido, registrado)

**3. Duas falhas pré-existentes no portão `npm run check`** — `apps/api/src/e2e/lote-contas-a-pagar.test.ts` (5 de 6, as asserções de tempo de lock/semeadura contra o banco remoto; já em `STATE.md`) e a suíte "Automação de Canal publicada na Lista de Solicitações (CR-05/05-17)" de `apps/api/src/rotas/formularios-publicos.test.ts` (`seed de teste: A pergunta "Centro de Custo (Financeiro)" aponta para um Campo que esta Lista não tem`, arquivo intocado desde `06ec0fe`/05-17). As duas reproduzidas isoladas no checkout principal (`npx vitest run <arquivo>` contra o `.env`) antes de entrar em `deferred-items.md` (`status: open`, nomes exatos dos testes) e no `WINDOWS.md` (#5). Nenhum arquivo delas é desta fase; os testes do CRM contra o banco remoto pulam por desenho e foram provados contra o container (159/159, 0 pulados).

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3), ambas em teste; 1 registro fora de escopo.
**Impact on plan:** nenhum em código de produção; o plano saiu como escrito. A must-have "`npm run check` verde" fica com a ressalva documentada das duas falhas pré-existentes do Financeiro.

## Issues Encountered

- A primeira tentativa de evidência RED foi recusada pelo classificador por formato (acima). Resolvido reordenando as asserções.
- Nada mais: o container `crm-n1-pg-0712` (porta 55482) subiu, serviu os testes e foi removido ao fim da Task 1, como o plano pede; nada foi escrito no banco da plataforma (o `--seco` só foi exercitado contra o container; o `npm run check` contra o `.env` só roda os testes já existentes, que pulam o CRM).

## Known Stubs

Nenhum: nenhum valor fixo, placeholder ou componente sem fonte de dados foi criado neste plano.

## Threat Flags

Nenhuma superfície nova além do que o `<threat_model>` prevê: `migracoesPendentes`/`--seco` são só `select` (T-07-36, provado em (a) e (c)); o e2e só roda contra host local (T-07-37, `describeComBanco`) em Espaços `ws_crm_teste_*` apagados no `afterAll`; nenhum pacote novo.

## User Setup Required

None - no external service configuration required. O passo humano desta fase (aplicar a 007 ao banco da plataforma depois do `--seco`) é de 07-13.

## Next Phase Readiness

- **07-13 (wave 9, `autonomous: false`)** pode começar: rodar `npm run migrar -w @n1/api -- --seco` contra o banco da plataforma (leitura pura, esperado: `001`..`006` `aplicada`, `007-crm.sql` `pendente`), aplicar a 007 pelo dono, e a UAT que fecha as janelas #1–#4 do `WINDOWS.md`.
- **Ressalva do portão:** `npm run check` sai 1 pelas duas falhas pré-existentes do Financeiro (`deferred-items.md`, `WINDOWS.md` #5). Decisão do dono: aceitar a ressalva para a fase ou corrigir antes.
- `CRM-V1`, `CRM-A1` e `CRM-W1` foram declarados por este plano; `CRM-W1` também por 07-11 (já com SUMMARY) e 07-13 — o `requirements.ready-ids` decide quais marcar agora.

---
*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Completed: 2026-10-11*

## Self-Check: PASSED

Arquivos criados/modificados presentes em disco; commits `fedacfd`, `8e910a5`, `574ad31` ancestrais de HEAD; `commits: 3` medido de `plan_head_before` (`f1e8762`) ate `plan_head_after` (`574ad31`).
