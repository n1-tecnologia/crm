---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 19
subsystem: tempo-real
tags: [sse, silencio, reconexao, gap-closure, wr-08, t-16-67, t-16-68, tdd]

requires:
  - phase: 16-08
    provides: o cliente do tempo real (criarConexaoDoTempoReal) com reconexão e releitura de 5 s
  - phase: 16-07
    provides: GET /eventos com a batida `: batida` do servidor
provides:
  - "@n1/dominio/crm/eventos: BATIDA_DO_FLUXO_MS (25 s) e SILENCIO_MAXIMO_DO_FLUXO_MS (60 s), o contrato do fluxo entre a api e a web"
  - "apps/web/src/dados/tempo-real.ts: um AbortController e um relógio de silêncio por tentativa, e CONEXAO_ESTAVEL_MS (30 s)"
affects: [16-VERIFICATION lacuna WR-08, 16-22 (conferência do dono em produção)]

requirements-completed: [MSG-03]

actuals:
  tokens: 2900
  tasks: 2
  commits: 4
plan_head_before: c2314b89383e0385c4b27abffaf15ad197be09d8
plan_head_after: 391a9a70ef08f8ac60d5affa16d9fd0f11050c64

tech-stack:
  added: []
  patterns:
    - "O contrato entre quem bate (api) e quem conta (web) é uma constante do domínio, não dois números iguais em dois lugares"
    - "Um AbortController por tentativa: o relógio aborta a corrente, parar() a que estiver em curso, e a tentativa que termina libera a sua conexão"

key-files:
  created: []
  modified:
    - packages/dominio/src/crm/eventos.ts
    - packages/dominio/src/crm/eventos.test.ts
    - apps/api/src/rotas/eventos.ts
    - apps/web/src/dados/tempo-real.ts
    - apps/web/src/dados/tempo-real.test.ts
    - apps/web/CONTEXT.md
    - packages/dominio/CONTEXT.md

key-decisions:
  - "60 s sem nenhum byte (SILENCIO_MAXIMO_DO_FLUXO_MS): mais que duas batidas de 25 s, para uma batida atrasada pelo proxy não derrubar uma conexão boa; os dois números moram no domínio"
  - "O relógio não chama cair() direto: aborta a tentativa e cancela o leitor, e o laço de leitura sai e cai pelo caminho de sempre, uma vez só"
  - "A tentativa que termina aborta o próprio controlador no finally, para soltar a conexão qualquer que seja o fim; o teste de parar() segue valendo para a tentativa em curso"
  - "CONEXAO_ESTAVEL_MS = 30 s para zerar a espera (mais que uma batida): abrir() deixou de zerar tentativas e arma um temporizador de estabilidade, desarmado em cair() e parar()"

patterns-established:
  - "O temporizador de silêncio é rearmado a cada pedaço lido (qualquer byte, comentário incluído) e armado antes do fetch, então cobre o fetch que nunca responde"

