---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 34
subsystem: docs
tags: [gate, ensaio, corte, provas, context, validation, ucr-10]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "ensaio do 15-30 (copia de 2026-11-05), remocao do modelo antigo (15-32, 15-33, 15-41, 15-42, 15-43), migrar:crm-antigo completo (15-27, 15-28)"
provides:
  - "15-PROVAS.md: o gate (3 rodadas, a 3a verde), as decisoes tomadas em nome do dono, suposicoes, decisoes pendentes, as 43 linhas abertas do WINDOWS, provas manuais, avisos da Fase 14 e as linhas do andamento.mjs"
  - "15-CORTE.md: o roteiro literal do corte para o dono (10 passos, D-15-03), com A CONFIRMAR PELO DONO onde nao ha comando literal"
  - "15-ENSAIO.md: secao Ensaio final com o codigo f268958 sobre a copia de 2026-11-05, sem diferenca em relacao ao 15-30"
  - "CONTEXT.md da raiz com A partir da Fase 15; CONTEXT.md de dominio, web e api/rotas contra o codigo final; 15-VALIDATION.md validated"
affects: [15-35]

plan_head_before: f268958df226bbf600bb9831fc61f65c19ba865e
plan_head_after: 28047ff5d7b4088f16650b86ed57f9d0bac47c23
commits: 3

actuals:
  tokens: 20400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "gate: npm run check em Postgres 16 de Docker novo por rodada, com as duas URLs locais escritas no comando; flake de baseline provado com o arquivo rodado sozinho em tres contêineres novos"
    - "ensaio final por script descartavel fora do repositorio, com trap que derruba o contêiner e apaga o ponto de restauracao; comparacao automatica por Espaco contra os numeros do ensaio anterior"
    - "roteiro de corte com conferencia por passo, laco explicito dos Espacos por nome e comparador testado sobre as saidas do ensaio"

key-files:
  created:
    - .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-PROVAS.md
    - .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-CORTE.md
  modified:
    - .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-ENSAIO.md
    - .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-VALIDATION.md
    - CONTEXT.md
    - packages/dominio/CONTEXT.md
    - apps/web/CONTEXT.md
    - apps/api/src/rotas/CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "O gate rodou tres vezes: as duas primeiras so falharam no outbox-worker (h a k), a terceira fechou verde (EXIT=0). O flake foi provado com o arquivo sozinho em tres contêineres novos (1 de 3 passa) e com git diff vazio sobre os arquivos de outbox desde o inicio da fase"
  - "O ensaio final deu exatamente os numeros do 15-30 em todos os 19 Espacos (revisao antes e depois e linhas guardadas, comparacao automatica), entao nenhum achado novo no script"
  - "15-CORTE.md lista 18 nomes alem do ws_n1 (os 17 de teste da Fase 14 e ws_agendaworker_..., vazio) e manda parar se o Espaco do dia nao estiver na lista"
  - "O passo 8 do corte usa o cabecalho de publicar.sh (VPS_HOST, VPS_USER, SSH_KEY) e o push da web vai ao remoto n1; o comando de restaurar o backup em producao e o modo do push (direto ou PR) ficam como A CONFIRMAR PELO DONO"
  - "Nova linha aberta no WINDOWS (#73): depois do corte o Enviar Flow a um Contato fica sem destinatario"

requirements-completed: [UCR-01, UCR-02, UCR-03, UCR-04, UCR-05, UCR-06, UCR-07, UCR-08, UCR-11, UCR-12]

