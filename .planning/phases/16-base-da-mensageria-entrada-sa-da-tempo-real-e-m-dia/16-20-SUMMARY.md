---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 20
subsystem: mensageria-saida
tags: [outbox, entregador, nunca-reenvia, gap-closure, wr-01, wr-02, t-16-69, t-16-70, t-16-71, t-16-75, tdd]

requires:
  - phase: 16-05
    provides: o entregador da saída e a política "o ambíguo nunca é reenviado sozinho"
  - phase: 16-06
    provides: "Tentar de novo" e reenfileirarPendentesDoCanal
  - phase: 16-17
    provides: o CONTEXT.md da mensageria que este plano também edita
provides:
  - "outbox-worker.ts: CODIGO_DA_TRAVA_VENCIDA e CODIGO_DO_ERRO_DO_ENTREGADOR; a trava vencida devolvida a pending com o código e um resumo fixo"
  - "entregar-mensagem.ts: a guarda de linha sem desfecho (ENVIO_SEM_DESFECHO), ERRO_ANTES_DO_ENVIO, ESPERAS_PARA_GRAVAR_O_ACEITE_MS, a dependência esperar e FRASES_DA_SAIDA.aceitaSemRegistro"
  - "fila-de-saida.ts: CODIGO_DO_CANAL_DESCONECTADO e o motivo do reenfileiramento (tentar_de_novo | canal_voltou)"
affects: [16-VERIFICATION lacunas WR-01 e WR-02, 16-SECURITY risco residual 1, 16-22 (conferência do dono em produção)]

requirements-completed: [MSG-02]

actuals:
  tokens: 7200
  tasks: 2
  commits: 4
plan_head_before: fbc2e94232e3216ce86fd359d89060f1ff4b43e3
plan_head_after: eab4f88fa46e60fcd25b38919f773c0b772a752f

tech-stack:
  added: []
  patterns:
    - "A linha do outbox é a memória do que foi tentado: o last_error_code que já existe carrega o sinal de que a linha voltou sem desfecho, sem coluna nova nem migração"
    - "O que roda antes do enviar é de quem certamente não enviou (transitório); o que escapa depois do enviar é ambíguo e nunca reenvia"
    - "Um predicado por motivo no mesmo upsert: a pessoa reabre qualquer failed/delivered, o Canal que volta só reabre o que esperava a conexão"

key-files:
  created: []
  modified:
    - apps/api/src/persistencia/outbox-worker.ts
    - apps/api/src/persistencia/outbox-worker.test.ts
    - apps/api/src/mensageria/entregar-mensagem.ts
    - apps/api/src/mensageria/entregar-mensagem.test.ts
    - apps/api/src/mensageria/fila-de-saida.ts
    - apps/api/src/mensageria/CONTEXT.md
    - apps/api/src/persistencia/CONTEXT.md

key-decisions:
  - "Sem marca \"envio iniciado\": a linha que volta sem desfecho é ambígua, tenha ou não chamado o provedor. O custo é um falso \"sem confirmação\" na janela de milissegundos entre reivindicar e chamar o provedor, só em queda; o ganho é nenhuma ida a mais ao banco por envio e nenhuma migração (a 014 seria de mão única)"
  - "O worker passa a gravar TRAVA_VENCIDA também ao devolver a linha a pending (antes só ao esgotar as tentativas); só o worker de saída usa recuperarTravasVencidasMs, então o caminho HTTP do automation/ não muda"
  - "O preparo (tudo antes do enviar) virou uma função própria, com um try/catch só: a exceção vira ERRO_ANTES_DO_ENVIO e a guarda fica depois das conferências, logo antes do provedor.enviar"
  - "reenfileirarEnvio ganhou o parâmetro motivo (padrão tentar_de_novo): a assinatura de reenfileirarPendentesDoCanal e dos três chamadores não mudou"

patterns-established:
  - "gravarOAceite espera 250 ms e 1 s entre 3 tentativas; esperar é injetável para o teste não dormir"

