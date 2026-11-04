---
phase: 12-clone-clickup-grava-o-mais-r-pida
verified: 2026-11-02T21:10:00Z
status: human_needed
score: 6/6 requisitos atendidos pelo critério escrito; objetivo atingido em parte (ver "Veredito sobre o objetivo")
covered_files:
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-01-PLAN.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-01-SUMMARY.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-02-PLAN.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-02-SUMMARY.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-03-PLAN.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-03-SUMMARY.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-04-PLAN.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-04-SUMMARY.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-05-PLAN.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-05-SUMMARY.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-06-PLAN.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-06-SUMMARY.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-07-PLAN.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-07-SUMMARY.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-08-PLAN.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-08-SUMMARY.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-09-PLAN.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-09-SUMMARY.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-10-PLAN.md
  - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-10-SUMMARY.md
  - apps/api/src/observabilidade/medicao-da-gravacao.ts
  - apps/api/src/observabilidade/medir-gravacao.cli.ts
  - apps/api/src/observabilidade/medir-gravacao.ts
  - apps/api/src/persistencia/regime-dos-chamadores.test.ts
  - apps/api/src/persistencia/repositorio.ts
  - apps/api/src/persistencia/unidade-de-trabalho-concorrencia.test.ts
  - apps/api/src/persistencia/unidade-de-trabalho-trava.test.ts
  - apps/api/src/persistencia/unidade-de-trabalho.ts
  - apps/api/src/rotas/operacoes-medicao.test.ts
  - apps/api/src/rotas/operacoes.ts
  - apps/web/src/dados/guarda-de-navegacao.ts
  - apps/web/src/dados/operacoes-que-esperam.ts
  - apps/web/src/dados/store.test.ts
  - apps/web/src/dados/store.ts
  - apps/web/src/dados/transporte.ts
  - apps/web/src/features/shell/app-shell.tsx
  - apps/web/src/features/shell/linha-da-arvore.tsx
covered_digest: "v3:sha256:eb60ada77cdab515fe4320335fe5b8c435dd703552de381702b2d72518854121"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Mesclar o PR #3 (https://github.com/n1-tecnologia/crm/pull/3), publicar a web e, na tela de produção, criar uma Lista e olhar a árvore"
    expected: "A Lista aparece na hora, com visual de 'Salvando…' e sem link, e vira link normal logo depois da resposta; uma Lista recusada pelo servidor some e o erro aparece"
    why_human: "O 'mostrar na hora' é o único ganho da fase que o usuário sente, e está provado só em jsdom com transporte falso. A web nova NÃO está em produção (PR #3 aberto). Nenhum teste enxerga o navegador real."
  - test: "Na mesma tela, com uma gravação a caminho, tentar fechar/recarregar a aba e clicar (clique simples, cmd/ctrl+clique, Enter) numa âncora de item ainda 'Salvando…'"
    expected: "O navegador pergunta antes de sair; o clique no item pendente é cancelado e não leva a uma página de id inexistente"
    why_human: "O diálogo nativo do beforeunload e o clique real em Chrome e Safari só existem no navegador; os testes cobrem o código (guarda-de-navegacao.test.tsx), não o comportamento do navegador."
  - test: "Depois do deploy da web, criar uma Lista num Espaço seu e, por ssh na VPS como n1crm, rodar sudo -n /usr/bin/journalctl --no-pager -u n1-crm-api.service -n 200 filtrado por 'gravacao medida'; colar UMA linha em 12-PROVAS.md"
    expected: "Uma linha com \"regime\":\"travado\", \"tentativas\":1 e o nome da operação, sem e-mail nem nome de registro"
    why_human: "D-03 no serviço real nunca foi observado (o grep voltou vazio nas duas rodadas). A linha está provada por teste (operacoes-medicao.test.ts) e pelo comando em loopback, não pelo caminho HTTP real. Exige produção/ssh."
  - test: "Decidir se o resultado medido satisfaz 'b-ganho-basta': o pedido isolado ficou 11% a 17% MAIS LENTO (a trava custa uma ida e volta, cerca de 51 ms); o ganho da fase está na tela (não medido em navegador) e sob concorrência (provado só em Postgres local)"
    expected: "O dono aceita o resultado como está, OU manda recuperar a ida e volta (opções b1/b2 do Pitfall 9 em 12-PROVAS.md, cerca de 51,4 ms por gravação)"
    why_human: "A decisão b-ganho-basta foi dada ANTES de existir o 'depois'. Só o dono pode dizer se um pedido isolado mais lento, compensado por tela imediata e por menos repetição sob disputa, é o ganho que ele queria."
  - test: "Triar os 7 avisos de 12-REVIEW.md (WR-01 a WR-07) antes de publicar a web, em especial WR-01, WR-02, WR-03 e WR-05"
    expected: "Cada um fica corrigido, adiado com motivo ou aceito (hoje os 11 achados estão 'open' em 12-REVIEW-DISPOSITION.md)"
    why_human: "São decisões de risco do dono (prazo de rede na fila serial, re-hidratação após falha, ações sobre item 'Salvando…'); não invalidam o critério escrito de nenhum requisito, mas afetam o que vai ao ar."
