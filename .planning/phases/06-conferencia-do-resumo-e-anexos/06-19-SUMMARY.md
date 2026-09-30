---
phase: 06-conferencia-do-resumo-e-anexos
plan: 19
subsystem: packages/dominio + apps/api (ponte) + apps/web (card, diálogo e jornada)
tags: [conferencia-do-resumo, gap-closure, lancamento-em-curso, g3, orcamento, jornada]

requires:
  - phase: 06-18
    provides: "decisionWaiver, dispensarConferenciaDoResumo, podeDecidirAConferencia, respostaSemEfeitoNoFio, conferenciaDoReaproveitado"
  - phase: 06-13
    provides: "a porta G3 do começo do ciclo, o orçamento de gravações, a recuperação por falha de banco, PADROES_DAS_PARADAS"
  - phase: 06-12
    provides: "motivoParaNaoLancar, a releitura antes do /lancar"
provides:
  - "lancamentoEmCursoDe, PRAZO_DO_LANCAMENTO_EM_CURSO_MS, RECUSA_LANCAMENTO_EM_CURSO, REGISTRO_* e PREFIXO_LANCAMENTO_HUMANO na base (reexportados por financeiro.ts)"
  - "marcarLancamentoEmCurso e encerrarLancamentoEmCurso (fora de OPERACOES); avisarEstrito; TEXTOS_DA_CONFERENCIA.recusaAvisarInativo"
  - "changeTaskStatus e addTaskComment recusam a outro Membro enquanto o Agente lança"
  - "ponte: marca antes do /lancar com reconferência na gravação, encerramento em todo desfecho, SEM_EFEITO, G3 estrito no meio do ciclo, cursor, continuação com espera, desistência do Comentário pendente"
  - "tela: o card avisa e o diálogo \"Lançado no Omie\" recusa enquanto a marca vale"
  - "jornada: cenário cp-dispensa-manual; sem pedirAjustePeloCard"
affects: [06-20]

tech-stack:
  added: []
  patterns:
    - "marca de trabalho em curso como Registro de Atividade (não campo da Tarefa), com prazo e encerramento por Registro"
    - "recusa sentinela (SEM_EFEITO) para a Unidade de Trabalho desfazer sem subir a revisão"
    - "a porta de teste conferida dentro de cada gravação, não só no começo do ciclo"

key-files:
  created:
    - packages/dominio/src/operations/lancamento-em-curso.test.ts
    - packages/dominio/src/operations/avisar-estrito.test.ts
    - apps/api/src/automacoes/ponte-lancamento-em-curso.test.ts
    - apps/api/src/automacoes/ponte-g3-e-orcamento.test.ts
    - apps/web/src/features/tarefa/lancamento-em-curso-tela.test.tsx
  modified:
    - packages/dominio/src/operations/financeiro-base.ts
    - packages/dominio/src/operations/financeiro-textos.ts
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/automacoes/invocar-agente.ts
    - apps/api/src/automacoes/invocar-agente.test.ts
    - apps/api/src/automacoes/ponte-ciclo.test.ts
    - apps/api/src/automacoes/ponte-lancar-fresco.test.ts
    - apps/api/src/automacoes/ponte-reaproveitado-conferido.test.ts
    - apps/api/src/automacoes/CONTEXT.md
    - apps/api/src/persistencia/CONTEXT.md
    - apps/web/src/features/tarefa/lancamento-no-omie-dialog.tsx
    - apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx
    - apps/web/scripts/jornada-financeiro.mjs

key-decisions:
  - "A marca \"Lançamento no Omie em curso\" é Atividade do Agente em nome do Membro de serviço; vale até \"Lançado no Omie\", \"Lançamento no Omie falhou\", \"Lançamento no Omie interrompido\" ou 5 min"
  - "As recusas moram em changeTaskStatus e addTaskComment: a mesma regra na tela e no endpoint; quem marcou passa"
  - "Na gravação da marca, a impressão é conferida ANTES de motivoParaNaoLancar — senão IMPRESSAO_MUDOU nunca aconteceria (desvio aceito pelo orquestrador)"
  - "No conflito do registro ainda em repetição e no erro de banco depois do 200, a marca FICA (o título existe; a repetição a renova e registra)"
  - "Duas exceções a CON-05 além das quatro nomeadas (ponte-ciclo (g) bloco 4 e ponte-reaproveitado-conferido (n)), autorizadas pelo orquestrador: a marca virou a primeira gravação antes do /lancar"
  - "A tela não limpa Campo de escolha única: a jornada desmarca \"Integração manual\" trocando o valor da gravação por null (pagina.route)"

