---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 11
subsystem: infra
tags: [deploy, systemd, nginx, github-actions, homologacao, bash]

requires:
  - phase: 09-04
    provides: "npm run banco:conceder (conceder-n1-api) e o par DATABASE_URL / DATABASE_URL_MIGRACAO"
  - phase: 09-06
    provides: "nginx-n1-crm-api.conf com __SITE__, n1-crm-limites.conf e o preparar-vps.sh que instala os limites"
provides:
  - "preparar-vps.sh, n1-crm-api.service, instalar-release.sh e publicar.sh parametrizados por AMBIENTE (producao padrao, homologacao)"
  - "preparar-vps.sh --conferir e INSTALAR_SO_CONFERIR=1 (conferencia sem root e sem efeito)"
  - "checagem de Pitfall 9 antes de extrair e banco:conceder depois do migrar, a cada deploy"
  - "job homologacao no deploy-api.yml com grupo de concorrencia por ambiente"
  - "secao Homologacao (Fase 9) em apps/api/deploy/CONTEXT.md"
affects: [09-17, 09-18, 09-20, deploy, homologacao]

actuals:
  tokens: 4800
  tasks: 2
  commits: 2
plan_head_before: 94878f18ba5207d1729ba9e81f5ad8b27b53399a
plan_head_after: 5ae62651206febd1972f6f2db55cfb91c1b4f666

tech-stack:
  added: []
  patterns:
    - "Um unico conjunto de scripts de deploy escolhe o ambiente por AMBIENTE; o padrao e a producao de hoje"
    - "Modo de conferencia sem efeito (--conferir, INSTALAR_SO_CONFERIR) para o dono ver o que o script faria antes de rodar na VPS"
    - "Um grupo de concorrencia por job (por ambiente), nao por workflow"

key-files:
  created: []
  modified:
    - apps/api/deploy/preparar-vps.sh
    - apps/api/deploy/n1-crm-api.service
    - apps/api/deploy/instalar-release.sh
    - apps/api/deploy/publicar.sh
    - .github/workflows/deploy-api.yml
    - apps/api/deploy/CONTEXT.md

key-decisions:
  - "A producao e o valor padrao de AMBIENTE (n1crm, /opt/n1-crm, 3020, n1-crm-api): nenhum chamador precisa mudar para continuar publicando em producao."
  - "O modelo do .service troca usuario, pasta e porta por marcadores (__USUARIO__, __BASE__, __PORTA__) e o comentario do cabecalho evita repetir os marcadores, para que o sed nao os reescreva."
  - "O publicar.sh passa o ambiente a instalar-release.sh como segundo argumento; o script que roda na VPS sai do commit publicado, entao script e argumento sempre andam juntos."
  - "O job de producao do deploy-api.yml passou a exigir head_branch == main no ramo workflow_run, porque a lista de branches agora inclui homologacao."

patterns-established:
  - "Mudanca nos scripts de deploy se prova renderizando o ambiente de producao e comparando com o modelo do commit anterior (aqui: site identico; servico so ganha 3 linhas de comentario)."

requirements-completed: [SEG-08]

coverage:
  - id: D1
    description: "Os scripts e a unidade systemd montam producao ou homologacao a partir de AMBIENTE; a homologacao nasce com usuario n1crm-hml, /opt/n1-crm-hml, porta 3021, servico e site proprios, e a producao renderiza como antes."
    requirement: "SEG-08"
    verification:
      - kind: other
        ref: "AMBIENTE=homologacao bash apps/api/deploy/preparar-vps.sh <dominio> --conferir | grep User=n1crm-hml, PORT=3021, WorkingDirectory=/opt/n1-crm-hml/current/apps/api, n1-crm-api-hml.access.log n1_mascarado"
        status: pass
      - kind: other
        ref: "bash apps/api/deploy/preparar-vps.sh <dominio> --conferir | grep User=n1crm$ e PORT=3020; site de producao identico ao do commit anterior"
        status: pass
    human_judgment: false
  - id: D2
    description: "instalar-release.sh para antes de instalar quando DATABASE_URL e o papel n1_api e falta DATABASE_URL_MIGRACAO, aceita o api.env com as duas linhas, e roda banco:conceder depois do migrar."
    requirement: "SEG-08"
    verification:
      - kind: other
        ref: "INSTALAR_SO_CONFERIR=1 API_ENV=<sem.env|com.env> bash apps/api/deploy/instalar-release.sh <sha> homologacao (1 sem a linha, 0 com as duas)"
        status: pass
    human_judgment: false
  - id: D3
    description: "deploy-api.yml tem o job homologacao (environment homologacao, branch homologacao) e o job de producao so para a main, cada um com seu grupo de concorrencia e sem cancelar."
    requirement: "SEG-08"
    verification:
      - kind: other
        ref: "node -e (yaml): jobs.deploy/homologacao, ambientes, grupos distintos, branches [main, homologacao], AMBIENTE=homologacao no publicar, sem concurrency no topo"
        status: pass
    human_judgment: false
  - id: D4
    description: "A execucao real: preparar a VPS, criar o usuario e a chave de homologacao, cadastrar o ambiente homologacao no GitHub e provar um push na branch homologacao ate o /saude."
    requirement: "SEG-08"
    verification: []
    human_judgment: true
    rationale: "O plano e so de repositorio (VPS, GitHub, Supabase e Vercel sao do dono em 09-17); nada foi executado fora desta maquina."

