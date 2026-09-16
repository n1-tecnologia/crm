---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 01
subsystem: infra
tags: [package-legitimacy, npm, fastify, security-checkpoint, T-1-SC]

# Dependency graph
requires: []
provides:
  - "Confirmação humana registrada de que fastify, @fastify/type-provider-zod, @fastify/cors e concurrently são pacotes legítimos no registro npm, antes de qualquer npm install desta fase"
  - "Plan 01-02 liberado para instalar os quatro pacotes"
affects: [01-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Checkpoint humano bloqueante (checkpoint:human-verify, gate blocking-human) antes de npm install para todo pacote marcado [SUS]/[ASSUMED] no Package Legitimacy Audit do RESEARCH.md"

key-files:
  created: []
  modified: []

key-decisions:
  - "fastify [SUS] confirmado como falso positivo estrutural: o único sinal era too-new (patch de 2026-09-16), repositório oficial github.com/fastify/fastify, ~9,5M downloads/semana"
  - "@fastify/type-provider-zod (com escopo @fastify/, repositório github.com/fastify/fastify-type-provider-zod) tem peerDependencies zod >=4.2.0 — aceita o zod ^4.6.1 do monorepo; NÃO foi necessário o fallback para o pacote sem escopo fastify-type-provider-zod"
  - "Nenhuma instalação ocorreu neste plano — npm view apenas, sem npm install; Plan 01-02 é quem instala"

requirements-completed: [PERS-04]

# Metrics
duration: <1min (checkpoint de verificação; sem tarefas de implementação)
completed: 2026-09-16
---

# Phase 1 Plan 01: Portão de legitimidade de pacote — fastify e dependências Summary

**Checkpoint humano bloqueante (T-1-SC) aprovado: `fastify` 5.12.5, `@fastify/type-provider-zod` 1.0.0, `@fastify/cors` 11.3.0 e `concurrently` 10.0.5 conferidos nos repositórios oficiais no npm antes de qualquer instalação — Plan 01-02 liberado.**

## Performance

- **Duration:** < 1 min de execução de tarefa (a pausa para resposta humana não conta como duração de trabalho)
- **Started:** 2026-09-16 (pré-checkpoint: `npm view` executado, sem instalar nada)
- **Completed:** 2026-09-16 (aprovação humana recebida: "approved")
- **Tasks:** 1/1
- **Files modified:** 0 (checkpoint não escreve código nem instala pacotes)

## Accomplishments

- T-1-SC (STRIDE Tampering em `npm install`) tratado: o único plano desta fase que faz um `npm install` de pacote novo (`fastify`, `@fastify/type-provider-zod`, `@fastify/cors`, `concurrently`) é o 01-02, e ele só pode rodar depois deste "approved".
- Confirmado que o sinal `[SUS]` (`too-new`) do Package Legitimacy Audit do RESEARCH.md era um falso positivo estrutural: a data suspeita era só a de um patch, não a origem do pacote.
- Confirmado que `@fastify/type-provider-zod` é o pacote COM escopo (`github.com/fastify/fastify-type-provider-zod`), não o impostor sem escopo — e que sua `peerDependencies.zod` (`>=4.2.0`) aceita o `zod ^4.6.1` já usado por `packages/dominio`, então o fallback documentado no Plan 01-02 (`fastify-type-provider-zod` sem escopo) não é necessário.
- Nenhum pacote foi instalado: `npm view` foi a única chamada de rede feita por este plano.

## Task Commits

Nenhum arquivo de código foi criado ou modificado — este plano é só um checkpoint de verificação humana, sem output de implementação. Não há commit de tarefa (nada em `<files>` da Task 1: `(nenhum — este checkpoint não escreve arquivo)`).

**Plan metadata:** pending (este commit — SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md)

## Evidência coletada (comando rodado antes do checkpoint, 2026-09-16, nada instalado)

```
=== fastify ===
version = '5.12.5'
repository.url = 'git+https://github.com/fastify/fastify.git'
dist-tags.latest = '5.12.5'
time.modified = '2026-09-16T10:23:05.222Z'

=== @fastify/type-provider-zod ===
version = '1.0.0'
repository.url = 'git+https://github.com/fastify/fastify-type-provider-zod.git'
peerDependencies = { zod: '>=4.2.0', fastify: '^5.5.0', 'openapi-types': '^12.1.3', '@fastify/swagger': '>=9.5.1' }

=== @fastify/cors ===
version = '11.3.0'
repository.url = 'git+https://github.com/fastify/fastify-cors.git'

=== concurrently ===
version = '10.0.5'
repository.url = 'git+https://github.com/open-cli-tools/concurrently.git'
```

## Files Created/Modified

Nenhum — este plano não produz artefato de código. Os únicos arquivos tocados são de tracking GSD (`01-01-SUMMARY.md`, `STATE.md`, `ROADMAP.md`), listados no commit final.

## Decisions Made

- **T-1-SC tratado sem fallback:** a peer dependency de `zod` em `@fastify/type-provider-zod` aceita `^4.6.1` (o que o monorepo usa), então o Plan 01-02 instala o pacote com escopo (`@fastify/type-provider-zod`) diretamente, sem precisar do fallback sem escopo (`fastify-type-provider-zod`) que o plano havia documentado como plano B.
- **Nenhum outro pacote novo nesta fase:** confirmado que `zod` (dependência já existente de `packages/dominio`), `vite-node` (devDependency já existente de `apps/api`) e `fastify-plugin` (não usado — hook de autenticação registrado direto na instância raiz, ver Plan 01-02) não entram no escopo deste checkpoint.

## Deviations from Plan

None - plan executado exatamente como escrito. A única tarefa do plano é o checkpoint; a pessoa respondeu "approved" sem ressalvas nem achados que exigissem as Rules 1-4.

## Issues Encountered

None.

## Human Verification

- **Checkpoint:** Task 1 (`checkpoint:human-verify`, `gate="blocking-human"`)
- **What was needed:** Confirmação humana de que `fastify`, `@fastify/type-provider-zod`, `@fastify/cors` e `concurrently` são os pacotes oficiais no registro npm (T-1-SC), antes de qualquer `npm install` desta fase.
- **Outcome:** Aprovado ("approved", 2026-09-16). Nenhuma instalação ocorreu neste plano — o Plan 01-02 está liberado para instalar os quatro pacotes.

## User Setup Required

None - checkpoint de verificação, sem configuração de serviço externo.

## Next Phase Readiness

- Plan 01-02 (Fastify em `apps/api`) está liberado para rodar `npm install fastify @fastify/type-provider-zod @fastify/cors concurrently` (ou equivalente no workspace `apps/api`/raiz) sem novo portão de legitimidade — este checkpoint já cobre os quatro pacotes.
- Nenhum bloqueio conhecido para os planos seguintes desta fase.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

Verificado: nenhum `fastify*`/`concurrently` presente em nenhum `package.json` do monorepo (grep vazio) — confirma que nada foi instalado por este plano. Automated verify do plano (`npm view fastify repository.url | grep fastify/fastify` + `npm view @fastify/type-provider-zod repository.url | grep fastify-type-provider-zod`) re-executado e passou (PART1 PASS, PART2 PASS). `git status --short` limpo, exceto `.planning/research/` (untracked, fora do escopo deste plano).