coverage:
  - id: D1
    description: "O gate (npm run check em Docker migrado ate a 012) rodou tres vezes; a saida resumida e a evidencia do flake estao em 15-PROVAS.md"
    requirement: UCR-10
    verification:
      - kind: manual
        ref: "15-PROVAS.md, secoes 'Como rodar o gate', 'Resultado do gate' e 'Flakes de baseline' (3a rodada EXIT=0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O ensaio final com o codigo final sobre a copia de ~/n1-ensaio repete os numeros do 15-30 (2128 = 2128 por Espaco, 19 Espacos, 23952 -> 21838, dois caminhos do Funil do ws_n1, --migrar em dois Espacos de teste)"
    requirement: UCR-10
    verification:
      - kind: manual
        ref: "15-ENSAIO.md, secao 'Ensaio final (codigo final)'"
        status: pass
    human_judgment: false
  - id: D3
    description: "15-CORTE.md e o roteiro literal do corte na ordem de D-15-03, com D-15-14, D-15-02, a janela e a ordem migrar:crm-antigo antes de publicar"
    requirement: UCR-10
    verification:
      - kind: unit
        ref: "greps de aceite da Task 2 (publicar.sh, --verificar >= 2, todo migrar:crm-antigo com um modo, Meus negocios, migrar depois da aprovacao)"
        status: pass
    human_judgment: false
  - id: D4
    description: "CONTEXT.md da raiz e das camadas descrevem o codigo final; 15-VALIDATION.md validated"
    verification:
      - kind: unit
        ref: "greps de aceite da Task 3 (A partir da Fase 15, 15-CORTE, gesto-no-crm, tabela de operacoes sem modulo apagado, nyquist_compliant)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Se o roteiro de corte e legivel e seguro para o dono executar, e se ele aceita as tres decisoes tomadas em seu nome"
    verification: []
    human_judgment: true
    rationale: "O roteiro nunca foi executado (o corte e do dono, 15-35); as decisoes (a), (b) e (c) sao dele revisar."

duration: ~45min
completed: 2026-11-06
---

# Phase 15 Plan 34: Gate, ensaio final, roteiro do corte e CONTEXT Summary

**O `npm run check` fechou verde na 3a rodada (as duas primeiras so falharam no flake do `outbox-worker`, que a fase nao tocou), o ensaio final repetiu sem diferenca os numeros do 15-30 em todos os 19 Espacos, e o dono tem o roteiro literal do corte (`15-CORTE.md`) e a lista do que decidir (`15-PROVAS.md`).**

## Performance

- **Duration:** ~45 min de relogio (23:13Z a 23:33Z em gate e ensaio; o restante foi escrever)
- **Tasks:** 3, todas de documentacao
- **Files:** 2 criados (`15-PROVAS.md`, `15-CORTE.md`), 7 alterados (`15-ENSAIO.md`, `15-VALIDATION.md`, tres `CONTEXT.md` de camada, `CONTEXT.md` da raiz e `WINDOWS.md`), mais este SUMMARY

## Accomplishments

- **Gate (UCR-10).** `npm run check` em Postgres 16 de Docker novo por rodada (`crm-n1-pg-1534`, porta 55734, as duas URLs locais escritas no comando), migrado ate a `012`, sobre o SHA `f268958`. Rodada 1: so o `outbox-worker` (h). Rodada 2: so o `outbox-worker` (i, j, k). **Rodada 3: `EXIT=0`** (api 2449, web 1298, dominio 2384 testes). `outbox-worker.test.ts` sozinho em tres contêineres novos: 15/15, 12/15, 11/15; a fase nao tocou o arquivo (`git diff` vazio desde `b0a240e`). Tudo em `15-PROVAS.md`.
- **Ensaio final.** O codigo final sobre a mesma copia de `~/n1-ensaio` (`.dump` de 2026-11-05, restaurado inteiro): as 2128 linhas das nove colecoes de antes sao as 2128 de `registros_crm_antigo` depois, por Espaco e por colecao (19 Espacos); `registros` 23952 → 21838; `ws_n1` pelos dois caminhos do Funil (guardar: 2 Funis, 6 Etapas; migrar: 3 e 7, 2 linhas em `crm_de_para`); a Pasta "Meus negocios" fica em 16 Espacos de teste com 18 Tarefas em 4 Listas; `--migrar` em dois Espacos de teste; papel `n1_api`; duas execucoes simultaneas e `kill -9`; `hidratar` dos 19 sem nenhuma das oito colecoes. A comparacao com o 15-30 foi automatica e deu diferenca zero. Nenhum e-mail nem telefone no arquivo; ponto de restauracao, scripts e contêiner apagados.
- **Roteiro do corte.** `15-CORTE.md` com os dez passos de D-15-03, o laco explicito dos 18 Espacos por nome, o comparador do `--verificar` com o `--seco` (testado sobre as saidas do ensaio: 19 "igual"), D-15-14, D-15-02, a janela, a ordem "script antes de publicar", "se um passo falhar" e linhas em branco para hora e resultado. O corte e declarado so do dono.
- **`15-PROVAS.md`.** As tres decisoes tomadas em nome do dono (com a frase dele, o que foi conferido e como desfazer), as suposicoes, as 17 decisoes pendentes, as 43 linhas abertas do `WINDOWS.md` e a `waived`, as provas manuais (nenhuma tela foi aberta em navegador), os avisos da Fase 14 e as 14 linhas do `andamento.mjs` (3.4.1 a 3.5.4; 3.5.2 `parcial`).
- **CONTEXT.** A raiz ganhou "A partir da Fase 15" e os paragrafos das Fases 7, 8 e 14 foram ajustados; `packages/dominio`, `apps/web` e `apps/api/src/rotas` foram reescritos contra o codigo final; `apps/api/src/rotas/esquemas/CONTEXT.md` ja estava correto (o 15-32 o atualizou) e nao precisou de edicao. `15-VALIDATION.md` virou `validated`.