requirements-completed: [RES-01, RES-03]

duration: ~3 h (com a pausa no checkpoint)
completed: 2026-09-30
---

# Phase 6 Plan 19: marca de lançamento em curso, G3 no meio do ciclo, orçamento justo — Summary

**Antes de cada `/lancar`, a ponte grava a marca "Lançamento no Omie em curso" e, na mesma gravação, confere de novo se a conta pode ser lançada. Enquanto a marca vale, ninguém mais move a conta nem registra o lançamento à mão: a tela avisa, e a recusa é a mesma no endpoint. A marca sai em todo desfecho. A porta G3 falha fechada também no meio do ciclo. O orçamento de gravações não deixa conta sem vez nem gira sem espera. A jornada ganhou o cenário `cp-dispensa-manual`, que 06-20 usa para provar crm2:CR-01 sem tocar no Omie.**

## Ponto de partida

- `HEAD 196599b`, branch `integra-frontend-main`, `git status --short` limpo; `readlink node_modules/@n1/dominio` = `../../packages/dominio`.
- Linha de base: domínio 973/973 (64 arquivos); web 272/272 (28 arquivos); api por arquivo, `DATABASE_URL=` (ver a tabela de números).
- `06-18-SUMMARY.md` concluído. Os nomes de lá (`decisionWaiver`, `dispensarConferenciaDoResumo`, `podeDecidirAConferencia`, `respostaSemEfeitoNoFio`, `conferenciaDoReaproveitado`) foram usados como estão. O 06-18-SUMMARY não traz nenhuma divergência do 06-18-PLAN que afete este plano. A única diferença que ele registra, a terceira exceção a CON-05 no caso (h) de `invocar-agente.test.ts`, não toca as linhas mudadas aqui.

## Commits

| Task | Commit | Mensagem |
|---|---|---|
| 1 RED | `2a122f2` | test(06-19): casos do domínio para a marca de lançamento em curso e o avisarEstrito |
| 1 GREEN | `c10d13f` | feat(06-19): domínio — a marca de lançamento em curso que o Status e o diálogo respeitam, e a porta G3 estrita |
| 2 RED | `0bc7d52` | test(06-19): casos da ponte e da tela para a marca antes do /lancar e o SEM_EFEITO |
| 2 GREEN | `9cdcf60` | feat(06-19): ponte — a marca antes do /lancar com a reconferência na gravação, … (com as seis exceções a CON-05) |
| 3 RED | `02168d7` | test(06-19): casos da ponte para G3 fechado no meio do ciclo e o orçamento justo |
| 3 reforço | `73471d4` | test(06-19): G3 (a) com uma terceira conta — a recusa para o laço antes da conta seguinte (reforço de M16) |
| 3 GREEN | `62dabe4` | feat(06-19): ponte — G3 fechado no meio do ciclo e o orçamento justo |
| 3 jornada | `d4436ec` | feat(06-19): jornada — cenário cp-dispensa-manual e sem pedirAjustePeloCard |
| 3 docs | `2214a96` | docs(06-19): a marca do lançamento em curso, SEM_EFEITO, G3 estrito no meio do ciclo, … |

Todos os commits são por pathspec, sem push. `f716460`, `4d8bb15` e `288cbf5`, no meio, são do executor de 06-17.

A Task 2 parou num checkpoint: dois testes existentes ficaram vermelhos sem estar entre as exceções nomeadas. O orquestrador autorizou as duas trocas, e a Task 2 foi commitada depois.

## O que mudou