---

# Fase 12: Verificação — Clone ClickUp: gravação mais rápida

**Objetivo da fase:** medir quanto leva uma gravação (hoje cada uma hidrata o Espaço de Trabalho inteiro e disputa uma revisão única) e cortar o custo onde ele está (Sessão 2, parte C, tarefa 2.2 do cronograma; caminho B da 2.2.2).
**Verificado em:** 2026-11-02
**Status:** `human_needed`
**Re-verificação:** não, verificação inicial.

## Veredito sobre o objetivo

O objetivo tem duas metades, e elas não têm o mesmo resultado.

1. **"Medir": atingido, com evidência.** A medição existe no código, está sempre ligada, não vaza para o corpo da resposta, e o mesmo comando (`gravacao:medir`) produziu o "antes" (SHA `5a74ee7`) e o "depois" (SHA `37c1cab`) em produção, contra o banco real do `ws_n1`. Os números estão em `12-PROVAS.md`, com a leitura de onde o custo está: `hidratar` ≈ 150 ms, `gravar` ≈ 105 ms e cinco etapas de ida e volta de ≈ 51,5 ms cada (VPS ↔ banco em `us-west-2`).
2. **"Cortar o custo onde ele está": atingido em parte, e não na dimensão que a medição mede.**
   - O caminho B foi **construído** como planejado: trava no começo com dois regimes, `gravar` devolvendo a lista de respostas, `data`/`confirmado` com fila serial, lista de exceções, "salvando" e guarda de navegação. Li o código; não é esqueleto.
   - Mas a medição de pedido isolado (a única que existe em produção) mostra o custo **subindo**, não caindo: `pedidoMs` mediano +60,9, +80,2, +88,3 e +75,5 ms (+11% a +17%) nos quatro gestos. A trava é uma instrução a mais (`travaMs` de ≈ 51,8 para ≈ 103 ms). `hidratar` continua sendo a maior etapa (≈ 160 ms) e não foi reduzido; o caminho B não o ataca por desenho.
   - O ganho que sobra está em duas coisas **que a medição não captou**: (a) a mudança aparece na tela antes da resposta, provado só em jsdom e **ainda não em produção** (a web nova não foi publicada); (b) sob concorrência, uma tentativa em vez de até três, provado só em Postgres local.
   - A decisão do dono foi `b-ganho-basta`, sem número de meta. Pelo critério literal de GRV-06 isso fecha: a tabela existe e foi comparada. Mas a decisão foi dada com só o "antes" na mão. O "depois" disse "não bateu" nos quatro gestos para o pedido isolado, e `12-PROVAS.md` registra isso com honestidade. É por isso que o status não é `passed`.

Não classifiquei isso como `gaps_found` porque (i) nenhum requisito GRV-01..06 pede redução do tempo do pedido isolado; (ii) o dono fixou expressamente "o ganho que o B der basta, sem alvo numérico"; (iii) o custo extra está medido, explicado e com saída documentada (Pitfall 9, opções b1/b2). Se o dono entender que "ganho" exige melhora no servidor, o resultado muda para lacuna: recuperar a ida e volta da trava.