## Task Commits

1. **Task 1:** `853be49` `docs(15-34): o gate da fase duas vezes, as decisoes tomadas em nome do dono e 15-PROVAS` (`15-PROVAS.md`, `WINDOWS.md`)
2. **Task 2:** `d10e4ce` `docs(15-34): roteiro do corte (15-CORTE) e ensaio final com o codigo final` (`15-CORTE.md`, `15-ENSAIO.md`)
3. **Task 3:** `28047ff` `docs(15-34): A partir da Fase 15 no CONTEXT da raiz, CONTEXT das camadas contra o codigo final e 15-VALIDATION validado`

**Plan metadata:** commits `docs(15-34)` seguintes (este SUMMARY, STATE.md e ROADMAP.md).

## Verificacao

- Task 1: `grep -c "npm run check"` = 4; as linhas `"3.4.x"`/`"3.5.x"` = 14; `git diff --stat` de `TAREFAS-POR-SESSAO.md` e `dados/` igual ao de antes (o plano nao os tocou).
- Task 2: `pg_dump -Fc --schema=plataforma` = 1; `migrar:crm-antigo` = 8; `Ensaio final` = 1; `publicar.sh` = 7; `--verificar` = 11; toda linha `npm run migrar:crm-antigo` tem um modo (0 sem); nenhuma `--funil` sem `--migrar`; `Meus negócios` = 5; `npm run migrar -w @n1/api` sem `--seco` so aparece no passo 6, depois da aprovacao (passo 5); nenhum contêiner `crm-n1-pg-15*` de pe; `15-ENSAIO.md` e `15-CORTE.md` sem e-mail nem `+55`.
- Task 3: `A partir da Fase 15` = 2, `15-CORTE` = 1 na raiz; `nyquist_compliant: true` presente; `gesto-no-crm` = 7 em `rotas/CONTEXT.md`; nenhuma linha de operacao de modulo apagado na tabela do dominio.
- Nada foi rodado contra producao, nada de push, deploy, VM ou `.env`; nenhum contêiner `supabase_*` tocado.

## Decisions Made

Ver `key-decisions` no cabecalho. A mais importante para o dono esta em `15-PROVAS.md`, "O que o dono decide antes do corte": o Funil do `ws_n1`, as tres decisoes tomadas em nome dele, o aviso 61 (Automacao do seed), o aviso 73 (Enviar Flow) e a cópia de ensaio.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Aviso novo no WINDOWS: depois do corte o Enviar Flow nao tem destinatario**
- **Found during:** Task 1, ao ler o aviso 39 contra o codigo final
- **Issue:** `flow-popup.tsx:438` escolhe Conversas 1:1 de `state.conversations` (`!groupIdentifier && contactId`); o `migrar:crm-antigo` tira as Conversas 1:1 de `plataforma.registros`, e so as de Grupo ficam. Em producao, depois do corte, a lista de destinatarios do envio de Flow fica vazia. O aviso 39 dizia so que "um Contato da ficha nova sem Conversa no modelo antigo nao e enviavel".
- **Fix:** linha `deviation` #73 aberta no `WINDOWS.md` e levada a `15-PROVAS.md` como decisao do dono (aceitar ate a Sessao 7 ou pedir o seletor de Contatos com WhatsApp antes do corte). Nao corrigi o codigo: e decisao de produto e este plano so escreve documentos.
- **Files modified:** `.planning/WINDOWS.md`
- **Commit:** `853be49`