**Domínio (Task 1).**
- `financeiro-base.ts` continua só com `import type`. Ganhou:
  - `PREFIXO_LANCAMENTO_HUMANO`, movido de `financeiro.ts`;
  - `REGISTRO_LANCAMENTO_EM_CURSO`, `REGISTRO_LANCAMENTO_INTERROMPIDO`, `REGISTRO_LANCADO_NO_OMIE` e `REGISTRO_LANCAMENTO_FALHOU`;
  - `PRAZO_DO_LANCAMENTO_EM_CURSO_MS` (5 min) e `RECUSA_LANCAMENTO_EM_CURSO`;
  - `lancamentoEmCursoDe(state, task, agora?)`, que desempata como `newestFirst` (`at`, depois a sequência do id, reimplementada sem import de valor).
- `financeiro.ts`:
  - `marcarLancamentoEmCurso` e `encerrarLancamentoEmCurso`, fora de `OPERACOES` (o grep em `registro.ts` dá 0);
  - `registrarLancamentoNoOmie` e `registrarFalhaDoLancamento` gravam pelas constantes (o grep das strings dá 0);
  - `avisarEstrito` em `OpcoesDaConferencia` e nas opções de `registrarFalhaDoLancamento`. A recusa vem logo depois de `guardasDoAgente`, antes da idempotência.
- `financeiro-textos.ts`: `recusaAvisarInativo`.
- `tasks.ts`: `changeTaskStatus` recusa quando o Status muda de fato. `addTaskComment` recusa o texto com `PREFIXO_LANCAMENTO_HUMANO` vindo de um Membro. Nos dois, só é recusado quem não marcou.

**Ponte (Tasks 2 e 3), em `invocar-agente.ts`.**
- **`SEM_EFEITO`** (`"PONTE_SEM_EFEITO"`, exportada) com `semEfeito()` e `foiSemEfeito()`. Usada no Resumo adiado, na saída antes do registro e na marca adiada. O grep de `return ok(undefined)` dá 0, e o `ok` saiu do import.
- **A marca**, gravada depois do corpo e dos anexos e antes do `/lancar`:
  - primeiro a impressão do corpo contra a da gravação (`IMPRESSAO_MUDOU`), depois `motivoParaNaoLancar`, e só então `marcarLancamentoEmCurso`;
  - `SEM_EFEITO` ⇒ "Lançamento adiado: a conta mudou antes da marca." com o código;
  - conflito ⇒ transitória;
  - outra recusa ⇒ parada com `MARCA_RECUSADA_PELO_DOMINIO`.
- **`encerrar(code)`**, em: falha transitória (o `code` da resposta), `LANCAMENTO_NAO_CONFIRMADO`, `SAIU_ANTES_DO_REGISTRO`, `REGISTRO_RECUSADO_PELO_DOMINIO`, o terceiro conflito do registro (`CONFLITO_DE_REVISAO`), e a falha permanente cujo registro foi recusado (o `code` da falha). Se o encerramento falha, o log leva `MARCA_NAO_ENCERRADA`.
- **G3 estrito**:
  - `avisarEstrito: true` na publicação (sempre que há `avisar`, e na dispensa) e na falha;
  - `comentar` e a resposta `recusaSemCodigo` conferem `membroAtivo(s, avisar)` dentro da operação;
  - `portaFechada()` registra o `warn` `AVISAR_ID_INVALIDO` uma vez por ciclo, e o laço para antes da próxima conta;
  - no `comentar`, o texto fica pendente sem contar tentativa.
- **O orçamento**: `cursor` rotativo, zerado quando o laço chega ao fim. `continuar` agenda o próximo ciclo pelo `cutucar()` no `finally` de `processarContas`, isto é, pelo temporizador de `atrasoDaCutucadaMs`. `EstadoDaConta.tentativasDoComentario` leva a `COMENTARIO_PENDENTE_DESISTIDO` em `TENTATIVAS_TRANSITORIAS`.

**Tela (Task 2).**
- `lancamentoNoOmieRecusado` devolve `RECUSA_LANCAMENTO_EM_CURSO` enquanto a marca vale.
- O card da Conferência mostra a linha `role="status"` "O Agente está lançando esta conta no Omie agora. Espere a confirmação neste fio."