coverage:
  - id: D1
    description: "O fluxo aberto que fica 60 s sem nenhum byte cai uma vez, aborta o signal da tentativa, religa a releitura de 5 s e reconecta depois da espera de 1 s; 59,999 s sem byte não derruba"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "apps/web/src/dados/tempo-real.test.ts#WR-08: o fluxo aberto que fica 60 s sem nenhum byte cai, religa a releitura de 5 s e reconecta"
        status: pass
    human_judgment: false
  - id: D2
    description: "Com a batida do servidor a cada 25 s por 3 min a conexão nunca cai e só existe um fetch"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "apps/web/src/dados/tempo-real.test.ts#WR-08: com a batida do servidor a cada 25 s por 3 min a conexão nunca cai e só há um fetch"
        status: pass
    human_judgment: false
  - id: D3
    description: "O fetch que nunca responde é abortado em 60 s e conta como queda"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "apps/web/src/dados/tempo-real.test.ts#WR-08: o fetch que nunca responde é abortado em 60 s e conta como queda"
        status: pass
    human_judgment: false
  - id: D4
    description: "Um servidor que abre e fecha na hora, três vezes seguidas, é reconectado em 1 s, 2 s e 4 s; uma conexão estável de 30 s zera a espera (próxima tentativa em 1 s); parar() com os relógios armados não deixa temporizador"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "apps/web/src/dados/tempo-real.test.ts#WR-08 (três casos: 1 s 2 s 4 s, conexão estável, parar sem temporizador)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A batida e o silêncio máximo são um contrato só do domínio, e a rota usa a mesma constante como padrão"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/eventos.test.ts#a batida do fluxo e o silêncio máximo da aba (WR-08, 16-19)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A aba em produção, com o notebook que dorme ou a rede que cai sem aviso, volta a mostrar sozinha a Mensagem recebida em cerca de 60 s"
    requirement: MSG-03
    verification: []
    human_judgment: true
    rationale: "Provado só com temporizadores falsos e fluxo falso; o comportamento atrás do nginx e de uma rede real é a conferência do dono no plano 16-22"

duration: 7min
completed: 2026-11-10
status: complete
---

# Phase 16 Plan 19: O cliente SSE reconecta quando o fluxo fica mudo (WR-08) Summary

**A aba passou a dar o fluxo `GET /eventos` por morto depois de 60 s sem nenhum byte (a batida de 25 s conta): corta a tentativa, cai pelo caminho de sempre, religa a releitura de 5 s e reconecta, e a espera de reconexão só volta a 1 s depois de 30 s de conexão estável; a batida e o silêncio máximo são uma constante só em `@n1/dominio/crm/eventos`.**

## Performance

- **Duration:** ~7 min
- **Completed:** 2026-11-10
- **Tasks:** 2 (1 traçador TDD, 1 automática TDD com documentação)
- **Files:** 7 modificados, nenhum criado

## Accomplishments

- `packages/dominio/src/crm/eventos.ts`: `BATIDA_DO_FLUXO_MS = 25_000` e `SILENCIO_MAXIMO_DO_FLUXO_MS = 60_000`, com JSDoc do contrato entre a api e a web.
- `apps/api/src/rotas/eventos.ts`: `BATIDA_PADRAO_MS` saiu; o padrão da batida é `BATIDA_DO_FLUXO_MS` (a opção `batidaMs` dos testes continua). Nada mais na rota.
- `apps/web/src/dados/tempo-real.ts`: o `AbortController` único da vida da conexão deu lugar a um por tentativa (`controleDaTentativa`, guardado em `tentativaEmCurso` para o `parar()`); o relógio de silêncio é armado antes do `fetch` e rearmado a cada pedaço lido, e ao estourar aborta a tentativa e cancela o leitor sem chamar `cair()` (o laço sai e cai uma vez só). `abrir()` não zera mais `tentativas`: arma um temporizador de estabilidade (`CONEXAO_ESTAVEL_MS`, 30 s) que as zera; `cair()` e `parar()` o desarmam. JSDoc atualizado.
- `apps/web/CONTEXT.md` (relógio de silêncio, controlador por tentativa, espera que só zera com conexão estável) e `packages/dominio/CONTEXT.md` (o contrato da batida em `crm/eventos.ts`).

## TDD

