---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 18
subsystem: mensageria
tags: [encerramento, sigterm, systemd, vite-node, gap-closure, wr-03, t-16-28, tdd]

requires:
  - phase: 16-07
    provides: o hub de eventos do tempo real (definirDisponivel) e a desmontagem da recarga do index.ts
provides:
  - "apps/api/src/encerramento.ts: criarEncerramento (aoEncerrar, desmontar, instalar, desinstalar) e TETO_DO_ENCERRAMENTO_MS = 15 s"
  - "index.ts com um tratador único de SIGTERM e SIGINT que roda a mesma desmontagem da recarga e sai do processo"
  - "testes/processo-que-encerra.ts: o processo de prova (vite-node, fluxo SSE aberto) nos modos antigo, novo e com parada travada"
affects: [16-VERIFICATION lacuna 2, 16-VALIDATION G-05, 16-20 (WR-01, entrega cortada pelo teto), 16-22 (conferência do dono em produção)]

requirements-completed: [MSG-02, MSG-03]

actuals:
  tokens: 6900
  tasks: 2
  commits: 3
plan_head_before: 168b6fce788ffe7f2b740f10470756b64ca5caf7
plan_head_after: 43e2487af492faaf465b563f8a95f98ee7b79a27

tech-stack:
  added: []
  patterns:
    - "Um tratador único de sinal recebe as paradas por injeção (aoEncerrar só guarda) e não importa Fastify nem o banco; o index.ts injeta as etapas"
    - "O caminho do sinal tem teste num processo de verdade, com o mesmo executor da produção, e um ambiente de filho limpo (só PATH, HOME e as variáveis do modo)"

key-files:
  created:
    - apps/api/src/encerramento.ts
    - apps/api/src/encerramento.test.ts
    - apps/api/src/testes/processo-que-encerra.ts
  modified:
    - apps/api/src/index.ts
    - apps/api/deploy/CONTEXT.md
    - apps/api/CONTEXT.md
    - apps/api/src/testes/CONTEXT.md

key-decisions:
  - "Um tratador único (criarEncerramento) no lugar de um ouvinte de SIGTERM por worker: a ordem é fluxos, paradas em paralelo, fluxos de novo, servidor, pool, saída; a recarga do vite-node --watch usa a mesma sequência (desinstalar + desmontar) sem sair do processo"
  - "Teto de 15 s (TETO_DO_ENCERRAMENTO_MS), abaixo dos 20 s do TimeoutStopSec; estourar registra 'encerramento: teto estourado' e sai com 1; só o nome do erro vai para o registro, nunca a mensagem"
  - "O teste do caminho real usa um processo de prova pequeno, não o index.ts, porque a subida do index.ts carrega o arquivo de ambiente da api (produção)"

patterns-established:
  - "Falha de etapa não impede as seguintes: cada etapa é registrada, a que falha vira 'encerramento: <etapa> falhou' e a saída é 1"