**Jornada e docs (Task 3).**
- `pedirAjustePeloCard` e o seu `eslint-disable` saíram.
- Entrou `cp-dispensa-manual`, só quando pedido, com os seis passos do plano; ver o desvio 4.
- `persistencia/CONTEXT.md` ganhou o parágrafo dos prazos para os importadores e para o `55P03` fora da revisão.
- `automacoes/CONTEXT.md` ganhou a porta G3 estrita e duas seções novas: "O lançamento em curso" (com `SEM_EFEITO`) e "O orçamento justo".

## Exceções a CON-05 (antes/depois)

As quatro nomeadas no plano, e só essas linhas:

| Arquivo, caso | Antes | Depois |
|---|---|---|
| `invocar-agente.test.ts`, "a conta sai de \"em lançamento omie\" durante o /lancar…" | `mover(estado, das.id, S.paraPagar);` | `das.statusId = S.paraPagar;` |
| `invocar-agente.test.ts`, "o registro recusado depois do lançamento confirmado…" | `if (transacoes === 1) return …` | `if (transacoes === 2) return …` |
| `ponte-ciclo.test.ts`, (d) "Query read timeout no REGISTRO…" (l. 373) | `if (gravacoes === 1) throw …` | `if (gravacoes === 2) throw …` |
| `ponte-lancar-fresco.test.ts`, (j) "conflito de revisão três ciclos seguidos no registro…" | `if (gravacoes <= TENTATIVAS_TRANSITORIAS)` | `if (gravacoes % 2 === 0 && gravacoes <= 2 * TENTATIVAS_TRANSITORIAS)` |

Duas que o plano não previa. O motivo é o mesmo das nomeadas: a marca virou a primeira gravação antes do `/lancar`, e os dois testes recusavam a PRIMEIRA gravação. Parei no checkpoint, e o orquestrador autorizou:

| Arquivo, caso | Antes | Depois |
|---|---|---|
| `ponte-ciclo.test.ts`, (g) "leitura do fio, dispensa, publicação do Resumo e registro do lançamento: só códigos", bloco 4 | `montar(estado, { executarOperacao })` — toda gravação recusada, inclusive a marca | `let n = 0; montar(estado, { executarOperacao: async (op) => (++n === 1 ? executarEmMemoria(estado)(op) : executarOperacao(op)) })` — a marca passa, as seguintes são recusadas |
| `ponte-reaproveitado-conferido.test.ts`, (n) (l. 204) | `// A primeira gravação do ciclo é o registro da falha` / `if (gravacoes === 1)` | `// A segunda gravação do ciclo é o registro da falha` / `if (gravacoes === 2)` |

Com a Task 2 aplicada e antes das trocas, os resultados eram: `invocar-agente` 104/106, `ponte-ciclo` 26/28, `ponte-lancar-fresco` 23/24 e `ponte-reaproveitado-conferido` 6/7. Depois das seis trocas, todos voltaram a 106, 28, 24 e 7. Nenhuma asserção mudou. O caso (h) de `ponte-ciclo.test.ts` (o orçamento) ficou verde sem edição.

## Mutações

Script em `<scratchpad>/exec-06-19/mutar.py`, tabela em `mutacoes.py`. A restauração foi conferida por sha256 em todas: OK.

| # | Mutação | Derrubou |
|---|---|---|
| M1 | `lancamentoEmCursoDe` sem o prazo | lançamento-em-curso (g) ×2 |
| M2 | `changeTaskStatus` sem a recusa | lançamento-em-curso (b); ponte (a) |
| M3 | a recusa também para quem marcou | lançamento-em-curso (c); ponte (d) |
| M4 | `addTaskComment` sem a recusa do registro humano | lançamento-em-curso (d); ponte (a) |
| M5 | "Lançado no Omie"/"falhou" fora do encerramento | lançamento-em-curso (c), (e), (h); ponte (a), (d), (f) |
| M6 | publicar ignorando `avisarEstrito` | avisar-estrito (j) ×2; g3 (a) |
| M7 | falha ignorando `avisarEstrito` | avisar-estrito (k); g3 (b) |
| M8 | sem a marca antes do `/lancar` | ponte (a), (c), (e), (f), (g) |
| M9 | a marca sem a reconferência | ponte (b1), (b2), (b3) |
| M10 | sem `encerrar` na transitória | ponte (c) |
| M11 | `semEfeito()` de volta a `ok(undefined)` | ponte (b) ×3, (g) ×2 |
| M12 | `lancamentoNoOmieRecusado` sem a marca | tela (j) |
| M13 | o card sem a linha | tela (j) |
| M14 | `comentar` sem a conferência de G3 na operação | g3 (b), (c) |
| M15 | a publicação sem `avisarEstrito` | g3 (a) |
| M16 | o laço sem parar depois da recusa de G3 | g3 (a) — **depois do reforço `73471d4`** |
| M17 | sem o cursor | g3 (d) |
| M18 | continuação por `cutucar()` dentro do laço (repetir imediato) | g3 (e) |
| M19 | sem a desistência | g3 (f) |

