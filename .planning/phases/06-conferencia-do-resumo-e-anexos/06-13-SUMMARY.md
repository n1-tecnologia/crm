# Phase 6 Plan 13 — rascunho (diagnóstico escrito antes da correção)

Este arquivo nasce com o diagnóstico dos timeouts do ciclo, escrito e
commitado ANTES de qualquer mudança de código (Passo 0 da Task 1). O resto do
SUMMARY entra no fim do plano.

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