coverage:
  - id: D1
    description: "Um SIGTERM de verdade, com um fluxo SSE aberto, faz o processo sair com código 0 em menos de 5 s, o fluxo termina no cliente e a saída traz as etapas fluxos, paradas, servidor, pool, nessa ordem (executor vite-node, como na unidade)"
    requirement: MSG-03
    verification:
      - kind: integration
        ref: "apps/api/src/encerramento.test.ts#tratador único: SIGTERM com um fluxo aberto fecha o fluxo e o servidor e sai com 0 em menos de 5 s"
        status: pass
    human_judgment: false
  - id: D2
    description: "O comportamento antigo (um ouvinte de SIGTERM que só para o worker) deixa o processo vivo 3 s depois do sinal: reproduz a causa do SIGKILL de 2026-11-10"
    requirement: MSG-03
    verification:
      - kind: integration
        ref: "apps/api/src/encerramento.test.ts#modo antigo: um ouvinte de SIGTERM que só para o worker deixa o processo vivo 3 s depois do sinal"
        status: pass
    human_judgment: false
  - id: D3
    description: "Uma parada travada não segura o processo: o teto corta, registra 'encerramento: teto estourado' e sai com 1 em menos de 3 s (processo real, TETO_MS=800)"
    requirement: MSG-03
    verification:
      - kind: integration
        ref: "apps/api/src/encerramento.test.ts#parada travada: o teto corta, registra e sai com 1 em menos de 3 s"
        status: pass
    human_judgment: false
  - id: D4
    description: "As bordas do tratador num processo falso: SIGTERM e SIGINT na mesma ordem, dois sinais seguidos fecham o servidor e saem uma vez, parada que rejeita não impede as seguintes (saída 1, só o nome do erro no registro), teto de tetoMs e padrão de 15 s cancelado no encerramento limpo, desmontar() sem sair e com a mesma promessa, desinstalar() sem ouvinte de sinal"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "apps/api/src/encerramento.test.ts#criarEncerramento: as bordas do tratador"
        status: pass
    human_judgment: false
  - id: D5
    description: "O restart real na VM (journalctl sem 'stop-sigterm timed out. Killing', linhas 'encerramento: …' presentes), com o index.ts ligado ao tratador e os workers reais"
    requirement: MSG-02
    verification: []
    human_judgment: true
    rationale: "O index.ts é conferido por tsc e pelos critérios de aceite, não por um processo (ele carregaria o ambiente de produção); nada foi publicado nem reiniciado aqui. A conferência é do dono, no plano 16-22, e a primeira publicação ainda é desligada pelo processo antigo"

duration: 14min
completed: 2026-11-10
status: complete
---

# Phase 16 Plan 18: O SIGTERM encerra a API (T-16-28 / WR-03) Summary

**Um tratador único (`criarEncerramento`) roda no SIGTERM e no SIGINT a mesma desmontagem da recarga (fecha os fluxos SSE, espera os workers terminarem a volta em voo, fecha o servidor, encerra o pool) e sai do processo, com teto de 15 s abaixo dos 20 s do systemd; provado com um processo de verdade no mesmo `vite-node` da unidade.**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-11-10
- **Tasks:** 2 (1 traçador TDD, 1 automática TDD com documentação)
- **Files:** 3 criados, 4 modificados

## Accomplishments

- `apps/api/src/encerramento.ts`: `criarEncerramento({ fecharFluxos, fecharServidor, encerrarPool, registrar, tetoMs?, agendar? })` devolve `{ aoEncerrar, desmontar, instalar, desinstalar }`. `aoEncerrar` só guarda a parada; `desmontar()` roda a sequência uma única vez (a segunda chamada devolve a mesma promessa) e registra cada etapa (`encerramento: fluxos|paradas|servidor|pool`), e a etapa que falha vira `encerramento: <etapa> falhou` sem impedir as seguintes. `instalar(process)` liga SIGTERM e SIGINT, arma o teto (`unref`), e sai com `0` (tudo certo) ou `1` (etapa falhou ou teto estourado); o segundo sinal só registra.
- `apps/api/src/index.ts`: o `encerramento` nasce depois do `buildApp` com `hub.definirDisponivel(false)`, `app.close()` e `encerrar()`; `aoEncerrar` virou só o registro de paradas (acabou o ouvinte de SIGTERM por worker); a parada do tempo real é só `ouvinte.parar()`; `encerramento.instalar(process)` vem antes do `listen`; a desmontagem da recarga é `desinstalar()` + `await desmontar()`. O cabeçalho ganhou o parágrafo do SIGTERM.
- `apps/api/src/testes/processo-que-encerra.ts` e `encerramento.test.ts`: o filho sobe com o `vite-node` da raiz (como o `ExecStart`), segura um fluxo longo, recebe `kill("SIGTERM")` e o teste mede código e tempo. Os três modos (antigo, novo, parada travada) mais oito casos puros: 12 testes.
- `deploy/CONTEXT.md` (nova linha em "Operar" e o parágrafo "O desligamento"; uma frase em "Mensageria"), `CONTEXT.md` da api (linha `src/encerramento.ts`) e `src/testes/CONTEXT.md` (o processo de prova e por que ele não usa o `index.ts`).

## TDD