A única lacuna foi M16. Na primeira rodada ele não derrubou nada, porque em g3 (a) a conta recusada era a última da lista. Reforcei o caso com uma terceira conta completa, que não pode nem pedir o `/resolver`, e passei a exigir `servidor.recebidas` = 2. Depois disso, M16 derruba (a).

## crm2:IN-06 — as quatro lacunas de teste do review

| Lacuna do review | Caso | Mutação que o derruba |
|---|---|---|
| CR-01: a dispensa depois de desmarcar Manual | `ponte-dispensa-e-fio.test.ts` (a) (06-18) | 06-18 M1 (`conferenciaDoResumo` sem `dispensaSemManual`) |
| WR-03: o "ok" do aprovador de G3 e da Maryane sob G3 | `ponte-dispensa-e-fio.test.ts` (f)/(g) (06-18) | 06-18 M5 (filtro de volta a `revisoresDoResumo`), com o reforço `455852b` |
| WR-04: o Membro de G3 desativado no meio do ciclo | `ponte-g3-e-orcamento.test.ts` (a) (este plano) | M6, M15, M16 |
| WR-05: o orçamento com Comentários que falham sempre | `ponte-g3-e-orcamento.test.ts` (d)/(f) (este plano) | M17, M19 |

## Números finais

- `packages/dominio`: 973 → 995/995 (66 arquivos; 22 casos novos); `tsc --noEmit` limpo; nenhum teste existente editado.
- `apps/web`: 272 → 275/275 (29 arquivos). `src/features/tarefa/` fica em 90/90, com `lancamento-no-omie-dialog.test.tsx` sem edição. `tsc` limpo.
- `apps/api`, por arquivo, com `DATABASE_URL=` vazio:

| Arquivo | Antes | Depois |
|---|---|---|
| `ponte-lancamento-em-curso` (novo) | — | 13/13 |
| `ponte-g3-e-orcamento` (novo) | — | 6/6 |
| `invocar-agente` | 106 | 106 |
| `ponte-ciclo` | 28 | 28 |
| `ponte-lancar-fresco` | 24 | 24 |
| `ponte-dominio-estrito` | 10 | 10 |
| `ponte-contrato-v12` | 12 | 12 |
| `ponte-portas-e-paradas` | 14 | 14 |
| `ponte-dispensa-e-fio` | 8 | 8 |
| `ponte-reaproveitado-conferido` | 7 | 7 |
| `contrato-contas-a-pagar-ponte` | 11 | 11 |
| `contrato-contas-a-pagar` | 43 | 43 |
| `anexos-da-conta` | 5 | 5 |
| `anexos-da-conta-limites` | 6 | 6 |
| `observabilidade/metricas-aprovacoes` | 1 | 1 |
| `rotas/operacoes-conferencia` | 12 | 12 |
| `rotas/operacoes` | 13 + 11 pulados | 13 + 11 pulados (banco) |
| `persistencia/unidade-de-trabalho` | — | 5 |
| `persistencia/unidade-de-trabalho-trava` | — | 9 |

Os testes que precisam de banco pulam sem `DATABASE_URL`, e pular não conta como verde. O `tsc` da API está limpo.