coverage:
  - id: D1
    description: "A trava vencida volta a pending marcada com TRAVA_VENCIDA e o entregador fecha a Mensagem como falhou sem confirmação, linha failed/ENVIO_SEM_DESFECHO, sem chamar o provedor; a trava de 30 s não é tomada"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#WR-01: linha delivering com trava de 3 min (worker que caiu) volta marcada e fecha como sem confirmação"
        status: pass
      - kind: integration
        ref: "apps/api/src/persistencia/outbox-worker.test.ts#(x) a trava vencida devolvida a pending chega ao entregador marcada com TRAVA_VENCIDA"
        status: pass
    human_judgment: false
  - id: D2
    description: "A exceção que escapou do entregador depois do enviar (ERRO_DO_ENTREGADOR) não reenvia; o transitório do provedor (HTTP_503) sai normalmente; Tentar de novo depois do desfecho ambíguo reabre a linha e a Mensagem sai uma vez"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#WR-01 (ERRO_DO_ENTREGADOR, HTTP_503 e Tentar de novo)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O banco que cai antes do envio vira tentar_de_novo com ERRO_ANTES_DO_ENVIO e nada é lançado (teste sem banco)"
    requirement: MSG-02
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#WR-01: o banco que cai antes do envio vira tentar_de_novo com ERRO_ANTES_DO_ENVIO"
        status: pass
    human_judgment: false
  - id: D4
    description: "O aceite que não grava tenta 3 vezes com 250 ms e 1 s, fecha a Mensagem como falhou com a frase do aceite sem registro (id_externo nulo) e a linha failed/ENVIADO_SEM_REGISTRO; um segundo processarUm não reenvia"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#WR-02: o aceite que não grava (id externo já usado no Canal)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A volta do Canal só reabre failed/CANAL_DESCONECTADO e cria a linha que falta; a linha failed/ENVIADO_SEM_REGISTRO continua como está"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#WR-02: a volta do Canal só reabre a linha failed/CANAL_DESCONECTADO"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/canais.test.ts (a volta do Canal de 16-06, sem mudança)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Em produção, com a Evolution real, a queda do processo entre o aceite do provedor e a gravação não manda a Mensagem duas vezes ao celular do cliente"
    requirement: MSG-02
    verification: []
    human_judgment: true
    rationale: "Provado só com o provedor de teste e um Postgres 16 de Docker; a queda real do processo (SIGKILL, OOM) com a Evolution é a conferência do dono no plano 16-22"

duration: 25min
completed: 2026-11-10
status: complete
---

# Phase 16 Plan 20: A saída nunca reenvia sozinha o que pode ter saído (WR-01 e WR-02) Summary

**A linha `mensagem.enviar.v1` que volta à fila sem desfecho (trava vencida, que o worker agora marca `TRAVA_VENCIDA`, ou exceção depois do `enviar`, `ERRO_DO_ENTREGADOR`) é fechada pelo entregador como `falhou` sem confirmação antes de chamar o provedor; o aceite que não grava depois de 3 tentativas (250 ms e 1 s) fecha a Mensagem com a frase própria em vez de deixá-la em "Enviando…", e a volta do Canal só reabre `failed/CANAL_DESCONECTADO`.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-11-10
- **Tasks:** 2 (1 traçador TDD, 1 automática TDD com documentação)
- **Files:** 7 modificados, nenhum criado; nenhuma migração

## Accomplishments

- `outbox-worker.ts`: `CODIGO_DA_TRAVA_VENCIDA` e `CODIGO_DO_ERRO_DO_ENTREGADOR` exportados e usados no lugar dos literais; `recuperarTravasVencidas` devolve a trava vencida a `pending` com `last_error_code = 'TRAVA_VENCIDA'` e um resumo fixo (o código é parâmetro do SQL, igual nas duas consultas); JSDoc de `recuperarTravasVencidasMs` atualizado.
- `entregar-mensagem.ts`: tudo que roda antes do `provedor.enviar` virou `preparar()`, e o entregador o envolve num `try/catch`: a exceção vira `tentar_de_novo` com `ERRO_ANTES_DO_ENVIO` (passa por `sanitizarErro`) e, na última tentativa, `recusarEnvio(…, semResposta, "ERRO_ANTES_DO_ENVIO")`. A guarda logo antes do `enviar`: `last_error_code` igual a `TRAVA_VENCIDA` ou `ERRO_DO_ENTREGADOR` fecha a Mensagem com `semConfirmacao` e a linha `failed/ENVIO_SEM_DESFECHO`, sem chamar o provedor.
- `gravarOAceite`: 3 tentativas com `ESPERAS_PARA_GRAVAR_O_ACEITE_MS = [250, 1000]` (`esperar` injetável) e, se nada grava, `recusarEnvio(…, FRASES_DA_SAIDA.aceitaSemRegistro, "ENVIADO_SEM_REGISTRO")`; se nem isso grava, a exceção sobe e a guarda fecha a linha como ambígua na volta seguinte.
- `fila-de-saida.ts`: `CODIGO_DO_CANAL_DESCONECTADO` e `reenfileirarEnvio(…, motivo = "tentar_de_novo")`; com `canal_voltou` o `do update` só vale para `failed` com esse código. `reenfileirarPendentesDoCanal` passa `canal_voltou`; o predicado de "Tentar de novo" é o de antes.
- `CONTEXT.md` da mensageria (a guarda do WR-01, o WR-02, o predicado da volta do Canal, o resíduo aceito) e da persistência (a trava vencida volta marcada e quem entrega decide).
- Testes: quatro casos "WR-01" com banco, um sem banco (`describe` fora do `describeComBanco`), dois "WR-02" e o caso (x) do worker genérico. O caso antigo de trava vencida, que esperava o reenvio, foi reescrito para o desfecho novo.

## TDD