duration: 14min
completed: 2026-10-22
status: complete
---

# Phase 9 Plan 11: Homologacao na VPS e no GitHub Summary

**Os scripts de deploy e a unidade systemd montam producao ou homologacao por `AMBIENTE` (homologacao: usuario n1crm-hml, /opt/n1-crm-hml, porta 3021, servico n1-crm-api-hml), com checagem de Pitfall 9, `banco:conceder` a cada deploy e um job `homologacao` no deploy-api.yml com concorrencia por ambiente.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-23T02:03:00Z
- **Completed:** 2026-10-23T02:20:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `preparar-vps.sh` escolhe usuario, pasta, porta, servico e site por `AMBIENTE` (`producao` padrao) e erra com "AMBIENTE deve ser producao ou homologacao" para qualquer outro valor. `--conferir` (ultimo argumento, antes da checagem de root, exit 0) imprime as variaveis, o `sudoers` e o servico e o site ja renderizados. O sudoers vai para `/etc/sudoers.d/$SERVICO` e so reinicia e le o proprio servico.
- `n1-crm-api.service` usa `__USUARIO__`, `__BASE__` e `__PORTA__`; o endurecimento (`NoNewPrivileges`, `ProtectSystem=strict`, `MemoryMax`) nao mudou.
- `instalar-release.sh <sha> [producao|homologacao]`: Pitfall 9 conferido antes de extrair; `INSTALAR_SO_CONFERIR=1` e `API_ENV=` para provar sem VPS; `npm run banco:conceder -w @n1/api` depois do `migrar` e antes de trocar o `current` (falha aborta o deploy).
- `publicar.sh` usa `AMBIENTE` para a pasta remota e repassa o ambiente a `instalar-release.sh`.
- `deploy-api.yml`: job `homologacao` (`environment: homologacao`, branch `homologacao`, `AMBIENTE=homologacao`), grupos `deploy-api-producao` e `deploy-api-homologacao` (`cancel-in-progress: false`), `workflow_run.branches: [main, homologacao]`, o `concurrency` do topo removido.
- `deploy/CONTEXT.md` ganhou "Homologação (Fase 9)": tabela produção x homologação, roteiro com `--conferir`, segredos do ambiente `homologacao`, `api.env` de homologação (inclui `WEB_ORIGIN` com a URL de Preview), `NEXT_PUBLIC_*` do Preview, a regra D-21 e o Pitfall 9.

## Task Commits

1. **Task 1: Scripts e unidade por AMBIENTE, Pitfall 9 e banco:conceder** - `5a65cfc` (feat)
2. **Task 2: Job homologacao no deploy-api.yml e roteiro em deploy/CONTEXT.md** - `5ae6265` (feat)

**Plan metadata:** commit `docs(09-11)` deste SUMMARY, STATE e ROADMAP (hash no historico, logo apos `5ae6265`).

## Files Created/Modified

- `apps/api/deploy/preparar-vps.sh` - AMBIENTE, `--conferir`, funcoes `renderizar_servico`/`renderizar_site`
- `apps/api/deploy/n1-crm-api.service` - marcadores de usuario, pasta e porta
- `apps/api/deploy/instalar-release.sh` - ambiente, Pitfall 9, `INSTALAR_SO_CONFERIR`, `API_ENV`, `banco:conceder`
- `apps/api/deploy/publicar.sh` - AMBIENTE escolhe a pasta remota e e repassado
- `.github/workflows/deploy-api.yml` - dois jobs, um grupo de concorrencia cada
- `apps/api/deploy/CONTEXT.md` - secao "Homologação (Fase 9)" e o passo 0 / `banco:conceder` no caminho da mudanca