Nos outros verificadores:
- `npm run lint`: 0 erros; os 4 avisos antigos de `app-shell.tsx` continuam;
- `verificar:tokens`: OK (437 tokens, 0 falhas);
- `verificar:contratos`: OK;
- `node --check` e `eslint` da jornada: OK.

`git diff --name-only 196599b..HEAD -- packages apps contratos docs`: os arquivos de `files_modified` mais `ponte-reaproveitado-conferido.test.ts` (a exceção autorizada). Os de `contratos/` e `docs/` que aparecem são do executor de 06-17.

## Deviations from Plan

### Auto-fixed / aceitos

**1. [Rule 1: ordem necessária] A impressão é conferida antes de `motivoParaNaoLancar` na gravação da marca.** Aceito pelo orquestrador.
- Na ordem do plano, `IMPRESSAO_MUDOU` nunca aconteceria: mudar a impressão já deixa a Conferência `desatualizada`, e o motivo sairia `SEM_CONFERENCIA_APROVADA`. O caso (b3) exige `IMPRESSAO_MUDOU`.
- Com a troca, (b1) e (b2) continuam com `LANCAMENTO_HUMANO` e `SAIU_DE_EM_LANCAMENTO`, porque um Comentário e o Status não entram na impressão.
- Commit: `9cdcf60`.

**2. [Detalhe] O grep de aceite de `from "node:` em `operations/*.ts` dá 1.** O único acerto é um arquivo de TESTE antigo (`recorrencia-contas-a-pagar.test.ts`, de 03-03, lendo um arquivo). No código de produção do domínio o resultado é 0.

**3. [Detalhe] `falhaPermanente` chama `encerrarLancamentoEmCurso` direto** quando o registro da falha é recusado. `encerrar` é local de `momentoDoLancamento`, e `falhaPermanente` é função irmã. O código de log é o mesmo (`MARCA_NAO_ENCERRADA`). Aceito.

**4. [Rule 3: bloqueio] A tela não tem como LIMPAR um Campo de escolha única.**
- O problema: o `Select` de `task-editors.tsx` não tem opção vazia. "Integração manual" tem uma opção só ("Manual"). Uma pessoa não consegue desmarcar pela tela.
- A solução: o passo 3 do `cp-dispensa-manual` usa `desmarcarEscolha()`. O gesto humano é escolher "Manual" de novo, e `pagina.route` troca só o valor dessa gravação (`args[2]`) por `null` antes de ela sair. É a mesma operação `setTaskFieldValue`, com a sessão e o transporte do usuário. Depois, a jornada recarrega e confere que a linha não mostra mais "Manual".
- Está documentado no cabeçalho da jornada. Não mudei a tela: seria mudança de produto fora de `files_modified`.
- **Para 06-20:** a prova de crm2:CR-01 fica válida, porque a ponte é o que se prova, não o gesto de desmarcar. Mas é um achado de produto: hoje, quem usa a tela não desmarca "Integração manual". Fica em Deferred.
- Commit: `d4436ec`.

**5. [Rule 2: lacuna de mutação] Reforço de g3 (a) para M16.** Detalhes na seção de mutações. Commit: `73471d4`.

**6. [Harness] A hidratação que cede ao relógio nos casos (d)–(f) de g3.**
- O problema: com tudo em memória, o laço quente antigo (e M18) gira em microtasks e trava o processo do teste.
- A correção: `hidratarCedendo` põe um `setTimeout(1)` na hidratação. Assim o caso FALHA em vez de travar.
- Na primeira rodada vermelha, o arquivo travou. Matei o processo (`pkill`) e não houve efeito colateral.

**7. [Harness] O caso (i) de `ponte-lancamento-em-curso` mudou de lugar.** Saiu do `describe` que fecha o servidor falso, porque o `afterEach` fecharia duas vezes o servidor do caso anterior.

## O que 06-20 precisa saber

- **Variáveis de ambiente para o `cp-dispensa-manual`** (só pedido pelo nome, sozinho):
  - `AGENTE_CONTAS_A_PAGAR_MODO=conferencia`;
  - `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL=sem-conferencia`;
  - `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM="TESTE AUTOMATIZADO"`;
  - `AGENTE_CONTAS_A_PAGAR_AVISAR_ID=<Membro do usuário da jornada>`;
  - de preferência `AGENTE_CONTAS_A_PAGAR_INTERVALO_MS=30000`, para os dois ciclos caberem na espera do passo 5;
  - `JORNADA_MODO=conferencia` (o padrão). O cenário recusa `lancar` no passo 0.