## Verdades observáveis

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | Cada gravação por `POST /operacoes` escreve no log o nome da operação e o tempo de `hidratar`, operação, trava, `gravar`, recorte, tentativas e linhas lidas, e a medição não aparece no corpo | VERIFICADO | `unidade-de-trabalho.ts:328-351` (`aoMedir` em `finally`, engole exceção); `rotas/operacoes.ts:327-331` escreve `request.log.info({ operacao, medicao }, "gravacao medida")`. `operacoes-medicao.test.ts` roda (6 casos: 200, recusa, 409, 500, inviteMember, 400/403/404) e afirma corpo sem `medicao`. |
| 2 | O comando `gravacao:medir` repete os quatro gestos 10 vezes e imprime mediana e pior caso por etapa, mais o total do pedido | VERIFICADO | Script `gravacao:medir` em `apps/api/package.json:35`; `medir-gravacao.cli.ts`, `medir-gravacao.ts`, `medicao-da-gravacao.ts` (332 linhas) existem e são lidos por `medir-gravacao.test.ts`/`medicao-da-gravacao.test.ts` (passam). Saída real colada em `12-PROVAS.md` (antes e depois, 10 amostras por gesto, `desfechos: gravou 10`). |
| 3 | A tabela "antes" e o tamanho real de `plataforma.registros` estão em `12-PROVAS.md` | VERIFICADO | § "Tamanho de `plataforma.registros` (D-05)": 4601 registros, 2415,1 KB; `activity` + `tasks` = 91% do volume. |
| 4 | A parada `[BLOCKING]` aconteceu com a tabela na mão do dono; a meta está em `12-CONTEXT.md` antes da 2.2.3; `hidratar` > 300 ms dispararia a sessão C | VERIFICADO | `12-CONTEXT.md` § "Meta (fixada na parada)" tem a frase exata do dono; `hidratar` direto 147,5 ms (antes) e 186,6 ms (depois), ambos < 300 ms; o ROADMAP não tem fase nova (conferido: nenhuma fase depois da 12). Ressalva: o dono não digitou o nome da opção, aceitou a recomendação (registrado sem paráfrase). |
| 5 | Duas `executar()` simultâneas no mesmo Espaço gravam com uma tentativa cada e `hidratar` roda exatamente 2 vezes | VERIFICADO | **Rodei** `unidade-de-trabalho-concorrencia.test.ts` num Postgres 16 descartável meu (contêiner removido depois): 5/5 passaram, não pulados. Cobre travado (2 hidratações, revisões n+1 e n+2), contraste otimista (3 hidratações), mesma entrada duas vezes, trava esgotada em cerca de meio segundo e rollback que solta a trava. |
| 6 | A trava esgotada (`55P03`) vira 409 sem repetir | VERIFICADO | `unidade-de-trabalho.ts:384-394` (conflito como valor, `rollback`, conexão volta ao pool); `tentativas = 1` no travado (linha 292). `unidade-de-trabalho-trava.test.ts` e `operacoes-medicao.test.ts` (caso 409) passam sem banco. |
| 7 | As importações longas seguem no regime otimista; as outras gravações travam | VERIFICADO | `regime: "otimista"` só nos 4 arquivos de importação (grep em `apps/api/src`, fora de testes); `regime-dos-chamadores.test.ts` passa e falha se outro arquivo passar `otimista`. `CONTEXT.md` da persistência descreve os dois regimes (linhas 15-45, 59-72). |
| 8 | Um `run` com duas chamadas aplica as duas diferenças e não chama `hidratar` | VERIFICADO | `store.ts:331-366` aplica as respostas em ordem, cada uma só se `revisaoAnterior` bate; `transporte.ts:178-183` devolve lista de respostas. `store.test.ts` (s) "7→8, 8→9 ... não hidrata (GRV-04)" passa (89/89 em `src/dados`). |
| 9 | `data.lists` já tem a Lista antes de o transporte responder; com `ok: false` ela some e `lastResult.error` traz a mensagem | VERIFICADO | `store.ts:456-505` (`rodarNaCopia`: a cópia vira `data` na hora) e `refazerPendentes`; `store.test.ts` linhas 168, 182, 199 passam. Só em jsdom, ver item humano 1. |
| 10 | Dois `run` seguidos saem um de cada vez, na ordem | VERIFICADO | `store.ts:421-448` (`processarFila`, `emVoo`); `store.test.ts` linhas 361 e 396 passam. |
| 11 | O item criado aparece sem link até confirmado | VERIFICADO (por teste) | `idsNaoConfirmados`, `guarda-de-navegacao.ts` (126 linhas) instalada em `AcompanhanteDaRevisao`; `arvore-salvando.test.tsx`, `tarefa-salvando.test.tsx`, `guarda-de-navegacao.test.tsx` (suíte de 12-08/12-09, `guarda` rodada aqui: passa). Comportamento em navegador real não visto. |
| 12 | A lista de exceções está no código com o motivo de cada uma | VERIFICADO | `operacoes-que-esperam.ts` (70 linhas): 14 operações, cada uma com motivo; `operacoes-que-esperam.test.ts` fecha o conjunto (passa); levantamento em `12-PROVAS.md` § "Operações que esperam o servidor". |
| 13 | A tabela de `12-PROVAS.md` tem "antes" e "depois" com o mesmo comando, e o "depois" comparado à meta de D-08 | VERIFICADO | § "Tabela antes/depois" (SHAs `5a74ee7` e `37c1cab`, ambos em produção na VPS, mesmo `npm run gravacao:medir`) e § "Comparação com a meta (D-08)" (meta = `b-ganho-basta`, sem alvo numérico; veredito "não bateu: subiu"). |
| 14 | O corte de custo se verifica em produção (o dono vê a Lista aparecer na hora; a linha D-03 do serviço real tem `regime: travado`) | INCERTO (precisa de humano) | Web não publicada (PR #3 aberto); grep de `gravacao medida` no journal voltou vazio; "Conferência do dono na tela: NÃO FEITA" em `12-PROVAS.md`. |

**Pontuação:** 13 de 14 verdades verificadas por código e teste; 1 incerta (humano). `behavior_unverified: 0`: as verdades de transição/invariante (trava, fila, rollback, 409) têm teste que as exerce, e eu rodei os de API sem banco, os de web e o de concorrência com banco.

## Artefatos

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `apps/api/src/persistencia/unidade-de-trabalho.ts` | Trava no começo, dois regimes, `aoMedir` | VERIFICADO | 528 linhas; `SQL_DA_TRAVA` antes de `hidratar`; `rollback` + `release(falhou)` cobrem todo desvio. |
| `apps/api/src/rotas/operacoes.ts` | Linha `gravacao medida`, sem `medicao` no corpo | VERIFICADO | Linhas 327-375; teste prova o corpo limpo. |
| `apps/api/src/observabilidade/medicao-da-gravacao.ts`, `medir-gravacao.ts`, `medir-gravacao.cli.ts` | Comando de medição | VERIFICADO | Existem, com testes; usados em produção duas vezes. |
| `apps/api/src/persistencia/unidade-de-trabalho-concorrencia.test.ts` | GRV-03 contra Postgres real | VERIFICADO | 5/5 com banco descartável; pula sem banco, como pede o plano. |
| `apps/web/src/dados/store.ts` | `confirmado`/`data`, fila serial, lista de respostas | VERIFICADO (com avisos) | 753 linhas; ver WR-01 a WR-05 abaixo. |
| `apps/web/src/dados/transporte.ts` | `gravar` devolve lista de respostas | VERIFICADO (com aviso WR-07) | Linhas 161-184. |
| `apps/web/src/dados/operacoes-que-esperam.ts` | Exceções com motivo | VERIFICADO | 14 entradas com motivo. |
| `apps/web/src/dados/guarda-de-navegacao.ts`, `features/shell/app-shell.tsx`, `linha-da-arvore.tsx` | "Salvando" e guarda | VERIFICADO (por teste) | Ligados em `AcompanhanteDaRevisao` (`store.ts:620-626`). |
| `apps/api/src/persistencia/CONTEXT.md` | Atualizado | VERIFICADO | Descreve travado/otimista e a trava esgotada. |

## Ligações

| De | Para | Via | Status |
|----|------|-----|--------|
| `rotas/operacoes.ts` | `executar()` | `aoMedir` → `request.log.info` | LIGADO |
| `executar()` | Importações longas | `regime: "otimista"` (4 arquivos) | LIGADO |
| `store.enviar` | `transporte.gravar` | lista de respostas, em ordem | LIGADO |
| `store.rodarNaCopia` | `OPERACOES_QUE_ESPERAM` | `otimistaPara(chamadas)` | LIGADO |
| `AcompanhanteDaRevisao` | `beforeunload` e guarda de âncora | `useEffect` com cleanup | LIGADO |
| Web nova | Produção | PR #3 | **NÃO LIGADO** (aberto) |

## Fluxo de dados (nível 4)

O `data` que a tela lê vem de `rodarNaCopia`/`refazerPendentes` sobre `confirmado`, e `confirmado` vem de `GET /estado` ou da diferença do servidor: dados reais, nada estático. A medição vem de `performance.now()` por etapa, acumulada por tentativa. Nenhum valor vazio fixo no caminho.

## Cobertura dos requisitos

Os seis IDs aparecem nos PLAN (01 e 02 → GRV-01; 03 → GRV-02; 04 → GRV-03; 05 → GRV-04; 06 a 09 → GRV-05; 10 → GRV-06), todos presentes em `REQUIREMENTS.md`. Nenhum órfão.

| Requisito | Plano | Status | Evidência e ressalva |
|-----------|-------|--------|----------------------|
| GRV-01 | 12-01, 12-02 | ATENDIDO no critério escrito; **linha D-03 do serviço real em aberto** | Log por etapa, corpo limpo e comando: verificados (verdades 1 a 3). O critério não exige a linha do serviço real, mas ela nunca foi vista em produção. Atenção: `REQUIREMENTS.md:185` termina com "Pendente." enquanto a caixa está `[x]` e a tabela de rastreio diz Complete: texto desatualizado, a corrigir. |
| GRV-02 | 12-03 | ATENDIDO | Verdade 4. |
| GRV-03 | 12-04 | ATENDIDO | Verdades 5 a 7; teste de banco rodado por mim. Em produção a concorrência nunca foi exercitada. |
| GRV-04 | 12-05 | ATENDIDO | Verdade 8. |
| GRV-05 | 12-06 a 12-09 | ATENDIDO no critério escrito (testes); **depende do dono em produção** | Verdades 9 a 12. Os avisos WR-01 a WR-05 não derrubam nenhum item do critério, mas afetam a robustez do mesmo código. |
| GRV-06 | 12-10 | ATENDIDO no critério escrito | Verdade 13. A comparação com a meta registra "não bateu: subiu" para o pedido isolado, o que o dono precisa aceitar (item humano 4). Fecho do plano 12-10 pendente de dois itens do dono. |

## Itens do 12-REVIEW.md: algum invalida requisito?

Li o código que cada aviso cita. **Os sete procedem como descritos, mas nenhum derruba o critério escrito de um requisito**, porque os testes de GRV-04/05 cobrem o caminho feliz e as recusas, não estes defeitos. Dois deles contradizem a promessa de projeto da fase e merecem decisão antes de publicar a web:

| ID | Procede? | Efeito no requisito |
|----|----------|--------------------|
| WR-01 | Sim: `store.ts:397-403` o `catch` genérico não re-hidrata; `aplicarDiferenca` muta `confirmado` em lugar antes do `set` | Não invalida GRV-05. Fere a invariante "o cliente nunca fica com estado que o servidor não tem" (D-14). Risco real, caminho raro (corpo malformado ou diff inconsistente). |
| WR-02 | Sim: `store.ts:341` e `hidratarAgora` (297) retornam em silêncio se a rede falha ou a revisão é menor | Idem. Uma gravação já confirmada some da tela até o próximo poll de 5 s, e `runConfirmado` recebe `ok: true`. |
| WR-03 | Sim: `transporte.ts:117,192` sem prazo; a fila de `processarFila` espera cada `enviar` inteiro | **O mais relevante.** Introduz uma regressão de resiliência que não existia antes de D-16 (cada gravação era independente): um `fetch` pendurado trava todas as gravações e o poll. Não é critério de nenhum GRV. |
| WR-04 | Sim: o ramo `gravar` do laço não tem `try/catch` | Não invalida; exige `set`/`structuredClone` lançar. |
| WR-05 | Sim, e aparece também na UI: ações de status ficam ativas em linha "Salvando…" | Não invalida D-15 (que fala de abrir/navegar), mas deixa uma pendente agir sobre id local que pode divergir. |
| WR-06 | Sim: o `update` otimista segura a linha até o `commit` | Não invalida D-10; a janela é de importação manual. Documentar. |
| WR-07 | Sim, latente: nenhuma tela faz duas chamadas por `run` hoje | Não invalida GRV-04 (o teste (w) cobre recusa na segunda), mas o comentário do transporte promete parar na primeira que não for `diferenca` e uma recusa de domínio chega como `diferenca`. |
| IN-01 a IN-04 | Não verifiquei um a um | Informativos; não afetam requisito. |

`12-REVIEW-DISPOSITION.md` mostra os 11 achados como `open`: nenhum foi triado.

## Verificações que rodei

| O que | Como | Resultado |
|-------|------|-----------|
| API sem banco | `DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` em `operacoes-medicao`, `unidade-de-trabalho-trava`, `unidade-de-trabalho-concorrencia`, `regime-dos-chamadores`, `medicao-da-gravacao`, `medir-gravacao` | 5 arquivos passaram, 1 pulado (o de concorrência, que exige banco); 53 testes passaram, 14 pulados |
| Concorrência com banco | Contêiner `postgres:16` próprio na porta 55624, comando documentado no cabeçalho do teste; contêiner removido ao fim (confirmado) | `unidade-de-trabalho-concorrencia.test.ts`: 5/5 passaram |
| Web | `npx vitest run src/dados/store.test.ts operacoes-que-esperam.test.ts transporte.test.ts guarda-de-navegacao.test.tsx` | 4 arquivos, 89 testes passaram |
| Domínio e schema | `git diff --stat 2924973..HEAD -- packages/dominio apps/api/migracoes` | Vazio: domínio e banco intactos, como a fase prometia |
| Marcadores de dívida | `grep TBD|FIXME|XXX` nos arquivos de `apps/` alterados na fase | Nenhum |

Não rodei o `npm run check` inteiro nem os testes de tela de 12-06 a 12-09 além de `guarda-de-navegacao`; confiei, para eles, no registro de 12-10 (verde na terceira rodada, com ruído conhecido em `outbox-worker.test.ts`). Não toquei em produção, em `.env*`, nem em código.

## Antipadrões

| Arquivo | Padrão | Gravidade | Impacto |
|---------|--------|-----------|---------|
| `apps/web/src/dados/store.ts` | `catch` genérico sem re-hidratar; fila serial sem prazo (WR-01, WR-03) | Aviso | Robustez da fila nova; não bloqueia requisito |
| `apps/web/src/dados/transporte.ts` | `fetch` sem `AbortSignal` | Aviso | Alimenta WR-03 |
| `.planning/REQUIREMENTS.md:185` | "Pendente." num requisito marcado `[x]` | Info | Documento desatualizado |

## Resumo das lacunas e pendências do dono

Nenhum requisito falha no seu critério escrito, então não há `gaps_found`. O que impede `passed`:

1. **Produção da web:** o PR #3 está aberto (traz a Fase 11 junto) e a API (`37c1cab`) está à frente da `main`. Enquanto a web nova não sobe, o único ganho que o usuário sente não existe em produção.
2. **Conferência visual em navegador:** "salvando", sem link, clique cancelado e aviso ao fechar a aba nunca foram vistos fora de jsdom.
3. **Linha D-03 do serviço real:** nunca observada.
4. **Aceite do resultado medido:** pedido isolado 11% a 17% mais lento. Recuperar a ida e volta da trava (opções b1/b2, ≈ 51,4 ms por gravação) é decisão do dono e continua não implementada.
5. **Triagem dos avisos do code review**, em especial WR-03 (fila sem prazo) antes de publicar a web.
6. **Higiene:** corrigir o "Pendente." em `REQUIREMENTS.md:185`; os Espaços `ZZ-MEDICAO-*` ficaram na lixeira do `ws_n1`.

Itens fora do escopo e já registrados como adiados em `12-CONTEXT.md`: o empurrão entre telas abertas (3.8 "Tempo real", D-12), o caminho A e a sessão C. Nenhuma fase posterior existe no ROADMAP para absorvê-los, então não os tratei como "deferred" formais.

---

_Verificado: 2026-11-02_
_Verificador: Claude (gsd-verifier)_
