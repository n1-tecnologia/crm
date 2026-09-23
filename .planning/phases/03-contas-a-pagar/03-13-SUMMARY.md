---
phase: 03-contas-a-pagar
plan: 13
subsystem: ui
tags: [pag-05, d3-08, lote, batch-status-change, apps-web, vitest]

# Dependency graph
requires:
  - phase: 03-contas-a-pagar
    provides: "03-12 entregou `alterarStatusEmLote`/`RelatorioDeLote`/`LIMITE_DO_LOTE` no domínio, registrada em `OPERACOES`, alcançável por `POST /operacoes/alterarStatusEmLote` — este plano é a metade `apps/web` que consome esse contrato"
  - phase: 03-contas-a-pagar
    provides: "03-06 entregou `converterSolicitacaoEmContaAPagar`/`contaAPagarDeSolicitacao` registradas e alcançáveis, mas sem gatilho — este plano dá o gatilho"
  - phase: 03-contas-a-pagar
    provides: "03-15 fechou a visibilidade derivada (memberSeesTask) que este plano herda sem alargar"
provides:
  - "`BulkStatusBar` chama `alterarStatusEmLote` UMA vez no lugar de N `changeTaskStatus` — o laço de 61 `run()` que a fase mediu (~1,16M linhas lidas) morreu"
  - "`RelatorioDeLotePainel` — arquivo próprio, sem `tasks`/`useData` (T-3-55): os quatro resultados de `ItemDeLote`, `parcial` em bloco próprio, `motivo` literal do domínio"
  - "O gatilho de D3-08: botão 'Converter em Conta a pagar' no card de Aprovação da Solicitação (`painel-aprovacao.tsx`)"
  - "Correção de rota documentada em `contas-view.tsx`: a ação de lote não mora lá, mora em `bulk-status-bar.tsx`"
