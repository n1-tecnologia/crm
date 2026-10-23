---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 06
subsystem: infra
tags: [nginx, limit_req, rate-limit, log-masking, docker, deploy, trust-proxy]

requires:
  - phase: 09-04
    provides: "papel de banco e DATABASE_URL_MIGRACAO no .env.example, onde TRUST_PROXY se encaixa"
  - phase: 09-05
    provides: "mascararSegredoDeUrl e opcoesDoLogger: a mesma regra de mascara que o log_format do nginx espelha"
provides:
  - "n1-crm-limites.conf (conf.d, contexto http): zonas n1_publico (POST por IP, 30r/m) e n1_publico_leitura (GET/HEAD, 120r/m), map $n1_uri_mascarada e log_format n1_mascarado"
  - "Site nginx com location /v1/public/ (limit_req burst 10 e 60, 429, limit_req_log_level info, error_log crit) e access_log mascarado; placeholder __SITE__"
  - "provar-nginx.sh: prova em Docker (nginx:stable-alpine) do limite e da mascara, sai com 1 se alguma das tres provas falhar"
  - "preparar-vps.sh instala o conf.d de forma idempotente (nao sobrescreve o da VPS, tira o que pos se nginx -t falhar)"
  - "TRUST_PROXY documentado no .env.example; comentario de limite-de-taxa.ts corrigido; secao Limite e mascara no nginx em deploy/CONTEXT.md"
affects: [09-11, 09-17, 09-20, deploy, homologacao]

actuals:
  tokens: 5200
  tasks: 2
  commits: 2
plan_head_before: d8f59cfff68ecc798cc80b89d82f8b6741d06fc7
plan_head_after: 28ac0e02814ed9e849bd2dae2b501686e51644b1

tech-stack:
  added: []
  patterns:
    - "Zona de limit_req por metodo: map $request_method devolve a chave (IP) ou vazio; chave vazia nao conta no balde"
    - "Mascara de segredo na origem do log: map $request_uri + log_format proprio, sem $request nem $http_referer"
    - "Prova de nginx em Docker com um segundo server como upstream (return 200 no location rodaria antes do limit_req)"

key-files:
  created:
    - apps/api/deploy/n1-crm-limites.conf
    - apps/api/deploy/provar-nginx.sh
  modified:
    - apps/api/deploy/nginx-n1-crm-api.conf
    - apps/api/deploy/preparar-vps.sh
    - apps/api/src/servicos/limite-de-taxa.ts
    - apps/api/.env.example
    - apps/api/deploy/CONTEXT.md

key-decisions:
  - "POST limitado por IP a 30/min (burst 10); GET/HEAD com zona propria a 120/min (burst 60), acima dos limites em memoria, porque /f/ e /p/ chegam pelo IP de saida da Vercel (D-20, F5)"
  - "error_log do nginx tambem grava o segredo a cada 429: limit_req_log_level info mais error_log crit no location /v1/public/ (F3); custo registrado: erro de proxy dessas rotas nao vai ao log do nginx"
  - "preparar-vps.sh nunca sobrescreve o n1-crm-limites.conf da VPS (avisa se diferir) e remove o que ele mesmo instalou se o nginx -t falhar, para um conf.d invalido nao derrubar os outros projetos"

patterns-established:
  - "Prova local antes da VPS: bash apps/api/deploy/provar-nginx.sh e o mesmo roteiro que o dono repete a mao"

requirements-completed: [SEG-06, SEG-07]

coverage:
  - id: D1
    description: "POST em /v1/public/ limitado por IP: 39 de 50 respostas 429, o primeiro na 12a chamada; GET sem nenhum 429 em 50 chamadas"
    requirement: SEG-07
    verification:
      - kind: integration
        ref: "bash apps/api/deploy/provar-nginx.sh (provas 1 e 2, nginx:stable-alpine em Docker)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nenhum log do nginx (acesso, erro e saida do conteiner) guarda o segredo de link; o acesso mostra /v1/public/forms/***"
    requirement: SEG-06
    verification:
      - kind: integration
        ref: "bash apps/api/deploy/provar-nginx.sh (prova 3); prova negativa: sem limit_req_log_level e sem error_log crit a prova 3 falha"
        status: pass
    human_judgment: false
  - id: D3
    description: "A configuracao entra na VPS de producao e o dono confere as saidas de nginx -t, do laco de 50 curl e do grep nos logs"
    requirement: SEG-07
    verification: []
    human_judgment: true
    rationale: "Plano so de repositorio (D-11): a VPS compartilhada e do dono; a conferencia e a saida colada em 09-17 e 09-20"
  - id: D4
    description: "preparar-vps.sh instala o conf.d sem sobrescrever e TRUST_PROXY/limite em memoria ficam documentados"
    verification:
      - kind: other
        ref: "bash -n apps/api/deploy/preparar-vps.sh; grep -c ^TRUST_PROXY= apps/api/.env.example; cd apps/api && npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "O script so roda como root na VPS (nao executado aqui); a leitura de preparar-vps.sh e do roteiro e do dono"

duration: 55min
completed: 2026-10-22
status: complete
---

# Phase 9 Plan 06: Limite de taxa e mascara de segredo no nginx Summary

**Limite por IP so no POST (30/min) e teto proprio no GET (120/min) nas rotas publicas, com o segredo de link mascarado no acesso e ausente do error_log, provado num nginx real em Docker**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-10-22
- **Tasks:** 2
- **Files modified:** 7 (2 criados, 5 alterados)

## Accomplishments