- **RED 1 (`c1fdfec`):** os quatro "WR-01" com banco, o sem banco e o caso (x). Falharam nas asserções planejadas: `enviados` com 1 em vez de 0 (a trava vencida, `ERRO_DO_ENTREGADOR` e o "Tentar de novo" mandavam ao provedor), `last_error_code` nulo em vez de `TRAVA_VENCIDA` no worker, e a exceção do banco escapando do entregador em vez de `tentar_de_novo`. O caso do `HTTP_503` passou no RED de propósito (é a guarda de que o transitório continua saindo). Semântica: os alvos executaram e falharam por falta do comportamento. `tdd_mode` desligado: o classificador `tdd-red-evidence` não foi exigido.
- **GREEN 1 (`d1977d7`):** o código da trava no worker, o `preparar()`, `ERRO_ANTES_DO_ENVIO` e a guarda. 45 passam (`entregar-mensagem`, `outbox-worker`, `e2e/mensageria`).
- **RED 2 (`8b6b13a`):** `esperar` nunca chamado (`[]` em vez de `[250, 1000]`) e a volta do Canal reabrindo 3 linhas em vez de 2.
- **GREEN 2 (`eab4f88`):** a frase, as esperas, o predicado por motivo, os `CONTEXT.md`. Nenhum REFACTOR.

## Verificação

- Postgres 16 de Docker (`crm-n1-pg-1620`, porta 55733, `EVOLUTION_URL=` vazio, removido no fim): `entregar-mensagem`, `outbox-worker` e `e2e/mensageria` (45 passam); depois `src/mensageria`, `src/e2e/mensageria.test.ts`, `src/servicos/crm`, `canal-ligar-evolution` e `outbox-worker` (35 arquivos, 584 testes passam, nenhum skipped nos arquivos do plano). Sem banco: o caso "WR-01 … ERRO_ANTES_DO_ENVIO" passa e os com banco aparecem como pulados. `npx tsc --noEmit` do `apps/api` limpo.
- Critérios de aceite: as duas constantes do worker (1 cada), `ENVIO_SEM_DESFECHO` e `ERRO_ANTES_DO_ENVIO` na saída, "WR-01" no teste (5, mínimo 4) e "WR-02" (2), `aceitaSemRegistro` (3), `ESPERAS_PARA_GRAVAR_O_ACEITE_MS` (5), `CODIGO_DO_CANAL_DESCONECTADO` exportado (1), `canal_voltou` (6), `CANAL_DESCONECTADO` no `CONTEXT.md` (3), `ENVIADO_SEM_REGISTRO` no `CONTEXT.md` da mensageria (2), `TRAVA_VENCIDA` no da persistência (2), `git diff --name-only -- apps/api/migracoes` vazio.
- O `apps/api` não tem lint próprio (o `npm run lint` da raiz cobre só o `apps/web`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] O caso novo da volta do Canal deixava linhas reabertas para o caso seguinte do arquivo**
- **Found during:** Task 2 (GREEN)
- **Issue:** o `reenfileirarPendentesDoCanal` do teste deixa duas linhas `pending` e disponíveis no Espaço de teste, e o `processarUm()` do caso "motivo do provedor com apikey" (o último do arquivo) pegou uma delas primeiro, então a Mensagem dele ficou `pendente`.
- **Fix:** o caso apaga as três linhas do outbox no fim.
- **Files modified:** `apps/api/src/mensageria/entregar-mensagem.test.ts`
- **Commit:** `eab4f88`

**2. [Nomenclatura] O caso do worker genérico é o (x), não o (v)**
- **Found during:** Task 1 (RED)
- **Issue:** o plano pedia o caso "(v)", mas `(v)` e `(w)` já existem em `outbox-worker.test.ts` (o `acordar()`).
- **Fix:** o caso novo é o `(x)`.
- **Commit:** `c1fdfec`

**Total deviations:** 2 (1 auto-fix de teste, 1 de nome). **Impact:** nenhum no comportamento entregue.

## Resíduo aceito

- A linha que esgota as 5 tentativas em travas vencidas continua indo a `failed/TRAVA_VENCIDA` sem passar pelo entregador (é a proteção contra a linha que derruba o processo), e a Mensagem dela fica `pendente`. Exige cinco quedas seguidas do processo na mesma Mensagem (decisão do planejador, registrada também no `CONTEXT.md` da mensageria).
- A linha que cai entre reivindicar e chamar o provedor também vira "sem confirmação": um falso alarme de milissegundos, só em queda de processo; a pessoa confere e usa "Tentar de novo".

## Threat Flags

Nenhum: não há endpoint, caminho de autenticação nem acesso a arquivo novos. As frases novas e o resumo da trava vencida são fixos de produto; `ERRO_ANTES_DO_ENVIO` passa por `sanitizarErro` (T-16-75).

## Known Stubs

Nenhum.

## Self-Check: PASSED

- `apps/api/src/persistencia/outbox-worker.ts`, `apps/api/src/mensageria/entregar-mensagem.ts`, `apps/api/src/mensageria/fila-de-saida.ts` e os dois `CONTEXT.md` existem e foram commitados.
- Commits `c1fdfec`, `d1977d7`, `8b6b13a` e `eab4f88` são ancestrais de `HEAD`; `git rev-list --count fbc2e94..HEAD` = 4 (medido antes do commit deste SUMMARY).
