---
phase: 06-conferencia-do-resumo-e-anexos
plan: 13
subsystem: apps/api (a ponte do Agente de lançamento, a Unidade de Trabalho, a rota de operações, classificações e métricas)
tags: [conferencia-do-resumo, gap-closure, ponte, timeouts, lock_timeout, single-flight, portas-de-teste, reinicio]

requires:
  - phase: 06-12
    provides: "motivoParaNaoLancar, a releitura antes do /lancar, RESUMO_ADIADO, superarConferencia, fixtures-da-ponte.ts"
  - phase: 06-06
    provides: "a prova que mostrou os 4 timeouts do ciclo (06-PROVAS.md)"
provides:
  - "codigoDaFalhaDoCiclo; ciclo single-flight com recuperação (10 s → 60 s), orçamento (20 gravações) e medição ('Ciclo da ponte demorou.')"
  - "inicioDaTransacao com statement_timeout (80 % de Q) e lock_timeout (Q/3); 55P03 na revisão = conflito"
  - "recusaDasPortasDeTeste (index.ts) e AVISAR_ID_INVALIDO (a ponte não age; motivoParaNaoLancar)"
  - "chaveDaPonte com todos os Valores de Campo ativos e os anexos"
  - "PADROES_DAS_PARADAS, ultimaMudancaHumana (Marco), PARADA_RESTAURADA, aviso do modo conferência conferido no fio"
  - "eventosDeSaidaDaOperacao/resolverAprovacaoPeloTopico/aprovacoesDaSolicitacao só com processStep 'pagamento'; cutucada com mais seis operações"
affects: [06-15]

tech-stack:
  added: []
  patterns:
    - "single-flight pela própria função pública (a mesma promessa em voo)"
    - "prazos do servidor derivados do prazo do cliente, sempre abaixo dele"
    - "padrões ancorados montados das próprias funções de texto com curingas"
    - "o fio como memória de parada entre reinícios, com desempate pela sequência do id"

key-files:
  created:
    - apps/api/src/automacoes/ponte-ciclo.test.ts
    - apps/api/src/automacoes/ponte-portas-e-paradas.test.ts
    - apps/api/src/persistencia/unidade-de-trabalho-trava.test.ts
    - apps/api/src/rotas/operacoes-conferencia.test.ts
    - apps/api/src/observabilidade/metricas-aprovacoes.test.ts
  modified:
    - apps/api/src/automacoes/invocar-agente.ts
    - apps/api/src/persistencia/unidade-de-trabalho.ts
    - apps/api/src/index.ts
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/rotas/classificacoes.ts
    - apps/api/src/observabilidade/metricas.ts
    - apps/api/src/automacoes/invocar-agente.test.ts
    - apps/api/src/persistencia/unidade-de-trabalho.test.ts
    - apps/api/src/rotas/operacoes-eventos.test.ts
    - apps/api/src/automacoes/CONTEXT.md
    - apps/api/src/persistencia/CONTEXT.md
    - apps/api/README.md
    - apps/api/.env.example

key-decisions:
  - "ultimaMudancaHumana devolve um Marco { at, sequencia } em vez de só o instante: no mesmo milissegundo, a sequência do id desempata (como newestFirst)"
  - "Erro de BANCO na releitura antes do /lancar sobe para o laço (recuperação, não conta como falha do Omie); o resto segue RELEITURA_FALHOU (06-12)"
  - "O log da falha de banco leva recuperacaoEmMs (número) e os contadores do ciclo; o corte do orçamento leva code ORCAMENTO_DO_CICLO_ESGOTADO"
  - "A mensagem de conflito por 55P03 é a mesma da revisão que mudou ('Outra alteração entrou antes desta. Tente de novo.')"
  - "O caso (d) de WR-02 põe a exigência de saída do Boleto em 'em lançamento omie' na fixture: o seed não exige arquivo para sair desse Status"

requirements-completed: [RES-01, RES-02, RES-03]

duration: ~25 min
completed: 2026-09-30
---

# Phase 6 Plan 13: Os timeouts do ciclo da ponte, a porta de teste fechada, a chave larga e as paradas que sobrevivem ao reinício — Summary

A ponte agora roda um ciclo por vez e não segura o banco enquanto espera a
rede. Um erro de banco não vira falha do Omie: a ponte se recupera sozinha com
recuo, grava no máximo 20 vezes por ciclo e registra quanto demorou. A
Unidade de Trabalho abre com prazos do lado do servidor abaixo do prazo do
cliente, e a trava esgotada volta como conflito.