- **RED (`0706240`):** `encerramento.test.ts` e o processo de prova. Resultado: 1 passou, 2 falharam. O caso do modo antigo passa de propósito (documenta a causa: o processo segue vivo 3 s depois do SIGTERM). Os casos novo e com teto falham porque o filho morre ao importar `../encerramento`, que ainda não existia (`Cannot find module '../encerramento'`). Avaliação semântica: o alvo executou e falhou pela ausência do comportamento planejado, mas a falha é de importação no filho, não uma asserção sobre o código de saída; é o RED possível quando a unidade nasce junto do teste. `tdd_mode` está desligado, então o classificador `tdd-red-evidence` não foi exigido.
- **GREEN (`e3ec287`):** `encerramento.ts` e a ligação no `index.ts`. Os três casos de processo passam (modo novo sai com 0 em ~0,4 s; teto sai com 1 em ~1 s; modo antigo continua vivo aos 3 s).
- **Task 2 (`43e2487`):** os oito casos puros já passaram na primeira rodada, porque a implementação da Task 1 já cobria cada borda do `<behavior>` (o passo 1 da Task 1 detalha SIGINT, segundo sinal, teto e `desinstalar`); não houve RED separado para eles. Nenhum REFACTOR.
- **Hipótese do WR-03 confirmada:** no modo antigo o `vite-node` NÃO instala tratador próprio; o processo não sai sozinho com o ouvinte de SIGTERM, que é exatamente o comportamento que levou ao SIGKILL de 2026-11-10.

## Verificação

- `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= EVOLUTION_URL= npx vitest run --reporter=verbose src/encerramento.test.ts`: 12 passam; `npx tsc --noEmit` limpo. Nenhum teste deste plano abre conexão com banco, então não houve container de Postgres.
- Sem processo solto depois dos testes (`pgrep processo-que-encerra` vazio).
- Critérios de aceite: `criarEncerramento` exportado e `TETO_DO_ENCERRAMENTO_MS = 15_000` (1 cada); `criarEncerramento` no `index.ts` (2: import e uso) e `instalar(process)` == 1; nenhum `process.on("SIGTERM"` fora de comentário no `index.ts`; o processo de prova não importa `persistencia/conexao` nem chama `carregarEnv`; `SIGTERM` 18 vezes no teste; `SIGINT` e `teto estourado` presentes em `encerramento.ts`; `n1-crm-api.service` sem mudança; nenhum endereço IP em `testes/CONTEXT.md`.
- `npm run verificar:contratos` só avisou que o repositório irmão não está presente (esperado).
- O lint do web não cobre `apps/api` (não há configuração de ESLint nele); a conferência de tipos é o `tsc`.

## Deviations from Plan

None - plan executed exactly as written.

Observações, sem desvio de código:
- A Task 1 já entregou a implementação completa do tratador (como o passo 1 descreve), então os casos puros da Task 2 nasceram verdes (ver "TDD").
- O processo de prova importa `../encerramento` dinamicamente (só no modo novo) para o modo antigo rodar no RED.
- O `git status` tem arquivos modificados e não rastreados de outras fases e do planejamento (`docs/09-planejamento/*`, `.planning/phases/13-*`, etc.), deixados como estavam.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum além do registrado: T-16-73 (desligamento pendurado), T-16-65 (entrega em voo cortada pelo teto, tratada como ambígua no plano 16-20), T-16-66 (o filho recebe só `PATH`, `HOME` e as variáveis do modo) e T-16-SC (nenhum pacote novo) ficam mitigados.

## Next Phase Readiness

Fecha o código e o teste da lacuna 2 de `16-VERIFICATION.md` (T-16-28 / WR-03) e a G-05 de `16-VALIDATION.md`. Os planos 16-19 a 16-22 seguem independentes. A conferência em produção é do dono no 16-22: um `systemctl restart n1-crm-api` sem `stop-sigterm timed out` no journal, lembrando que a primeira publicação com esta versão ainda é desligada pelo processo antigo e pode levar o SIGKILL uma última vez. Nada foi publicado nem reiniciado aqui.

## Self-Check: PASSED

- Arquivos criados existem: `apps/api/src/encerramento.ts`, `apps/api/src/encerramento.test.ts`, `apps/api/src/testes/processo-que-encerra.ts`.
- Os três commits (`0706240`, `e3ec287`, `43e2487`) estão no HEAD; `test(16-18)` precede `feat(16-18)`.