- **RED 1 (`c323dab`):** invariante da batida no domínio e três casos "WR-08" da aba. Resultado: o domínio e dois casos da aba falharam nas asserções planejadas (`BATIDA_DO_FLUXO_MS` indefinido; `aoCair` chamado 0 vezes em vez de 1 aos 60 s). O caso das batidas por 3 min passou no RED de propósito (é a guarda contra o relógio cortar conexão saudável: com a constante ainda indefinida o laço nem rodava, então só vale depois do GREEN). Avaliação semântica: o alvo executou e falhou por falta do comportamento. `tdd_mode` está desligado, então o classificador `tdd-red-evidence` não foi exigido.
- **GREEN 1 (`bf2eed7`):** domínio, rota e o relógio de silêncio. A aba: 22 passam.
- **RED 2 (`568b61b`):** dois casos falharam (1 s, 2 s, 4 s: a nova tentativa vinha em 1 s todas as vezes; conexão estável: a constante `CONEXAO_ESTAVEL_MS` ainda não existia); o caso de `parar()` sem temporizador já passava e fica como guarda.
- **GREEN 2 (`391a9a7`):** `CONEXAO_ESTAVEL_MS`, o temporizador de estabilidade e a documentação. A aba: 25 passam, 6 com "WR-08" no nome. Nenhum REFACTOR.

## Verificação

- Domínio: `npx vitest run src/crm/eventos.test.ts` (9 passam) e `npx tsc --noEmit` limpos.
- Api: `DATABASE_URL= DATABASE_URL_MIGRACAO= EVOLUTION_URL= npx vitest run src/rotas/eventos.test.ts src/mensageria/hub-de-eventos.test.ts` (20 passam) e `npx tsc --noEmit` limpo. Nenhum destes testes abre banco, então não houve container de Postgres.
- Web: `npx vitest run src/dados/tempo-real.test.ts` (25 passam), `npx tsc --noEmit` e `npx eslint src/dados/tempo-real.ts` limpos.
- Critérios de aceite: as duas constantes do domínio (1 cada), `BATIDA_DO_FLUXO_MS` na rota (3), `SILENCIO_MAXIMO_DO_FLUXO_MS` na aba (4), `const controle = new AbortController()` fora de comentário (0), "WR-08" no teste da aba (6), a api sem import da web, `CONEXAO_ESTAVEL_MS = 30_000` (1) e no `CONTEXT.md` da web (1), nenhum `toast`, `new Notification` nem `document.title` em `tempo-real.ts` (0).
- Sem processo de teste solto.

## Deviations from Plan

None - plan executed exactly as written.

Observações, sem desvio de requisito:
- O critério de aceite pede que `const controle = new AbortController()` não exista fora de comentário; o controlador por tentativa tem o nome `controleDaTentativa` e o que o `parar()` guarda se chama `tentativaEmCurso`, como o plano descreve.
- O `finally` de cada tentativa aborta o próprio controlador (solta a conexão que sobrou). Isso faz o `signal` de uma tentativa já terminada ficar `aborted`; o teste "parar() aborta o fetch" continua valendo para a tentativa em curso (o "desmontar aborta o fetch" cobre a conexão aberta).
- Um primeiro script de edição do `tempo-real.ts` estourou o arquivo (um `replace` com trecho vazio); o arquivo foi restaurado do Git (era só a minha edição, sem commit) e refeito antes de qualquer teste ou commit.
- O ajuste do caso "a conexão que abre relê tudo uma vez…" manda `: batida` a cada 20 s no período aberto; o que ele prova não mudou.
- O `git status` tem arquivos de outras fases e do planejamento, e `.planning/config.json`, deixados como estavam e fora dos commits.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. T-16-67 (aba num fluxo morto) e T-16-68 (tempestade de reconexões) ficam mitigados; T-16-74 sem mudança de mecanismo (o token só no cabeçalho de cada tentativa, nunca em URL nem log); T-16-SC, nenhum pacote novo.

## Next Phase Readiness

Fecha o código e o teste do WR-08 de `16-REVIEW.md`. Nada foi publicado nem reiniciado. A conferência com rede real (notebook que dorme, nginx na frente) é do dono, no plano 16-22. Próximo: 16-20.

## Self-Check: PASSED

- Arquivos modificados existem e foram commitados em `c323dab`, `bf2eed7`, `568b61b` e `391a9a7`, todos ancestrais do HEAD; `test(16-19)` precede `feat(16-19)` nas duas tarefas.