Uma porta de teste mal configurada deixa a ponte parada; a combinação perigosa
nem deixa a API subir. Subir o arquivo que faltava, ou desmarcar Manual,
destrava a conta. Um reinício não repete aviso nenhum. Por fim, a Conferência
do Resumo deixou de ser tratada como Solicitação no evento de saída, na
classificação e na métrica, e a cutucada passou a cobrir as operações que
faltavam.

## Execução

- Início 2026-09-30T14:14Z, fim 14:39Z. Três tarefas, cada uma com um commit
  RED (`test`) e um GREEN (`feat`/`fix`).
- Antes de tudo, o diagnóstico foi escrito neste arquivo e commitado
  (`2bcc21f`). Nenhuma linha de código mudou antes disso.
- Tudo rodou na árvore `crm-n1-integracao`: nenhum servidor subiu, o banco não
  foi tocado, o `.env` não foi lido e o `.env.example` só ganhou uma linha.

## Diagnóstico dos timeouts do ciclo

O que a prova de 06-06 mostrou (`06-PROVAS.md`, "O que a prova mostrou além do
esperado"): 3 × `Query read timeout` e 1 × `Connection terminated due to
connection timeout` no ciclo da ponte, todos enquanto a tela gravava; o
`GET /estado` da tela ficou em ~1,6 s o tempo todo. O diagnóstico é só por
código e por medição local: o banco de produção não foi lido e o `.env` não foi
aberto (regra 3 de `06-CONTEXT.md`).

**De onde vêm as três mensagens** (conferido em `node_modules`, `pg` 8.23.0):
- `Query read timeout`: `pg/lib/client.js:706-707`. É um temporizador DO
  CLIENTE (`query_timeout`, 30 s, `conexao.ts:74`/`:98`). Ele devolve o erro e
  não manda `CancelRequest` ao servidor, então a instrução continua viva lá.
- `Connection terminated due to connection timeout`: `pg-pool/index.js:276`.
  Uma conexão NOVA (TCP + TLS + partida no pooler) passou de
  `connectionTimeoutMillis` (10 s, `conexao.ts:99`). É diferente de pool
  esgotado: esse caso daria `timeout exceeded when trying to connect`
  (`pg-pool/index.js:224`), e não foi o que apareceu.

| # | Hipótese | Evidência (`arquivo:linha`) | Veredito |
|---|---|---|---|
| H1 | Cliente ou transação segurado durante HTTP | `invocar-agente.ts:728-739`: o `hidratarEstado` padrão faz `connect` → `hidratar` → `release`, sem rede no meio. `unidade-de-trabalho.ts:98-167`: entre `begin` (102) e `commit` (154), a operação é síncrona (116) e só há `await` de SQL; nenhum `fetch`. `invocar-agente.ts:1181`→`:1208`: a assinatura dos anexos (`anexos-da-conta.ts:101` → `storage-uploads.ts:290`, HTTP do Storage) roda depois de `hidratarEstado` devolver o cliente e antes do `/lancar` (`:1222`), fora de qualquer cliente. `outbox-worker.ts:270-278`: reivindica, faz `release` (275) e só então `entregar` (278, `fetch` em 235); cada `marcar*` tem o seu `connect`/`release` (188-226). `scheduler-worker.ts:456-465`: a reivindicação é uma instrução só (`for update skip locked`, via `pool().query`), e `executar` vem depois (538). `credenciais-de-servico.ts:97-219`: só `pool().query` avulso. `rotas/estado.ts:32-42`: `connect` → `hidratar` → `release`. | **Refutada.** Nenhum cliente nem transação atravessa uma chamada de rede. O caso (b) da Task 1 passa a travar esse invariante. |
| H2 | Ciclos sobrepostos | `grep -rn "processarContas\|lancarContasEmLancamento" apps/api/src \| grep -v .test.`: em produção, o único chamador é `ciclo()` (`invocar-agente.ts:1324`), com a guarda `emVoo` (`:1323`). `cutucar()` (`:1337-1349`) e `iniciar()` (`:1356-1361`) passam por `ciclo()`. `index.ts:79-89` desmonta a instância anterior antes de subir outra na recarga do vite-node. Mas `processarContas()` chamado direto (a interface pública, `:1353-1354`) roda sem guarda. | **Refutada em produção.** O caminho sem guarda existe e só os testes o usam. F1 fecha esse caminho de qualquer jeito. |
| H3 | O Espaço inteiro hidratado muitas vezes por ciclo | Por ciclo: 1 leitura (`invocar-agente.ts:852`), mais 1 releitura por `/lancar` (`:1181`, 06-12), mais 1 hidratação DENTRO de cada `executar` (`unidade-de-trabalho.ts:103`). Com conflito são até 3 (`:95`). Cada `comentar`, `lerRespostas`, `dispensar`, `momentoDoResumo` e registro é um `executar`. `repositorio.ts:84-99`: `canonico()` por linha, que é CPU no MESMO event loop que atende a tela (`rotas/estado.ts:34`). Medição abaixo: ~10 ms por 1 000 registros para hidratar e ~5,5 ms para gravar. | **Confirmada como amplificador.** Cada gravação da ponte custa uma hidratação inteira e disputa CPU com a tela. Nos tamanhos medidos, não chega a 30 s sozinha. |
| H4 | Espera de trava na revisão do Espaço | `unidade-de-trabalho.ts:125-128`: o `update plataforma.workspaces … where revisao = $2` é o ÚNICO ponto que trava e espera. A trava vale até o `commit` (`:154`) e cobre a CPU de `gravar` (`:135`; `canonico` de TODO registro, `repositorio.ts:186`). `:85-88`: só `idle_in_transaction_session_timeout`, sem `statement_timeout` nem `lock_timeout` no servidor. `conexao.ts:74`/`:98`: o cliente desiste em 30 s, o MESMO número do `idle_in_transaction_session_timeout`. `conexao.ts:116-128`: no estouro, `end()` fecha o socket, mas o `pg` não cancela a instrução (ver acima), e atrás do pooler ela pode seguir esperando a trava. Uma transação cujo cliente sumiu depois do `update` segura a revisão por até 30 s, e cada escritor que chegar nesse intervalo estoura os seus 30 s junto. | **Confirmada por código:** o mecanismo existe e casa com a assinatura da prova (só escritas estouraram; a leitura `GET /estado`, que não trava, ficou em 1,6 s). Sem os logs do servidor, fica **indeterminado** qual transação segurou a trava em 06-06. |
| H5 | Pool e pooler | `conexao.ts:138`: `max: 10`. `conexao.ts:99`: `connectionTimeoutMillis: 10_000`, a origem literal do 4º erro (`pg-pool/index.js:276`, conexão NOVA lenta, não pool esgotado). `conexao.ts:123` e `unidade-de-trabalho.ts:166` (`release(true)`): cada estouro destrói um cliente e força uma conexão TLS nova ao pooler, justamente quando ele está lento. | **Confirmada como origem do 4º erro.** O porquê de o pooler levar mais de 10 s para aceitar uma conexão (fila de conexões de servidor no modo transação, rede) fica **indeterminado sem produção**. |
| H6 | Quem mais divide o processo e o pool | `index.ts:169-185`: o outbox (`OUTBOX_WORKER_ATIVO`, a cada 5 s, `outbox-worker.ts:184`). `index.ts:187-213`: o agendador (`AUTOMACOES_WORKER_ATIVO`). Os dois dividem o mesmo pool (`max: 10`) e o mesmo event loop com a tela e a ponte. | **Indeterminada.** O `.env` é ilegível (regra 3), e nenhuma correção depende dela. |

**Medição de CPU sem banco.** Arquivo temporário
`apps/api/src/automacoes/medir-hidratacao.tmp.test.ts`, que saiu da árvore antes
do primeiro commit e não aparece no `git status`. Registros sintéticos a partir
de `buildSeed()` (996 registros), completados com cópias de Tarefas e Registros
de Atividade. `hidratar` roda com um cliente falso que devolve as linhas
(`dados` já como objeto, como o `pg` entrega o `jsonb`). `gravar` roda com um
cliente falso que só anota as consultas. Uma Tarefa muda, e vale o melhor de 3
rodadas.

| N (registros) | JSON | `hidratar` (ms) | `gravar` (ms) |
|---|---|---|---|
| 1 000 | 0,5 MB | 8,8 | 5,7 |
| 10 000 | 5,7 MB | 101,6 | 55,5 |
| 50 000 | 28,8 MB | 575,3 | 320,1 |

O que a medição mostra:
- O event loop fica ocupado ~10 ms por 1 000 registros em cada hidratação,
  fora o parse do `jsonb` no driver, que não entrou na conta.
- Um ciclo com K gravações faz 1 + K hidratações (1 + 3K com conflito).
- A trava da revisão cobre a CPU inteira de `gravar` (~5,5 ms por 1 000
  registros) mais o `insert`, o outbox e o `commit`.
- Mesmo com 50 000 registros, a trava não passa de centenas de ms por CPU.

Conclusão: um estouro de 30 s não vem da CPU. Vem de uma trava segurada por uma
transação sem dono (H4), ou de espera no pooler (H5). A CPU (H3) só alarga a
janela em que isso acontece. As correções F1–F6 fecham cada um desses caminhos.

Nenhuma causa fora de H1–H6 apareceu.

## Commits

| Tarefa | Commit | Mensagem |
|---|---|---|
| Passo 0 | `2bcc21f` | docs(06-13): diagnóstico dos timeouts do ciclo, antes da correção |
| 1 RED | `f11d14d` | test(06-13): o ciclo da ponte sob timeouts de banco e a trava esgotada (RED) |
| 1 GREEN | `efe061f` | feat(06-13): ciclo da ponte single-flight com recuperação, orçamento e medição; prazos do servidor na Unidade de Trabalho |
| 2 RED | `c290d19` | test(06-13): a porta de teste fechada, a chave larga e as paradas que sobrevivem ao reinício (RED) |
| 2 GREEN | `4a5a3e8` | feat(06-13): a porta de teste fechada, a chave larga e as paradas restauradas do fio |
| 2 GREEN | `d076424` | docs(06-13): .env.example — AVISAR_ID exige SO_TITULOS_COM (crm:WR-01) |
| 3 RED | `d533af7` | test(06-13): Conferência não é Solicitação no evento, na classificação e na métrica; a cutucada completa (RED) |
| 3 GREEN | `f5e2025` | fix(06-13): Conferência do Resumo não é Solicitação no evento, na classificação e na métrica; a cutucada completa |

- Todos os commits usam a forma com pathspec, e nenhum foi enviado com
  `git push`.
- `git diff --name-only ad85536..HEAD -- apps packages` lista só arquivos de
  `files_modified`. O arquivo temporário da medição não está lá.
- O `.env.example` ficou num commit à parte, com 1 inserção e 0 remoções. A
  regra de negação bloqueia qualquer comando que cite o caminho dele junto com
  outros.

## O que mudou

### Task 1: os timeouts do ciclo (F1–F6) e crm:WR-11

**F1 — single-flight.** `processarContas()` passou a ser o guarda:
- com um ciclo em voo, devolve a MESMA promessa;
- `ciclo()`, `cutucar()`, `iniciar()`, `parar()` e a recuperação passam por
  ele;
- `repetir` continua como antes;
- `lancarContasEmLancamento === processarContas` continua valendo;
- `parar()` espera o ciclo em voo, mesmo que ele falhe.

**F2 — nada do banco durante HTTP.** O invariante foi escrito no cabeçalho de
`invocar-agente.ts`, e o caso (b) o trava.

**F3 — erro de banco no ciclo.**
- `codigoDaFalhaDoCiclo(erro)` devolve `{ code, deBanco, sqlstate? }`.
- Cada conta roda num `try/catch`, e a leitura do ciclo também. Um erro de
  banco faz três coisas:
  - registra o `warn` "Falha de banco no ciclo do Agente de lançamento.", com
    `code`, `sqlstate` (só em `ERRO_DE_BANCO`), `recuperacaoEmMs` e os
    contadores;
  - PARA o laço;
  - agenda UM ciclo de recuperação: 10 s, dobrando até
    `ATRASO_MAXIMO_DE_RECUPERACAO_MS` (60 s). O atraso zera no primeiro ciclo
    que termina sem falha de banco, `parar()` cancela a recuperação, e um
    ciclo que começa a torna desnecessária.
- A contagem de transitórias do Omie não sobe e nenhum Comentário sai.
- Um erro que não é de banco sobe, e o `catch` de `ciclo()` registra só
  `code: "ERRO_NO_CICLO"`.
- Um erro de banco na releitura antes do `/lancar` agora sobe para o laço (ver
  Desvios).

**F4 — orçamento.** `maximoDeGravacoesPorCiclo` vale 20 por padrão
(`MAXIMO_DE_GRAVACOES_POR_CICLO`). Quando ele esgota, a ponte:
- registra `info` com `code: "ORCAMENTO_DO_CICLO_ESGOTADO"` e `gravacoes`;
- chama `cutucar()`, que vira `repetir`;
- sai do laço. A contagem G1 só é registrada pelo ciclo que termina o laço.

**F5 — medição.** Os contadores por ciclo são `hidratacoes`, `gravacoes`,
`conflitos` e `requisicoes`. Acima de `limiarDoCicloLentoMs` (5 s), sai o log
`info` "Ciclo da ponte demorou." com `{ workspaceId, listId, ms, hidratacoes,
gravacoes, conflitos, requisicoes }`.

**F6 — prazos do servidor.**
- `inicioDaTransacao()` monta `begin; set local
  idle_in_transaction_session_timeout = Q; set local statement_timeout =
  max(1, ⌊0,8·Q⌋); set local lock_timeout = max(1, ⌊Q/3⌋)`.
- Com Q = 0, fica o `begin` puro.
- Em `executar`, `55P03` no `update … revisao` faz `rollback`, anota o
  conflito e passa para a próxima tentativa, e a conexão volta ao pool
  (`release(false)`). Qualquer outro erro sobe como antes.
- `persistencia/CONTEXT.md` ganhou a seção "Os prazos do servidor e a trava
  esgotada".

**crm:WR-11.** A dispensa e a publicação do Resumo passaram a logar só
`DISPENSA_RECUSADA_PELO_DOMINIO` e `RESUMO_RECUSADO_PELO_DOMINIO`. Nenhum
`registrar()` do arquivo leva `r.error` ou `erro.message`. A única linha com
`summary` continua sendo a de `chamar()`, que passa por `sanitizarErro`, como
antes.

**Por que a mudança em `executar()` é segura para os outros chamadores.** Os
chamadores são a rota de operações, as classificações, os formulários
públicos, `integracao-solicitacoes`, o agendador, a ponte e os bootstraps.
- **Trava esgotada.** `55P03` só vira conflito no `update` da revisão, e todo
  chamador já trata `{ conflito: true }`, que é o mesmo retorno de uma revisão
  que mudou (409 na rota, `CONFLITO_DE_REVISAO` no agendador, transitório na
  ponte). A espera pela trava agora tem teto de Q/3 (10 s), e depois vêm as
  duas tentativas seguintes. Antes, o cliente desistia em 30 s com exceção
  (500) e descartava a conexão.
- **`statement_timeout` de 24 s.** Só pode derrubar uma instrução que ficasse
  entre 24 s e 30 s, e essa já estava condenada: o cliente desistiria em 30 s
  de qualquer jeito, com a instrução órfã no servidor. Instruções de menos de
  24 s não mudam.
- **Sem prazo.** Com `DATABASE_QUERY_TIMEOUT_MS=0` (migração longa à mão),
  nada muda.
- **Provas sem banco.** Os quatro casos de `unidade-de-trabalho.test.ts`
  (sucesso, recusa, `Query read timeout` no meio e conexão que cai no
  `begin`) continuam verdes, e só a string esperada do `begin` mudou. Os casos
  (k) e (l) de `unidade-de-trabalho-trava.test.ts` cobrem os prazos, o `55P03`
  como conflito, o `55P03` que sai e a segunda tentativa confirma, o `57014`,
  que sobe e descarta a conexão, e o `55P03` fora da revisão, que sobe como
  antes.

### Task 2: crm:WR-01, crm:WR-02, crm:WR-07

**crm:WR-01.** Logo depois da leitura do ciclo, se `avisarId` está definido e
não é Membro ativo:
- sai o `warn` "AGENTE_CONTAS_A_PAGAR_AVISAR_ID não é um Membro ativo do
  Espaço: a ponte não age neste ciclo…", com `code: "AVISAR_ID_INVALIDO"` e
  sem o id;
- o ciclo sai, em todos os modos, a cada ciclo;
- `avisouAvisarInvalido` saiu do código, e `avisarDoCiclo()` devolve o id.

As outras peças:
- `motivoParaNaoLancar` ganhou `criterio.avisarId` e o código
  `AVISAR_ID_INVALIDO`, perguntado logo depois de `CONTA_SUMIU`. A releitura
  de 06-12 passa esse critério.
- `recusaDasPortasDeTeste({ soTitulosCom, avisarId })` é exportada, e
  `index.ts` faz `throw` com o texto dela.
- Docs atualizadas: cabeçalho, `automacoes/CONTEXT.md` (G3), README e
  `.env.example`.

**crm:WR-02.** `chaveDaPonte(state, task)` junta:
- a impressão de lançamento;
- o Status;
- o id do último "Status alterado";
- o id e a decisão da Conferência vigente;
- os Valores de Campo ATIVOS, como pares [definição, valor] ordenados;
- os `fileId` de `task.attachments`.

O laço usa essa função.

**crm:WR-07.**
- `PADROES_DAS_PARADAS` tem 12 padrões ancorados, montados das próprias
  funções de texto com dois curingas: texto livre e código `[A-Z0-9_]+`.
- Para isso, os quatro textos inline viraram exports: `textoDoDadoFaltando`,
  `TEXTO_SEM_CENTRO_DE_CUSTO`, `TEXTO_VALOR_INVALIDO` e
  `TEXTO_LANCAMENTO_NAO_CONFIRMADO`. O texto de cada um é o mesmo de antes.
- `ultimaMudancaHumana(state, task, atorDoServico)` é o mais recente entre:
  - os Registros da Tarefa feitos por um Membro que não é o de serviço;
  - `createdAt` da Conferência vigente;
  - `decidedAt` dela, quando outro Membro decidiu.
- Restauração: nos modos que gravam, na primeira vista (sem entrada em
  `estadoPorConta`), a ponte olha o aviso de parada mais recente do Agente.
  Se ele é posterior à última mudança humana, vem `parada = "recusa"` e o
  `info` `PARADA_RESTAURADA`, sem requisição e sem Comentário.
- O aviso do modo `conferencia` só sai se o fio da Conferência ainda não tem
  esse texto, publicado depois do mais recente entre o último "Status
  alterado" e a decisão (`avisoDoModoNoFio`).

### Task 3: crm:CR-04, crm:WR-06, crm:IN-04

**crm:CR-04 no evento de saída.** `eventosDeSaidaDaOperacao` faz
`if (aprovacao.origin.processStep !== "pagamento") return [];`. É uma lista de
permissão.

**crm:CR-04 na classificação.** Em `classificacoes.ts`,
`resolverAprovacaoPeloTopico` agora é exportada e exige
`processStep === "pagamento"`, e os `eventos` da decisão por classificação têm
a mesma guarda.

**crm:WR-06.** `aprovacoesDaSolicitacao(state)` é pura e exportada, e
`lerAmostraReal` a chama.

**crm:IN-04.** `OPERACOES_QUE_CUTUCAM_A_PONTE` ganhou `createTask`, `moveTask`,
`trashTask`, `restoreTask`, `attachFile` e `removeAttachment`. Em `createTask`,
o par vem do `valor`, que é a Tarefa criada. `automacoes/CONTEXT.md` ("A
cutucada") foi atualizado.

## Testes

Todos rodaram sem `DATABASE_URL`: por arquivo durante as tarefas e por pasta no
fim. Os testes de banco pulam (DEC-09); pular não conta como verde.

| Arquivo / pasta | Resultado |
|---|---|
| `ponte-ciclo.test.ts` (novo) | 28/28 |
| `ponte-portas-e-paradas.test.ts` (novo) | 14/14 |
| `unidade-de-trabalho-trava.test.ts` (novo) | 9/9 |
| `operacoes-conferencia.test.ts` (novo) | 11/11 |
| `metricas-aprovacoes.test.ts` (novo) | 1/1 |
| `unidade-de-trabalho.test.ts` | 5/5 (só as duas strings do `begin` mudaram) |
| `invocar-agente.test.ts` | verde. Os três casos (q), o de `parar()`, o (i) e o da recusa do `/resolver` ficaram SEM edição; só o caso de ~1366 mudou (CON-05). |
| `src/automacoes/` inteira | 13 arquivos: 297 passaram, 17 pularam |
| `src/rotas/` inteira | 34 arquivos: 164 passaram, 50 pularam |
| `src/persistencia/` inteira | 6 arquivos passaram e 5 pularam; 46 testes passaram, 36 pularam |
| `src/observabilidade/` inteira | 2 arquivos: 10 passaram |

- `tsc --noEmit` passou verde em `apps/api`, `packages/dominio` e `apps/web`.
- `npm run lint` deu 0 erros. Os 4 avisos já existiam, todos em `apps/web`.
- `verificar:tokens` e `verificar:contratos` deram OK.
- O domínio não foi tocado, então a suíte dele não precisou rodar.

## Mutações

O script é `scratchpad/exec-06-13/mutar.py`. Ele troca o trecho exato, roda o
arquivo de teste e restaura o original no `finally`. A restauração foi
conferida por sha256 nas 18 mutações.

| # | Mutação | Testes que falharam |
|---|---|---|
| M1 | `processarContas` sem o guarda | ciclo (a) ×2 |
| M2 | o `catch` por conta relança | ciclo (c) ×2, (d) |
| M3 | sem agendar recuperação | ciclo (c) ×2, (d), (e) ×4 |
| M4 | orçamento ignorado | ciclo (h) |
| M5 | `ciclo()` registrando `erro.message` | ciclo (f) |
| M6 | `inicioDaTransacao` sem `lock_timeout` | trava (k) ×4 |
| M7 | 55P03 relançado em `executar` | trava (l) ×2 |
| M8 | a porta falhando aberta | portas (a) ×3 |
| M9 | `recusaDasPortasDeTeste` aceitando `AVISAR_ID` sozinho | portas (c) |
| M10 | a chave sem os Valores de Campo | portas (d), (e), (f) |
| M11 | sem a restauração pelo fio | portas (h), (j) |
| M12 | `ultimaMudancaHumana` ignorando os Registros | portas (i) |
| M13 | aviso do modo conferência sem a conferência do fio | portas (g) |
| M13b | `falha(…)` dentro de `PADROES_DAS_PARADAS` | portas (k), (l) |
| M14 | sem o filtro em `eventosDeSaidaDaOperacao` | conferência (a) ×3 |
| M15 | sem o filtro em `resolverAprovacaoPeloTopico` | conferência (b) |
| M16 | métrica sem `processStep` | métricas (c) |
| M17 | `createTask` pelo `args[0]` | conferência (d) ×2 |

## As três exceções a CON-05 (e só elas)

**1. `persistencia/unidade-de-trabalho.test.ts`**, caso "o begin leva o prazo do
servidor igual ao query_timeout do pool". Só os dois primeiros valores
esperados mudaram; o terceiro (`"begin"`) ficou (commit `f11d14d`).

Antes:

```
"begin; set local idle_in_transaction_session_timeout = 30000"
"begin; set local idle_in_transaction_session_timeout = 5000"
```

Depois:

```
"begin; set local idle_in_transaction_session_timeout = 30000; set local statement_timeout = 24000; set local lock_timeout = 10000"
"begin; set local idle_in_transaction_session_timeout = 5000; set local statement_timeout = 4000; set local lock_timeout = 1666"
```

**2. `automacoes/invocar-agente.test.ts`**, caso de `avisarId` inválido (l.
1366; commit `c290d19`).
- O título mudou de "…: aviso uma vez, e as Menções seguem a regra de
  sempre" para "…: o ciclo não escreve nem chama nada, e avisa a cada ciclo
  (WR-01)".
- As asserções, antes: 1 aviso `AGENTE_CONTAS_A_PAGAR_AVISAR_ID…` e o Resumo
  mencionando a `MARYANE`.
- As asserções, depois: `servidor.recebidas` vazio, nenhum Resumo e 2 avisos
  (um por ciclo).
- A asserção de que o aviso não contém `mem_nao_existe` ficou.
- Nenhum outro caso do arquivo mudou.

**3. `rotas/operacoes-eventos.test.ts`**. A fixture `aprovacaoDeProcesso`
ganhou `processStep: "pagamento"` em `origin`, e nenhuma asserção mudou
(commit `d533af7`).
- Antes: `origin: { kind: "processTask", taskId: "tsk_sol", threadCommentId: "cmt_rot" }`
- Depois: `origin: { kind: "processTask", taskId: "tsk_sol", processStep: "pagamento", threadCommentId: "cmt_rot" }`

## Variáveis de ambiente, e como 06-15 deve defini-las

**Nenhuma variável nova.** As opções novas da ponte (`atrasoDeRecuperacaoMs`,
`atrasoMaximoDeRecuperacaoMs`, `maximoDeGravacoesPorCiclo` e
`limiarDoCicloLentoMs`) são de código, com padrões de produção: 10 s, 60 s, 20
e 5 s.

Duas variáveis que já existiam mudaram de efeito:
- **`DATABASE_QUERY_TIMEOUT_MS`** (padrão 30000) passou a derivar também o
  `statement_timeout` (80 %) e o `lock_timeout` (1/3) de toda Unidade de
  Trabalho. **06-15 deve deixá-la no padrão.** Não pode ser `0`, que desliga os
  três prazos do servidor.
- **`AGENTE_CONTAS_A_PAGAR_AVISAR_ID`** agora EXIGE
  `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM`: com a primeira sozinha, a API não
  sobe. **06-15 deve definir as duas juntas**, com `SO_TITULOS_COM=TESTE
  AUTOMATIZADO` e `AVISAR_ID` = o id de um Membro ATIVO do `ws_n1`. Se o id não
  for Membro ativo, a ponte fica parada e o log mostra `AVISAR_ID_INVALIDO` a
  cada ciclo.

## O que 06-15 deve procurar no log da prova de novo

| Linha / código | O que quer dizer |
|---|---|
| `Ciclo da ponte demorou.` | O ciclo passou de 5 s. Os campos `ms`, `hidratacoes`, `gravacoes`, `conflitos` e `requisicoes` dizem onde o tempo foi. |
| `Falha de banco no ciclo do Agente de lançamento.` com `TRAVA_ESGOTADA` | O `lock_timeout` agiu no ciclo. Espera-se ver `conflitos` subindo e a recuperação andando, e não mais `Query read timeout` |
| `TEMPO_DE_CONSULTA_ESGOTADO` | Voltar a vê-lo quer dizer que o servidor NÃO desistiu antes do cliente: H4 não era a causa, ou o pooler ignora `set local`. Nesse caso, investigar H5. |
| `TEMPO_DE_CONEXAO_ESGOTADO` | Conexão nova ao pooler com mais de 10 s (H5). |
| `CONSULTA_CANCELADA_PELO_BANCO` | O `statement_timeout` (24 s) cancelou uma instrução. |
| `recuperacaoEmMs` | O recuo da recuperação: 10000, depois 20000, e assim até 60000. |
| `ORCAMENTO_DO_CICLO_ESGOTADO` | O ciclo passou de 20 gravações. |
| `PARADA_RESTAURADA` | Depois de reiniciar, uma parada foi restaurada do fio, sem Comentário. |
| `AVISAR_ID_INVALIDO` | A porta G3 está mal configurada, e a ponte não agiu. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — o tipo de `ultimaMudancaHumana`] Devolve `Marco { at, sequencia }`, não `string`.**
- **Encontrado em:** Task 2, no desenho.
- **Problema:** nos testes (e numa gravação rápida em produção), o aviso da
  ponte e a mudança humana caem no MESMO milissegundo. Só com o instante, a
  restauração falharia de um lado ou do outro, de forma intermitente.
- **Correção:** a sequência do id (`nextId`, contador único entre prefixos)
  desempata, como `newestFirst` faz com a Atividade. A comparação usa
  `Date.parse`.
- **Commit:** `4a5a3e8`.

**2. [Rule 2 — não contar falha de banco como do Omie] Erro de banco na releitura antes do `/lancar` sobe para o laço.**
- **Encontrado em:** Task 1.
- **Problema:** desde 06-12, a releitura que falha vira `RELEITURA_FALHOU`
  transitória. Um `Query read timeout` ali contaria como falha do Omie, o
  contrário do que a verdade da Task 1 pede.
- **Correção:** se `codigoDaFalhaDoCiclo(erro).deBanco`, a exceção sobe: o
  laço para e a recuperação é agendada. Os outros erros seguem a regra de
  06-12, e `ponte-lancar-fresco.test.ts` (h), que usa um erro genérico, ficou
  verde sem edição.
- **Commit:** `efe061f`.

**3. [Aditivo] Campos a mais no log e opção nova.**
- `recuperacaoEmMs` no log da falha de banco (número).
- O log do corte do orçamento, com `code: "ORCAMENTO_DO_CICLO_ESGOTADO"`.
- A opção `atrasoMaximoDeRecuperacaoMs` (o teto "injetável" do caso (c)).
- **Motivo:** tornam o recuo e o orçamento observáveis por teste sem depender
  de relógio, e servem ao 06-15.

**4. [Fixture] O caso (d) de WR-02 põe a exigência de saída do Boleto em "em lançamento omie".**
- **Problema:** no seed, e no evolver de produção, só "para pagar" tem
  `exitRequirements`. `erpMissingFields` não pede arquivo nenhum em "em
  lançamento omie".
- **Correção:** o caso põe `{ definitionId: F.boleto, whenDefinitionId: F.forma,
  whenValue: "Boleto" }` no Status "em lançamento omie" da fixture. É o caminho
  que WR-02 descreve: `unmetRequirements` do Status atual, que um
  Administrador configura pela tela.

**5. [Rule 3] `afterEach` de `ponte-portas-e-paradas.test.ts` fecha só o servidor que o caso abriu.**
- **Problema:** os casos puros (c), (f) e (k) não abrem servidor, e fechar o
  anterior de novo dava "Server is not running".
- **Commit:** `4a5a3e8`.

### Notas

- Os comandos que citavam o caminho do `.env.example` junto com outros foram
  bloqueados pela regra de negação, e dois comandos compostos meus não rodaram
  por isso. Refeitos sem citar o arquivo; nada ficou sem fazer.
- O classificador do modo automático não recusou nada nesta execução. Não há
  "Verificação bloqueada".

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. Não entrou superfície nova fora do `<threat_model>`, e as mitigações
T-6-13-01..06 estão cobertas pelos casos e mutações acima.
- O log ganhou só códigos fixos e números: `code`, `sqlstate`, `ms`,
  contadores e `recuperacaoEmMs`.
- A rota de classificações ficou MAIS restrita.
- A cutucada só antecipa um ciclo que o relógio faria de qualquer jeito.

## Self-Check: PASSED

- Os 5 arquivos de teste criados existem.
- Os 8 commits (`2bcc21f`, `f11d14d`, `efe061f`, `c290d19`, `4a5a3e8`,
  `d076424`, `d533af7`, `f5e2025`) estão em `git log`.
- `medir-hidratacao.tmp.test.ts` não está na árvore.