## Producao nao muda: como foi provado

- **Render da producao:** com o `nginx-n1-crm-api.conf` e o servico do commit anterior (`git show HEAD:...`) renderizados com o `sed` antigo, o site de producao novo e identico byte a byte, e o servico novo difere so por 3 linhas de comentario no cabecalho (usuario, pasta, porta, `PATH`, `ReadWritePaths`, `WorkingDirectory`, `ExecStart` iguais).
- **Valores padrao:** sem `AMBIENTE`, `preparar-vps.sh --conferir` imprime `n1crm`, `/opt/n1-crm`, `3020`, `n1-crm-api`, `n1-crm-api`; `instalar-release.sh` sem segundo argumento usa `/opt/n1-crm` e `n1-crm-api.service`.
- **Job de producao do workflow:** mesmos passos, mesmo `environment: production`, mesmo `timeout-minutes`; a unica diferenca de passo e `AMBIENTE=producao` explicito no `publicar` (igual ao padrao). O `if` ganhou `head_branch == 'main'` no ramo `workflow_run`, que antes era garantido pelo filtro de branches.
- **O que muda de verdade em producao:** cada deploy passa a rodar `npm run banco:conceder` depois do `migrar`. Sem o papel `n1_api` no banco ele imprime "o papel nao existe neste banco - nada concedido" e sai 0 (09-04); e passa a existir a checagem de Pitfall 9, que so barra um `api.env` com `n1_api` em `DATABASE_URL` sem `DATABASE_URL_MIGRACAO` (o de producao de hoje nao esta nesse caso).

## Decisions Made

Ver `key-decisions` acima. Reversibilidade `costly` da D-23 respeitada: usuario, sudoers e chave de deploy proprios da homologacao.

## Deviations from Plan

None - plan executed exactly as written.

(O comentario novo no cabecalho do `.service` nao repete os marcadores `__USUARIO__`/`__BASE__`/`__PORTA__` de proposito, para o `sed` nao reescreve-los; nao e desvio de escopo.)

## Issues Encountered

None. `shellcheck` nao esta instalado nesta maquina; a verificacao foi `bash -n` mais os comandos do plano, em bash 3.2 (macOS). Nada foi executado na VPS, no GitHub, no Supabase nem na Vercel (plano so de repositorio); `api.env` real nao foi lido. Nenhum processo meu ficou rodando.

## User Setup Required

None - nenhuma configuracao externa e exigida por este plano. A execucao na VPS, no GitHub (ambiente `homologacao`, segredos, branch `homologacao`) e na Vercel (variaveis do Preview) e do dono em 09-17; o roteiro esta em `apps/api/deploy/CONTEXT.md`, secao "Homologação (Fase 9)".

## Threat Flags

None - nao surgiu superficie nova alem da que o `<threat_model>` do plano ja cobre (T-09-52 a T-09-57).

## Known Stubs

None.

## Next Phase Readiness

- 09-17 pode rodar `AMBIENTE=homologacao preparar-vps.sh <dominio> --conferir` e depois de verdade, cadastrar o ambiente `homologacao` no GitHub e criar a branch `homologacao`.
- O `WEB_ORIGIN` do `api.env` de homologacao precisa trazer a URL de Preview da Vercel da branch `homologacao` (CORS por allowlist) - esta no roteiro.
- Os ajustes no nginx da homologacao (limites, mascara) seguem o mesmo `nginx-n1-crm-api.conf`; o `n1-crm-limites.conf` e compartilhado e so e instalado se ainda nao existir.

## Self-Check: PASSED

- Arquivos: os seis arquivos modificados existem; commits `5a65cfc` e `5ae6265` sao ancestrais de HEAD.
- Verificacoes do plano: os tres comandos da Task 1 e o da Task 2 terminam com exit 0; criterios de aceitacao conferidos (`banco:conceder` = 1, `__USUARIO__` = 2, `User=n1crm` = 0, `environment: homologacao` = 1, `environment: production` = 1, CONTEXT.md com "Homologação (Fase 9)", "n1crm-hml" e "WEB_ORIGIN").

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-22*