### Fora do contrato do plano (registradas)

- **O gate rodou tres vezes, nao duas.** As duas primeiras falharam so no flake de baseline; a terceira (a plano manda repetir se a unica falha e flake) fechou verde.
- **Parte das edicoes de `CONTEXT.md` ja tinha sido feita pelos planos anteriores.** O 15-32 e o 15-33 ja haviam tirado as linhas de operacao apagada da tabela do dominio e reescrito `esquemas/CONTEXT.md` e a ponte em `persistencia/CONTEXT.md`. Aqui reescrevi o que restava velho: "O que nao mudou" e a regra de `canais` em `packages/dominio/CONTEXT.md`, "Limitacao aceita (D-15)" em `apps/web/CONTEXT.md`, o mapa de leituras (`gesto-no-crm/`), a ponte, "ainda nao escrevem aqui" e os "e da Fase 15" em `apps/api/src/rotas/CONTEXT.md`, e os paragrafos das Fases 7 e 14 na raiz.
- **`requirements-completed` lista 10 dos 12 requisitos.** `requirements.ready-ids` bloqueou UCR-09 e UCR-10 porque o 15-35 (o corte) tambem os declara; ficam por marcar ate o dono cortar.
- **Falso resultado na primeira rodada do ensaio, nao do script.** A primeira rodada do `kill -9` falhou no `--guardar` seguinte com `lock timeout` porque o servidor so percebeu o `psql` morto depois do `pg_sleep` (a sessao do proprio ensaio ainda segurava a linha); o roteiro do ensaio passou a encerrar essa sessao antes de medir e a rodada que vale e a segunda. Tambem corrigi, antes de rodar, um erro de interpolacao do `psql -c` no roteiro (rodei de novo inteiro). Documentado em `15-ENSAIO.md`.
- **Comparador do `--verificar` ajustado.** O `--seco` imprime as nove colecoes inclusive com 0, o `--verificar` so as que tem linha guardada; o `awk` do `15-CORTE.md` descarta os zeros do lado do `--seco` (testado: 19 "igual").

**Total deviations:** 1 auto-fixed (Rule 2), 4 registradas. **Impact:** nenhuma amplia escopo de codigo; o plano so produz documentos.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. Nao ha endpoint, caminho de auth, acesso a arquivo em fronteira nova nem mudanca de schema neste plano.

## Linhas abertas em `.planning/WINDOWS.md`

- **#73 (nova, `deviation`):** depois do corte, "Enviar Flow" a um Contato nao tem Conversa para escolher (decisao do dono). Nenhuma outra linha foi marcada como corrigida por este plano; as 43 abertas da fase 15 estao contadas em `15-PROVAS.md`.

## Issues Encountered

- O `outbox-worker` falha tambem isolado em contêiner novo (1 de 3 passa); e o flake de baseline conhecido, nao regressao.
- Nada do ensaio impede o corte, mas o ensaio repete o limite de sempre: a copia e de 2026-11-05 e o banco de hoje pode ter mudado; a API e a web finais nao foram levantadas sobre a copia migrada; nenhuma tela foi aberta em navegador real.

## User Setup Required

None - nenhum servico externo. O que e do dono (decisoes, renovar a copia, o corte inteiro) esta em `15-PROVAS.md` e `15-CORTE.md`.

## Next Phase Readiness

- Pronto para o 15-35 (o corte), **que e so do dono**: ele le `15-PROVAS.md`, decide o Funil do `ws_n1` e as pendencias, e segue `15-CORTE.md`. Antes do corte, desfazer as decisoes (b) e (c) tomadas em nome dele e reverter commits do ramo (lista em `15-PROVAS.md`).
- UCR-09 e UCR-10 ficam por marcar ate o corte.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivos conferidos no disco (`[ -f ]`): `15-PROVAS.md`, `15-CORTE.md`, `15-ENSAIO.md`, `15-VALIDATION.md`, `CONTEXT.md` da raiz.
- Commits `853be49`, `d10e4ce` e `28047ff` sao ancestrais do HEAD.
- Os greps de aceite das tres tarefas reexecutados: passam; nenhum contêiner `crm-n1-pg-15*` de pe.