affects: [03-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Painel de relatório em arquivo próprio, sem acesso à coleção de Tarefas nem ao estado do domínio — a mitigação estrutural de T-3-55 (o atalho de 'melhorar' um rótulo lendo o estado local não existe no arquivo, não é regra a lembrar)"
    - "Prévia de recusa (`statusOptionRefusal`) como eco do domínio antes do clique, nunca decisão própria da tela — o gesto de lote reaproveita o mesmo padrão que as ações rápidas de `contas-view.tsx` já usavam"
    - "Estado de relatório na página, fora de qualquer condicional de seleção — sobrevive à barra que o produziu desmontar"

key-files:
  created:
    - apps/web/src/features/estrutura/relatorio-de-lote.tsx
    - apps/web/src/features/estrutura/bulk-status-bar.test.tsx
  modified:
    - apps/web/src/features/estrutura/bulk-status-bar.tsx
    - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx
    - apps/web/src/features/estrutura/financeiro/contas-view.tsx
    - apps/web/src/features/tarefa/painel-aprovacao.tsx
    - apps/web/src/features/tarefa/painel-aprovacao.test.tsx

key-decisions:
  - "O relatório de lote mora na página (`[lista]/page.tsx`), nunca dentro de `BulkStatusBar` — a barra desmonta quando a seleção esvazia (lote 100% bem-sucedido) ou quando contas `parcial` saem do filtro corrente (saindo também de `selecionadas`); o relato mais importante seria o mais fácil de perder"
  - "`RelatorioDeLotePainel` não recebe Tarefa nenhuma nas props — T-3-55 fica estrutural: sem `tasks`, o atalho de completar um `titulo`/`readableId` omitido com o estado local não existe no arquivo"
  - "O gatilho de D3-08 entra como BOTÃO no card de Aprovação da Solicitação, não como Automação e não em `contas-view.tsx` — a operação recebe `solicitacaoId`, e a tela de Contas mostra Contas, que para uma Solicitação ainda não convertida não existem"
  - "`\"Aplicar\"` só desabilita quando TODAS as selecionadas seriam recusadas — recusa parcial continua sendo o desenho que 03-12 defendeu com números, não a exceção"
  - "Achado de teste, não do enunciado do plano: a fixture de 'conta incompleta' usada no caso (e) (`tsk_cp_ferramenta`, já existente no seed) está sem Forma de pagamento, não sem Valor como o texto do plano descrevia — RN-CP-02 a recusa pelo mesmo motivo (requisito de saída não atendido), então a prova continua válida"
  - "`evoluirConfiguracaoDeSolicitacoes` materializa só a CONFIGURAÇÃO da Lista de Solicitações (Status, Campos, Papéis, Grant do Agente do pipeline) — nenhuma Tarefa fictícia; os testes de D3-08 (casos l-p) criam a Solicitação com `createTask`, no mesmo molde que `conversao-de-solicitacao.test.ts` (domínio) já usa"

requirements-completed: [PAG-05]

# Metrics
duration: ~110min
completed: 2026-09-23
---

# Phase 3 Plan 13: O gesto de lote vira uma chamada, e a conversão de Solicitação ganha botão — Summary

**`BulkStatusBar` troca 61 `run(changeTaskStatus)` concorrentes por UMA chamada de `alterarStatusEmLote` (03-12); `RelatorioDeLotePainel` (arquivo novo, sem acesso a Tarefa) renderiza os quatro resultados com `parcial` em bloco próprio; e `painel-aprovacao.tsx` ganha o botão que 03-06 deixou sem gatilho — a Solicitação aprovada vira Conta a pagar sem sair da plataforma.**

## Performance

- **Duration:** ~110 min (aprox. — inclui a leitura extensa de contrato exigida pelo plano antes de qualquer edição)
- **Tasks:** 4 (Tasks 1-3 completas e commitadas; Task 4 — checkpoint bloqueante de produção — PARADA, mesma família de bloqueio já registrada em 03-07/03-08/03-10/03-11/03-15)
- **Files modified:** 7 (2 criados, 5 modificados)

## Accomplishments

- **PAG-05 fecha na tela.** O gesto de lote que já existia em `contas-view.tsx`/`bulk-status-bar.tsx` (um laço de `run(changeTaskStatus)` por Tarefa, sem `await`, disparando 61 requisições concorrentes contra um Espaço que serializa escrita — DEC-06) passa a ser **uma** chamada de `alterarStatusEmLote` (03-12): `gravarMock` chamado 1 vez, `PedidoDeGravacao.chamadas.length === 1`, `nome === "alterarStatusEmLote"`, `args === [ids, statusId]` sem `actingMemberId` — provado no caso `(a)`/`(b)` para um lote de 61.
- **O relato de falha parcial é legível e acionável, não um toast que some.** `RelatorioDeLotePainel` (arquivo novo, `apps/web/src/features/estrutura/relatorio-de-lote.tsx`) mostra as quatro contagens (`alteradas`/`jaEstavam`/`recusadas`/`parciais`) e `ocorrenciasCriadas`; `parcial` ganha bloco próprio, tom `--aviso`, acima das recusas, com as duas metades ditas na mesma frase ("a conta mudou de Status; a ocorrência do mês seguinte não foi criada") e **sem** botão de repetir — repetir devolveria `jaEstava` e a ocorrência continuaria sem nascer.
- **T-3-55 é estrutural, não disciplinar.** `RelatorioDeLotePainel` não recebe `tasks` nem lê o estado do domínio — o rótulo é `item.titulo ?? item.readableId ?? "Conta sem acesso"`, e um `grep` prova a ausência do atalho (`readonly tasks` = 0; `useData`/`state.tasks`/`tasks.find` = 0 ocorrências no arquivo). O caso `(i)` confirma que o título REAL de uma Tarefa presente no estado do teste não aparece na tela quando o item vem sem `titulo`/`readableId`.
- **O teto do lote é recusado antes do clique.** Acima de `LIMITE_DO_LOTE` (200), "Aplicar" desabilita com o total selecionado e o número 200 no `disabledReason`; nenhum `.slice()` trunca a seleção (caso `c`).
- **A prévia nunca decide pelo domínio, e não bloqueia recusa parcial.** `statusOptionRefusal` roda item a item sobre a seleção corrente; "Aplicar" só desabilita quando TODAS recusariam — com o Financeiro escolhendo "pago" (RN-CP-04), a frase literal `Só Marcos Paulo, Walter Galvão Neto move para "pago".` aparece antes do clique e o botão desabilita; com o Aprovador, habilita (casos `d`). Uma conta sem Forma de pagamento entre as selecionadas não bloqueia o lote — a prévia informa "1 de N seria recusada" e "Aplicar" continua habilitado (caso `e`).
- **D3-08 deixa de ser uma operação sem quem a chame.** O card "Aprovação concluída" (`painel-aprovacao.tsx`) ganha um botão "Converter em Conta a pagar" quando a decisão é "aprovada" e a Solicitação está no Status `aprovado`; já convertida, mostra o `readableId` da Conta existente e não oferece converter de novo (T-3-11, caso `n`); aprovada mas ainda no Status anterior, o botão aparece desabilitado nomeando o Status atual (caso `o`); a recusa do domínio (por exemplo, falta de acesso à Solicitação) chega literal ao `report` (caso `p`).
- **A correção de rota do esboço da fase está documentada no código.** O comentário de topo de `contas-view.tsx` agora diz que a ação de lote mora em `bulk-status-bar.tsx` e o relato em `relatorio-de-lote.tsx` — nenhuma linha de código do arquivo mudou.

## Task Commits

1. **Task 1: BulkStatusBar chama `alterarStatusEmLote` uma vez** — `c33a37f` (feat)
2. **Task 2: `RelatorioDeLotePainel` + wiring da página + comentário de `contas-view.tsx`** — `9814117` (feat)
3. **Task 3: gatilho de D3-08 em `painel-aprovacao.tsx`** — `58ea740` (feat)
4. **Ajuste: concordância verbal na frase do erro do servidor** — `558680d` (fix)
5. **Task 4: checkpoint bloqueante de produção (lote de 61 contra o banco real)** — sem commit de código; PARADA (ver seção própria abaixo)

**Plan metadata:** o commit `docs(03-13): …` (SUMMARY + STATE + ROADMAP + REQUIREMENTS), logo depois deste.

## Files Created/Modified

- `apps/web/src/features/estrutura/relatorio-de-lote.tsx` *(criado)* — `RelatorioDeLotePainel`: os quatro resultados de `ItemDeLote`, `parcial` em bloco próprio, sem acesso a Tarefa
- `apps/web/src/features/estrutura/bulk-status-bar.test.tsx` *(criado)* — casos `(a)`…`(k)`: uma chamada só, argumentos certos, teto do lote, prévia por Membro/Status, recusa parcial não bloqueia, `changeTaskStatus` ausente do caminho de lote, os quatro números do relatório, `parcial` com as duas metades, T-3-55, sobrevivência ao fim da seleção, erro do servidor mais recente que o relatório
- `apps/web/src/features/estrutura/bulk-status-bar.tsx` — o laço de `changeTaskStatus` vira uma chamada de `alterarStatusEmLote`; prévia de recusa; teto do lote; nova prop `onRelatorio`
- `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx` — estado `relatorioDeLote` fora do condicional de seleção; `onRelatorio` ligado às duas montagens de `BulkStatusBar`; `RelatorioDeLotePainel` renderizado no topo de `CorpoDeTela`; `onAbrirConta` ligado a `openTask`
- `apps/web/src/features/estrutura/financeiro/contas-view.tsx` — só o comentário do topo (correção de rota); nenhuma linha de código
- `apps/web/src/features/tarefa/painel-aprovacao.tsx` — o gatilho de D3-08: bloco de conversão dentro do card decidido, três apresentações mutuamente exclusivas
- `apps/web/src/features/tarefa/painel-aprovacao.test.tsx` — describe novo "Conversão em Conta a pagar (D3-08)" com os casos `(l)`…`(p)`; nenhum caso preexistente editado

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: o relatório mora na página, não na barra; `RelatorioDeLotePainel` não recebe Tarefa por desenho (T-3-55); "Aplicar" só desabilita no lote inteiro sendo recusado; o gatilho de D3-08 é botão no card de Aprovação, não Automação nem elemento de `contas-view.tsx`.

## Deviations from Plan

### Ajustes durante a execução (não Rule 1-3 — achados de teste/fixture)

**1. [Achado de fixture] Caso (e): a conta incompleta do seed está sem Forma de pagamento, não sem Valor**

- **Found during:** Task 1, escrevendo o caso `(e)`
- **Issue:** o enunciado do plano descreve "uma conta sem Valor entre as selecionadas"; a fixture real do seed usada (`tsk_cp_ferramenta`, já presente em `seed-financeiro.ts` com o comentário "Sem forma de pagamento: não sai de 'para pagar'") tem Valor preenchido e Forma de pagamento ausente
- **Fix:** o teste usa a fixture real como está, documentando a divergência em comentário; RN-CP-02 recusa pelo mesmo mecanismo (requisito de saída de "para pagar" não atendido), então a prova do comportamento (`1 de N seria recusada`, "Aplicar" continua habilitado) permanece válida para o que o caso realmente testa
- **Files modified:** `apps/web/src/features/estrutura/bulk-status-bar.test.tsx`
- **Commit:** `c33a37f`

**2. [Achado de contrato] `evoluirConfiguracaoDeSolicitacoes` não cria Tarefas fictícias**

- **Found during:** Task 3, escrevendo `montarSolicitacaoAprovada`
- **Issue:** a leitura inicial presumiu (pelo nome do parâmetro `tasksPerListMinimo`) que o evolver criaria Tarefas de exemplo na Lista de Solicitações; na verdade esse parâmetro eleva só `state.workspace.limits.tasksPerList` (um limite de configuração), e o evolver materializa apenas Status/Campos/Papéis/Grant — nenhuma Tarefa
- **Fix:** os testes `(l)`…`(p)` criam a Solicitação com `createTask(state, CP.financeiroId, { listId: LISTA_SOLICITACOES, ... })`, no mesmo molde que `conversao-de-solicitacao.test.ts` (domínio, 03-06) já usa para o mesmo propósito
- **Files modified:** `apps/web/src/features/tarefa/painel-aprovacao.test.tsx`
- **Commit:** `58ea740`

**3. [Decisão de organização de commit] Task 1 e o arquivo de teste**

- O arquivo `bulk-status-bar.test.tsx` foi escrito de uma vez cobrindo os casos `(a)`…`(k)` (Task 1 e Task 2 juntas), porque os casos `(g)`…`(k)` montam `RelatorioDeLotePainel` diretamente e o arquivo só compila com o componente já existindo. O commit da Task 1 traz só `bulk-status-bar.tsx`; o arquivo de teste inteiro foi commitado junto da Task 2, ao lado de `relatorio-de-lote.tsx`. Nenhuma linha de comportamento fica sem prova — só o agrupamento de commit reflete a dependência real entre os dois arquivos.

---

**Total deviations:** 2 achados de teste/contrato (não bugs, não escopo novo) + 1 decisão de organização de commit.
**Impact on plan:** nenhum sobre o objetivo do plano. As duas correções tornam os testes mais precisos sobre o estado real do seed/evolver, no mesmo espírito que 03-15 já registrou para o próprio caso `(d)`.

## Issues Encountered

Nenhum bloqueio de código. As únicas fricções foram de descoberta (ver Deviations acima) — resolvidas lendo o seed/evolver reais em vez de presumir do texto do plano.

## Task 4 — Checkpoint bloqueante de produção — PARADA

Task 4 (`gate="blocking"`, `checkpoint:human-verify`) pede: subir `apps/api` e `apps/web` contra o Supabase real da plataforma (`epomplsskqpluxuujpxl`), autenticar como `mem_maryane` (Financeiro) e como `mem_marcos_paulo`/`mem_walter` (Aprovador), fechar um lote de dezenas de contas em cada metade, inspecionar a aba de rede (exatamente 1 `POST /operacoes/alterarStatusEmLote` por gesto), ler `revisao` antes/depois no Postgres, conferir as 61 ocorrências de A1 nascendo na Lista, repetir o mesmo lote e confirmar o no-op, provocar um `parcial` e avaliar se o texto é legível, testar o teto de 200, e converter uma Solicitação de verdade pela tela.

**Isto não é alcançável nesta execução, e a Task não foi fabricada:**

1. `apps/api/.env` existe no repositório, mas o sistema de permissões desta sessão nega qualquer comando que referencie o arquivo (`cat`, `grep`, `wc` — todos bloqueados, confirmado nesta rodada) — não há como ler `DATABASE_URL`/segredos de produção para subir `apps/api` com a configuração real.
2. Não há browser nesta sessão para autenticar via Supabase Auth como `mem_maryane`/`mem_marcos_paulo`/`mem_walter`, nem para inspecionar a aba de rede.
3. Não há acesso a VPS/produção — mesma família de bloqueio já registrada para 03-07 (Task 4), 03-08 (identidade de produção), 03-10 (Task 4), 03-11 (Task 3) e 03-15 (Task 3) em `STATE.md`.

**O que FOI verificado, como substituto honesto e mais fraco (não substitui a Task 4):**

- Os 12 casos de `bulk-status-bar.test.tsx` e os 5 casos novos de `painel-aprovacao.test.tsx` provam, com `Transporte` falso e `StoreProvider` de verdade — nunca com afirmação inventada —, que a tela manda UMA chamada, com os argumentos certos, e que o relato dos quatro resultados é legível, para um lote de 61 e para os cenários de recusa/prévia/parcial.
- `npm run typecheck`/`lint`/`verificar:tokens` verdes nos três workspaces (ver tabela abaixo); `npm run test -w @n1/api` rodou contra o Supabase real da plataforma (`DATABASE_URL` carregado do `.env` do workspace pelo próprio `vitest`, sem que este executor tivesse lido o segredo) — o mesmo caminho que 03-15 já usou.
- O contrato que esta tela consome (`alterarStatusEmLote`, `RelatorioDeLote`) já foi provado de ponta a ponta contra o Postgres real em 03-12 (e2e, 6 casos, `ws_lote_teste`) — o que falta aqui é a prova de que ESTA tela, com login real, produz o mesmo resultado.

**O que continua pendente, exatamente como a Task 4 pede:**

- As duas leituras de `revisao` (antes/depois de cada metade) contra `ws_n1`.
- A contagem de `POST /operacoes/*` na aba de rede de um navegador real.
- As 61 Tarefas novas de A1 aparecendo na Lista depois do fechamento em "pago".
- A repetição do mesmo lote confirmando `alteradas: 0`/`jaEstavam: 61`/`ocorrenciasCriadas: 0`.
- A avaliação humana de legibilidade do bloco `parcial` por quem opera.
- A conversão de uma Solicitação real pela tela, com login real.

**Achado herdado, não novo:** as pendências de produção de 03-07/03-08/03-10/03-11/03-13/03-15 convergem no mesmo acesso (VPS + credenciais reais). Um único runbook de verificação humana, executado uma vez com todo o acesso necessário, provavelmente fecha todas de uma vez.

## Verificação do portão (CON-05)

| Etapa | Resultado |
|---|---|
| `typecheck` (dominio, api, web) | 0 nos três workspaces |
| `lint` (`@n1/web`) | 0 |
| `verificar:tokens` (`@n1/web`) | 392 definidos · 213 arquivos · 0 falhas |
| `test -w @n1/web -- bulk-status-bar.test.tsx` | 12/12 passed (casos a-k) |
| `test -w @n1/web -- painel-aprovacao.test.tsx` | 16/16 passed (11 preexistentes + 5 novos, l-p) |
| `test -w @n1/web` (suíte inteira) | 140/140 passed (13 arquivos) |
| `test -w @n1/dominio` | 465/465 passed (sem diff nesta rodada) |
| `test -w @n1/api` (com `DATABASE_URL`, Supabase real) | ver nota abaixo |

**Nota sobre `test -w @n1/api`:** `git diff --quiet packages/dominio apps/api` está confirmado limpo — nenhuma linha dessas duas camadas mudou nesta rodada, então este plano não pode ter introduzido regressão ali. A suíte foi disparada em segundo plano contra o Supabase real da plataforma (mesmo caminho que 03-15 já usou: `DATABASE_URL` carregado do `.env` do workspace pelo próprio `vitest`, sem que este executor tivesse lido o segredo) e ainda estava em execução — sem erro, sem crash, CPU quase ociosa (consistente com espera de rede, não travamento) — quando este SUMMARY foi fechado, tendo ultrapassado os ~16 min (974s) que 03-12 mediu como o pior caso já observado para esta suíte contra o pooler remoto. Referência mais recente e confiável: 03-15 registrou **475 passed / 12 skipped / 1 timeout pré-existente** (o caso de medição de `DEC-06` em `lote-contas-a-pagar.test.ts`, já documentado em `deferred-items.md`, fora de qualquer arquivo tocado por este plano). Recomendação para quem retomar: rodar `npm run test -w @n1/api` isolado (fora do teto de 600s desta ferramenta) para confirmar o número atual.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano. T-3-55 (arquivo sem Tarefa), T-3-56 (reexecução — a guarda real é o `jaEstava` de 03-12, esta tela só para de reoferecer o que já fechou), T-3-57 (teto do lote), T-3-58 (`parcial` legível), T-3-59 (RN-CP-04 antes do clique), T-3-60 (barril instrumentado) e T-3-61 (erro do servidor mais recente que o relatório) estão mitigadas, cada uma com caso de teste nomeado. T-3-SC: nada foi instalado nesta rodada (`@n1/dominio`, `zustand`, `lucide-react`, `@testing-library/react`, `vitest` já estavam em `apps/web/package.json`).

## Known Stubs

Nenhum. As três telas (barra de lote, painel de relatório, gatilho de conversão) são funcionais de ponta a ponta contra um `Transporte` falso — o que falta é a prova com `apps/api`/`apps/web` reais e login real (Task 4, PARADA).

## Next Phase Readiness

- **PAG-05 fechado na tela.** A metade que faltava desde 03-12 (`REQUIREMENTS.md`: "o gesto na tela é 03-13") está feita: `BulkStatusBar` chama a operação de lote uma vez, `RelatorioDeLotePainel` mostra o resultado.
- **D3-08 deixa de ser uma operação órfã.** O critério 1 da Fase 3 ("uma semana sem abrir o ClickUp") ganha o gatilho que faltava desde 03-06.
- **Achado a propagar para o orquestrador, herdado do próprio texto do plano (não descoberto por este executor):** a Pessoa da conta enxerga a Tarefa pelo domínio depois de 03-05, mas `[lista]/page.tsx:165-169` fecha a Lista para quem não passa em `memberReachesContainer` — ela não tem por onde chegar na interface. É PAG-06 (03-05/03-15), não PAG-05; este plano não o corrige e não o contradiz.
- **Task 4 parada** — mesma família de pendência de produção que 03-07/03-08/03-10/03-11/03-15. Um runbook único de verificação humana com acesso real (VPS + credenciais + browser) provavelmente fecha as seis pendências de uma vez: as duas leituras de `revisao`, a aba de rede, as 61 ocorrências de A1, o no-op da repetição, a legibilidade humana do bloco `parcial`, e a conversão real de uma Solicitação.
- **03-14 (wave 5, PAG-03)** não tem SUMMARY nesta árvore ainda — não é pré-requisito deste plano (`depends_on: [03-12]` apenas) e nenhum arquivo dele foi tocado.

## Self-Check: PASSED

Os sete arquivos de `key-files` existem em disco (`relatorio-de-lote.tsx`, `bulk-status-bar.test.tsx`, `bulk-status-bar.tsx`, `[lista]/page.tsx`, `contas-view.tsx`, `painel-aprovacao.tsx`, `painel-aprovacao.test.tsx`); os quatro commits de task (`c33a37f`, `9814117`, `58ea740`, mais o ajuste `558680d`) existem no histórico.

---
*Phase: 03-contas-a-pagar*
*Completed: 2026-09-23*