- `n1-crm-limites.conf` (contexto `http`): duas zonas por metodo, `map $n1_uri_mascarada` e `log_format n1_mascarado` sem `$request` nem `$http_referer`.
- `location /v1/public/` no site com os dois `limit_req`, `429`, `limit_req_log_level info` e `error_log ... crit`, mais `access_log` mascarado; o resto do site fica como estava. Nomes de log parametrizados por `__SITE__`.
- `provar-nginx.sh`: sobe `nginx:stable-alpine`, roda `nginx -t` e tres provas; mediu 39 de 50 `429` no POST com o primeiro na 12a chamada (F4), 0 `429` em 50 GET e o segredo ausente de todo log, com `/v1/public/forms/***` no acesso. Prova negativa feita: sem as duas linhas de log do `location`, a prova 3 falha.
- `preparar-vps.sh` instala o `conf.d` so se nao existir, avisa se diferir, e tira o que pos se o `nginx -t` falhar.
- `TRUST_PROXY=` no `.env.example`, comentario de `LOG_LEVEL` atualizado, comentario de `limite-de-taxa.ts` aponta para o limite real da borda com a ressalva da Vercel, e `deploy/CONTEXT.md` ganhou a secao com roteiro da VPS e a pendencia do dono (Pitfall 8).

## Task Commits

1. **Task 1: zonas, mascara e `location /v1/public/` provados em Docker** - `6d3a84c` (feat)
2. **Task 2: instalacao idempotente, TRUST_PROXY, comentario corrigido e roteiro** - `28ac0e0` (feat)

**Plan metadata:** commit docs(09-06) a seguir (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `apps/api/deploy/n1-crm-limites.conf` - zonas, map e log_format (conf.d da VPS)
- `apps/api/deploy/provar-nginx.sh` - prova em Docker, `PORTA_DE_PROVA` (padrao 18609)
- `apps/api/deploy/nginx-n1-crm-api.conf` - `location /v1/public/`, `access_log` mascarado, `__SITE__`
- `apps/api/deploy/preparar-vps.sh` - instalacao idempotente do conf.d
- `apps/api/src/servicos/limite-de-taxa.ts` - so comentario
- `apps/api/.env.example` - `TRUST_PROXY=` e `LOG_LEVEL`
- `apps/api/deploy/CONTEXT.md` - secao "Limite e mascara no nginx (Fase 9)"

## Decisions Made

- GET com teto proprio (120r/m, burst 60) em vez do mesmo balde do POST: a Vercel chama o GET por um IP so, duas vezes por visita (D-20, F5).
- `error_log ... crit` no `location` em vez de filtrar o log depois: o segredo nunca chega ao disco (F3).
- O script de preparacao desfaz o `conf.d` que ele mesmo instalou quando o `nginx -t` falha, ja que um `conf.d` invalido derruba o nginx de todos os projetos da VPS compartilhada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Upstream de prova vazava o segredo no access_log padrao**
- **Found during:** Task 1 (primeira execucao de `provar-nginx.sh`)
- **Issue:** o `server` de upstream (porta 8081) herdava o `access_log` padrao do nginx.conf, que grava a URI crua na saida do conteiner; a prova 3 acusava o segredo mesmo com a configuracao do site correta.
- **Fix:** `access_log off;` no `server` de upstream da prova (na VPS o upstream e o Node, que nao tem esse log). A configuracao do site nao mudou.
- **Files modified:** apps/api/deploy/provar-nginx.sh
- **Verification:** prova 3 passa; prova negativa (sem as duas linhas de log do `location`) volta a falhar, entao a prova continua sensivel ao vazamento real.
- **Committed in:** 6d3a84c

**2. [Rule 1 - Bug] Alinhamento por espacos quebrava o criterio de aceitacao**
- **Found during:** Task 1 (acceptance_criteria)
- **Issue:** `zone=n1_publico:10m         rate=30r/m` (espacos de alinhamento) nao casava com o `grep` exato do criterio.
- **Fix:** um espaco so entre `zone=...` e `rate=...`.
- **Files modified:** apps/api/deploy/n1-crm-limites.conf
- **Committed in:** 6d3a84c

**Total deviations:** 2 auto-fixed (2 Rule 1). **Impact:** nenhum no escopo; os dois ajustes sao do proprio artefato do plano.

## Issues Encountered

None alem das deviacoes acima. `preparar-vps.sh` so teve a sintaxe conferida (`bash -n`): ele exige root e escreve em `/etc`, e este plano e so de repositorio. Nada foi feito por SSH nem contra URL de producao.

## Known Stubs

None.

## User Setup Required

None neste plano. A aplicacao na VPS (copiar `n1-crm-limites.conf`, editar o `access_log`, acrescentar o `location /v1/public/`, `nginx -t`, `reload`, laco de 50 `curl`, `grep` nos logs) e do dono em 09-17 (homologacao) e 09-20 (producao), com o roteiro em `apps/api/deploy/CONTEXT.md`. Pendencia de decisao do dono: o limite em memoria por IP do `apps/api` ainda junta os visitantes de `/f/` e `/p/` vindos da Vercel num balde so.

## Next Phase Readiness

- 09-11 pode parametrizar `__SITE__` e `__PORTA__` por ambiente; o `conf.d` serve os dois sites.
- 09-15 cobre `TRUST_PROXY` com `inject` e `X-Forwarded-For` forjado (T-09-34).
- Nenhum processo, contêiner ou watcher deixado em execucao.

## Self-Check: PASSED

- Arquivos criados e alterados existem; commits `6d3a84c` e `28ac0e0` estao no historico da branch.
- Criterios de aceitacao das duas tarefas e `<verification>` do plano (`provar-nginx.sh` exit 0 com tres `ok`; `bash -n preparar-vps.sh`; `npx tsc --noEmit` no `apps/api`) passam.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-22*