- **Variável nova da jornada:** `JORNADA_ESPERA_CICLOS_MS` (padrão 45000), a espera dos dois ciclos no passo 5.
- **A nota do cenário:** `dispensa desmarcada: Resumo novo no fio (<id>), nenhum aviso de "lançaria" até a resposta humana`.
- **Comportamento novo da ponte:**
  - todo `/lancar` é precedido do Registro "Lançamento no Omie em curso";
  - códigos novos no log: `IMPRESSAO_MUDOU` (em "Lançamento adiado: a conta mudou antes da marca."), `MARCA_RECUSADA_PELO_DOMINIO`, `MARCA_NAO_ENCERRADA` e `COMENTARIO_PENDENTE_DESISTIDO`;
  - `AVISAR_ID_INVALIDO` também aparece no meio do ciclo, com a mensagem "…deixou de ser um Membro ativo do Espaço no meio do ciclo…";
  - na Atividade, "Lançamento no Omie interrompido" leva o código no `detail`;
  - o orçamento esgotado agora espera `atrasoDaCutucadaMs` (2 s) antes de continuar.
- **Na tela:** com a marca vigente, o card mostra "O Agente está lançando esta conta no Omie agora. Espere a confirmação neste fio.", e mudar o Status ou registrar "Lançado no Omie" à mão é recusado com `RECUSA_LANCAMENTO_EM_CURSO` por até 5 min.

## Deferred

- **crm2:WR-01, o residual fora da plataforma.** Quem lança direto no Omie durante o `/lancar` não passa por nenhuma regra do CRM. O que existe é o aviso na tela e a comparação do título no `automation/` (`TITULO_EXISTENTE_DIVERGENTE`, 06-08).
- **crm2:IN-05, a parte opcional.** Tratar `55P03` como 409 em `formularios-publicos` exige o Postgres real para provar. Está escrito em `persistencia/CONTEXT.md`.
- **O achado de produto do desvio 4.** Um Campo de escolha única não se limpa pela tela. Decidir se o `Select` de `task-editors.tsx` ganha uma opção vazia (ou "Limpar") é mudança de UI para outro plano.

## Threat model

- **T-6-19-01:** mitigado pela marca, pelas recusas em `tasks.ts`, pelo aviso na tela e pelo encerramento em todo desfecho (M1–M5, M8–M10, M12, M13).
- **T-6-19-02:** mitigado pelo prazo de 5 min e por `encerrar` (lançamento-em-curso (g); ponte (c), (i)).
- **T-6-19-03:** mitigado por `avisarEstrito`, pela conferência dentro da operação e pela parada do laço (M6, M7, M14–M16).
- **T-6-19-04:** mitigado pelo cursor, pela continuação com espera e pela desistência (M17–M19).
- **T-6-19-05:** mitigado por `SEM_EFEITO` (M11).
- **T-6-19-06:** aceito, conforme o planejado.
- **T-6-19-07:** mitigado: `marcarLancamentoEmCurso` e `encerrarLancamentoEmCurso` estão fora de `OPERACOES` (grep = 0).
- **T-3-04:** os logs novos levam só códigos e ids. O `detail` do Registro "interrompido" é só o código fixo.
- O domínio continua sem I/O. Nenhum servidor subiu, a jornada não rodou, nada tocou produção, e `.env` não foi lido.

Nenhuma superfície nova fora do `<threat_model>`. O `pagina.route` da jornada é ferramenta de teste no navegador do próprio usuário, com a sessão dele.

## Known Stubs

Nenhum.

## Self-Check: PASSED

- Os cinco arquivos de teste novos existem.
- Os commits `2a122f2`, `c10d13f`, `0bc7d52`, `9cdcf60`, `02168d7`, `73471d4`, `62dabe4`, `d4436ec` e `2214a96` estão em `git log`.
