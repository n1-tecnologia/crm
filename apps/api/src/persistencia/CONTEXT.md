# persistencia

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

A ponte entre o `DataState` que o domínio conhece e o Postgres da plataforma
(`plataforma.registros` + `plataforma.workspaces`, schema próprio no projeto
Supabase `epomplsskqpluxuujpxl`). Nada aqui reescreve regra de negócio — a
aposta desta pasta é que hidratar → operação pura → gravar o diff é
suficiente para o domínio nunca saber que existe um banco.

| Arquivo | O que faz |
|---|---|
| `conexao.ts` | `carregarEnv()` lê `apps/api/.env` sem `dotenv`; `pool()` é o `Pool` do `pg`, singleton lazy. |
| `host-local.ts` | A regra "só banco local" e o host que o `pg` USA (15-44, M-01): `hostEhLocal(url)` aceita só `localhost`, `127.0.0.1` e `[::1]` em URL SEM query e confere o host efetivo por `new Client(url).host` (API pública do `pg`, sem conectar); `hostDaConexao(url)` devolve `host:porta` sem usuário nem senha. Usada pelo demo do CRM, por `testes/banco-crm.ts` e pela CLI do corte. |
| `repositorio.ts` | `hidratar()` (banco → `DataState`), `gravar()` (diff por comparação canônica de JSON), `reordenar()` (posição fracionária), `semear()` (escreve um `DataState` inteiro num Espaço vazio — base do bootstrap e da importação). Cada um é a soma de uma parte que só gasta processador e outra que fala com o banco: `estadoDasLinhas()`/`sqlDeHidratar()` e `planejarGravacao()`/`sqlsDoPlano()` (Fase 13), que `executar()` usa para mandar várias instruções numa ida só. |
| `sql-literal.ts` | `literalEntreDolares()`: o texto como literal SQL entre dólares, com marca sorteada que o texto não contém. É o que deixa as mensagens de várias instruções (sem `$1`) levarem dados sem escape à mão. |
| `unidade-de-trabalho.ts` | `executar()`: trava o Espaço no começo (`select … for update`) e hidrata → operação pura → `gravar()`, com uma tentativa só (D-09); as importações longas usam o regime otimista (revisão conferida no fim, até 3 tentativas, D-10). No `travado` isso custa DUAS idas ao banco (Fase 13, ver "Idas ao banco"). A rota HTTP é uma casca em volta disto. |
| `migrar.ts` + `migrar.cli.ts` | Aplica `apps/api/migracoes/NNN-*.sql` em ordem, uma vez cada, dentro de transação, registrado em `plataforma.migracoes`. |
| `persistencia.test.ts`, `colunas-geradas.test.ts`, `integracao.test.ts`, `agenda-de-automacoes.test.ts` | Testes de integração contra Postgres real; pulam sem `DATABASE_URL` (`temBanco ? describe : describe.skip`, D-DEC-09). |
| `unidade-de-trabalho-concorrencia.test.ts` | GRV-03 contra Postgres real: duas `executar()` simultâneas no mesmo Espaço gravam com uma tentativa cada e a leitura do Espaço roda 2 vezes (3 no regime otimista); trava esgotada vira conflito sem hidratar. Arquivo próprio porque `unidade-de-trabalho-trava.test.ts` mocka `./conexao` e `./repositorio` no módulo inteiro. Pula sem Postgres local (`describeComBanco`). |
| `regime-dos-chamadores.test.ts` | Sem banco; lê o código-fonte. Só as quatro importações longas passam `regime: "otimista"`, todo `semEventosDeSaida: true` o exige, `bootstrap/` nunca passa `regime:` (D-10). |

## Idas ao banco: duas por gravação (Fase 13)

Cada ida e volta ao banco custa a distância até ele: ~52 ms da VPS (Chicago) ao
pooler do Supabase (`us-west-2`, Oregon), medidos em produção (`select 1` =
51,4 ms). A Fase 12 fazia sete por gravação (`begin`, trava, leitura, Canais,
`update` da revisão, `gravar`, `commit`; oito com remoção ou na primeira do
processo, que pagava a guarda dos Canais), cerca de 360 ms só de rede. O
regime `travado` as junta em duas **mensagens de várias instruções** (protocolo
simples do `pg`, que devolve um resultado por instrução):

- **Entrada:** `begin` com os prazos, a trava (`select … for update`), a leitura
  do Espaço (`sqlDeHidratar`). Os Canais saíram da mensagem no 15-33 (ver "A ponte
  dos Canais saiu"). A **ordem** dentro da mensagem é a mesma de
  antes e é o que garante a regra: em READ COMMITTED cada instrução tira o
  próprio retrato quando COMEÇA, então a leitura, depois da trava, vê o que o
  escritor anterior confirmou. O que continua proibido é fundir trava e leitura
  numa CONSULTA só. `55P03` aqui só pode ser a trava (leitura não espera
  trava) e vira conflito, como antes.
- **Saída:** o `update` da revisão, o `insert`/`delete` dos registros
  (`sqlsDoPlano`) e o `commit`. Se uma instrução falha, o servidor descarta o
  resto da mensagem (o `commit` não roda) e o `catch` de `executar()` desfaz.
  Só vale **sem evento de saída e sem `aoConfirmar`**: esses precisam de
  instruções depois das escritas, e o fim segue instrução por instrução, como
  na Fase 12. Nenhum chamador do regime `travado` mudou.

Sem `$1` na mensagem, os dados viajam como **literal entre dólares**
(`literalEntreDolares`): a marca é sorteada a cada uso e só vale se o texto não
a contém. Os registros vão como UM literal `jsonb` lido de volta por
`jsonb_to_recordset`. `unidade-de-trabalho-em-lote.test.ts` prova, contra
Postgres, que isso grava exatamente o que `gravar()` por parâmetros gravaria
(texto hostil, `ordem` fracionária, remoção, carga de ~1,6 MB) e que uma falha
no meio da mensagem desfaz a revisão também.

`MedicaoDaExecucao.idasEVoltas` conta as vezes que a gravação foi ao banco, e vai
na linha `"gravacao medida"`. Uma gravação comum mede **2**, a primeira do
processo também: desde o 15-33 não há guarda nem leitura de Canais. O
regime `otimista` não mudou. Com o lote, `inicioMs` guarda a mensagem de
entrada inteira (inclusive a espera pela trava) e `gravarMs`, a de saída; `travaMs`,
`atualizaMs` e `commitMs` ficam em 0 no caminho em lote, e `hidratarMs` passa a
ser só processador.

## O gesto misto (Fase 14, 3.2.1)

Um gesto que grava nas tabelas do CRM (`plataforma.contatos`, `conversas`, …) **e**
em `plataforma.registros` precisa ser uma transação só: dois commits deixariam
uma Tarefa sem Conversa, ou uma Conversa sem Tarefa. `executar()` ganhou as duas
peças que faltavam, sem mudar nada para quem já a chama:

- **`lerDoCrm(cliente, state)`** roda no MESMO `PoolClient`, depois da trava do
  Espaço e da hidratação, e antes da `operacao`. Recebe o `state` hidratado (a
  troca de Canal da Tarefa acha o Contato pelo Vínculo antes de ler o CRM). O que devolve chega à `operacao` (2º argumento) e a
  `aoConfirmar` (4º, novo e opcional). O tempo soma em `hidratarMs`;
  `MedicaoDaExecucao` não ganhou campo.
- **`aoConfirmar(cliente, valor, state, lido)`** já existia (depois das escritas de
  `registros` e do outbox, antes do `commit`): é onde `gravarNoCrm` roda.

**A ordem das travas** é: a linha do Espaço primeiro (a de sempre), depois as
linhas do CRM de que a escrita depende, com `select … for update` **em ordem de
id**. Nenhum serviço novo chama `avancarRevisaoDoEspaco` dentro do gesto: a trava
do Espaço já é a primeira e `executar()` já sobe a revisão; inverter a ordem abre
deadlock com o REST de Canal.

**A porta para os serviços é `executarGestoMisto`**
(`servicos/crm/gesto-misto.ts`), não `executar()` direto. Ela dá o contrato:

- a **recusa é valor**: `lerDoCrm` devolve `ResultadoCrm`, a `operacao` devolve
  `fail(...)`, e ambos voltam como `ResultadoCrm` com status e frase, sem exceção
  e sem `gravarNoCrm` rodar. Exceção como fluxo normal destruiria conexões do pool
  (`release(true)`).
- o **SQLSTATE é rede**: `23505`, `23503` e `23514` dentro de `gravarNoCrm`
  (corrida que a leitura não pegou: a conexão sai do pool entre a pré-checagem e a
  escrita) viram 409 com a frase que o serviço passou em `frases`, nunca com o
  nome da constraint. O índice único é quem decide a corrida; a frase só a traduz.
- uma recusa devolvida por `gravarNoCrm` (`ok: false`) vira uma exceção interna
  que desfaz tudo e volta como valor: serve só para o que a pré-checagem não pegou.
- D-01: o gesto não traduz id antigo em novo. Cada lado grava os ids que já são
  seus.

**O custo, aceito.** Um gesto com `aoConfirmar` sai do caminho de duas idas da
Fase 13 e segue instrução por instrução (update, escritas, outbox, `aoConfirmar`,
`commit`); `lerDoCrm` soma a sua ida. Para gestos raros (mesclar Contatos, as
quatro rotas da Tarefa conversacional) isso é aceito e aparece em `idasEVoltas`.
Quem precisar das duas idas de volta tem de tirar o `aoConfirmar`, o que um gesto
que grava no CRM não pode.

## Os prazos do servidor e a trava esgotada (06-13; a trava no começo, Fase 12)

**A trava e os dois regimes (12-04, D-09/D-10).** `executar()` evita que duas
gravações no mesmo Espaço se invalidem de duas formas, escolhidas por
`regime`:

- **`travado` (o padrão).** Logo depois do `begin` com os prazos, a primeira
  instrução é `select revisao from plataforma.workspaces where workspace_id = $1
  for update`, **separada** de `hidratar()` (em READ COMMITTED cada instrução
  enxerga o que foi confirmado até o instante em que começa, então a hidratação
  seguinte vê o que o escritor anterior confirmou; fundir as duas numa consulta
  daria registros velhos com a revisão nova). Quem chega durante outra gravação
  espera a vez e grava com **uma tentativa só**; o `update … revisao = revisao + 1`
  não confere mais a revisão. `tentativas` não existe nesse regime (o tipo
  recusa).
- **`otimista` (só as quatro importações manuais longas).** O que valia até a
  Fase 11: a revisão é lida na hidratação e conferida no `update … where
  revisao = $2` do fim, com até 3 tentativas (`tentativas`). Travar o Espaço
  desde o começo seguraria o `ws_n1` inteiro durante os minutos de uma
  importação. As quatro: `importar-contas-a-pagar`, `importar-contas-a-receber`,
  `financeiro/importar` e `corrigir-data-de-pagamento-cr`. Tela, agendador,
  ponte do Agente, ponte do Financeiro, formulários públicos, anexos, convite,
  `criar-usuario` e todo `bootstrap/*` gravam no `travado`. A janela que
  sobra: o `update` do fim toma a trava da linha do Espaço e a segura durante o
  `gravar()` do lote, os eventos e o `commit`; uma gravação da tela nesse
  intervalo espera o `lock_timeout` (10 s), vira 409 e a tela reverte o que
  já tinha mostrado. Rode as importações fora do horário de uso.
  `regime-dos-chamadores.test.ts` falha se outro arquivo passar `otimista`.

`inicioDaTransacao()` abre toda Unidade de Trabalho com três prazos do lado do
servidor, derivados do `query_timeout` Q do pool (`DATABASE_QUERY_TIMEOUT_MS`,
30 s por padrão):

- `idle_in_transaction_session_timeout = Q`: a sessão cujo cliente sumiu
  depois de travar a revisão é encerrada;
- `statement_timeout = 80 % de Q`: o servidor cancela a instrução antes de o
  cliente desistir dela;
- `lock_timeout = Q / 3`: a espera pela trava do Espaço tem prazo (10 s com
  Q = 30 s).

Os três ficam com no mínimo 1 ms, porque `0` desliga. **Com Q = 0 o regime
`otimista` abre com o `begin` puro; o `travado` abre com `begin; set local
lock_timeout = 10000`** (`inicioDaTransacaoTravada()`, `TRAVA_DE_RESERVA_MS`):
um CLI de `bootstrap/` rodado com a variável herdada do shell do operador nunca
espera pela trava sem prazo. Q = 0 é só das importações otimistas.

O motivo dos prazos é o diagnóstico H4 de `06-13-SUMMARY.md`. O `query_timeout`
é um temporizador do CLIENTE: quando ele estoura, o `pg` devolve `Query read
timeout` e não cancela nada no servidor. Uma instrução órfã podia continuar
esperando a trava, e depois segurá-la, enquanto os escritores seguintes
estouravam os seus 30 s.

**O que `55P03` (trava esgotada) vira em `executar()`:**

- **Regime `travado`:** `55P03` no `select … for update` é **conflito**, sem
  repetir — desfaz com um `rollback`, devolve `{ conflito: true }` (409 na rota,
  transitório na ponte) depois de no máximo ~10 s (Q = 30 s), e a conexão, que
  está sã, volta ao pool. Quem chamou decide se tenta de novo.
- **Regime `otimista`:** `55P03` no `update … revisao` continua conflito, igual
  a uma revisão que mudou: desfaz e tenta de novo, até 3 tentativas.
- **Fora da trava, nos dois regimes:** qualquer outro erro, inclusive `57014`
  (cancelado pelo `statement_timeout`) e um `55P03` em outro ponto (no
  `commit`, no `aoConfirmar`), sobe como exceção e descarta a conexão.

**Escritores esperando seguram conexão.** No `travado` cada escritor que espera
a vez fica com a conexão tomada (até o `lock_timeout`), e o pool tem 10: dez
escritores esperando esgotam o pool, e o hook de autenticação e `GET /estado`
entram na fila (RESEARCH, Pitfall 2; T-12-09). Por isso a espera é limitada a
~10 s e a uma tentativa, e a linha de medição de `POST /operacoes/:nome` traz
`conexaoMs` (a espera pelo pool) e `travaMs` (a espera pela trava) — é onde se
vê isso acontecer. O agendador e a ponte do Agente também enfileiram atrás dos
gestos de tela no mesmo Espaço.

**Os prazos valem para todo chamador de `executar()` (06-19, crm2:IN-05).**
O `statement_timeout` (80 % de Q) vale também para o `gravar` em lote dos
importadores e para o `aoConfirmar` dos formulários públicos: uma instrução
entre 0,8·Q e Q, que antes de 06-13 passava, agora é cancelada com `57014`.
Por isso a importação longa (`importar-contas-a-pagar`,
`importar-contas-a-receber`, `financeiro/importar`) roda com
`DATABASE_QUERY_TIMEOUT_MS=0` na execução manual (Q = 0 abre a transação do
regime otimista com o `begin` puro) — nunca no processo da API, que continua
com os prazos. E o `lock_timeout` vale para QUALQUER instrução da transação,
não só para a trava: um `55P03` fora dela (ex.: o `consumirSessao … for update`
dos formulários públicos, ou a hidratação durante uma DDL) sobe como exceção
(500), não como 409. É seguro: a Unidade de Trabalho desfaz a transação
inteira, e a submissão pública é idempotente pelo `submissionId` — o cliente
repete sem duplicar. Tratar esse `55P03` como 409 em `formularios-publicos`
fica para depois (exige o Postgres real para provar).

## A regra das migrações

Numeradas (`apps/api/migracoes/NNN-*.sql`), aplicadas uma vez por
`npm run migrar -w @n1/api`, registradas em `plataforma.migracoes`. Depois de
aplicado, um arquivo é imutável (D-DEC-10): uma correção é a migração
seguinte, nunca uma edição no arquivo já aplicado.

**A `011` (Fase 14, `011-crm-o-que-faltava.sql`).** Dá ao CRM novo o que só o
antigo tinha (D-04, só o essencial): `contatos.mesclado_em_id`/`mesclado_em` e o
estado `mesclado` (RN-CON-14, terminal e só de leitura; a regra "sem cadeia" é do
serviço, não de constraint), `contato_consentimentos` (só inserção),
`contato_notas`, `conversa_marcacoes` (estrela e leitura, por Membro),
`conversas.na_lixeira_em` (com backfill antes do check) e os índices parciais de
`atribuido_id` e `fila_id`. **Não** cria coluna de Grupo na Conversa nem de Flow na
Mensagem (D-05), nem campo de Funil na Lista (D-06), nem `webhooks_recebidos`
(Fase 16); `migracao-011.test.ts` e `sem-listas-espelho.test.ts` seguram isso.
`crm_de_para` e `registros_crm_antigo` são **só do script de migração da Fase 15**:
nenhuma rota e nenhum `hidratar()` as lê, e guardam dado pessoal das coleções
antigas (por isso nunca vão a log). A 011 não apaga nem altera linha de
`plataforma.registros` (D-03). Depois de aplicá-la, rode `npm run banco:conceder`
(a rede da 009 para o `n1_api`). Ela só vai a produção no deploy da Fase 15 (D-01:
o corte é de uma vez); antes, `npm run migrar -- --seco` lista o que seria aplicado.

**A `012` (Fase 15, `012-atividade-do-crm.sql`).** Cria `plataforma.crm_atividades`,
o Registro de Atividade do CRM novo (D-15-09, UCR-03): espelha `ActivityRecord` do
domínio (ator, delegante, ação, tipo/id/nome do objeto, momento, resultado, antes,
depois, detalhe), com PK `(workspace_id, id)`, checks de ator, delegante, resultado e
ação (`crm_atividades_*_ck`) e dois índices (por objeto e por tempo). **Não** tem chave
estrangeira para o objeto: a Atividade sobrevive à eliminação dele (INV-ET-12), por isso
guarda `objeto_nome`. É **só inserção por contrato do repositório**
(`repositorios/crm/atividades.ts` só expõe `registrarAtividade` e `listar`; nenhum
`update`/`delete`), como `contato_notas`, sem trigger no banco. O gesto grava a
Atividade no MESMO cliente do `comTransacao`, então um gesto que falha não deixa a
linha; o `detalhe` nunca leva dado pessoal (o conteúdo da Nota fica de fora). Não toca
`plataforma.registros` (D-03). A 012 vai a produção só no corte da Fase 15 (D-15-03),
pelo dono, e depois dela rode `npm run banco:conceder`; antes disso, só em Postgres de
Docker, e `npm run migrar -- --seco` lista o que seria aplicado. `migracao-012.test.ts`
prova as restrições, a idempotência, a falha no meio, a RLS e a sobrevivência à
eliminação do objeto. A leitura (`GET /atividades`) e a fusão das duas linhas do tempo
na web são o plano 15-37. O `em` é gravado em MILISSEGUNDOS (`date_trunc('milliseconds',
now())`, `MOMENTO_DO_GESTO`), igual ao `at` do `ActivityRecord`, para o cursor composto
`(em, id)` da leitura ser exato (15-09). Quem grava, desde o 15-09: Nota (15-04), mover,
atribuir, lixeira, restaurar, estrela, leitura, transferir Identificador, consentimento e a
sucessão (`passarAoSucessor`, um `insert ... select` por tabela antes do `update`).

## Colunas geradas e índices de `002`

`002-registros-colunas-geradas.sql` estende `plataforma.registros` com três
colunas geradas (`status_id`, `list_id`, `due_date`, todas
`generated always as (dados->>'campo') stored`) e seis índices parciais
(`where colecao = 'tasks'` ou `'members'`) para o que a tela de Contas a
pagar filtra — status, Lista, vencimento, Tag `conta *`, Responsável, Pessoa —
mais a resolução de sessão por `dados->>'userId'` que o hook de autenticação
roda em toda requisição. **Nada em `repositorio.ts` sabe delas: são para
consultas de tela e para o hook de sessão**, nunca para o INSERT/UPDATE que
`gravar()` já faz sobre `dados`.

## Tabelas de transporte (Fase 2)

`003-integracao-e-importacao.sql` cria seis tabelas no schema `plataforma`:
`integration_outbox`, `http_idempotency`, `service_credentials`,
`upload_sessions`, `upload_objects` e `importacao_ledger`. `registros`
continua sendo o único armazenamento canônico das entidades da ontologia —
estas seis são transporte e auditoria (evento, replay, credencial de
serviço, sessão de upload, reconciliação de importação), não conceito de
domínio. Nenhuma delas entra em `hidratar()`/`gravar()`, nenhuma é lida pelo
`repositorio.ts`: quem grava e lê é o código de integração/importação da
Fase 2 (Planos 02-10, 02-11, 02-13, 02-25), direto contra o `pg.Client` da
sua própria transação.

Quem mexer aqui precisa manter a regra que motivou a existência dessas
tabelas separadas de `registros`: nenhuma coluna guarda CPF/CNPJ, chave
Pix, código de barras, conteúdo de anexo ou segredo em texto puro
(`integration_outbox.payload`, `importacao_ledger.motivo`,
`http_idempotency.response_body`, `service_credentials.secret_hash` são os
pontos onde isso poderia vazar — ver os comentários de cada tabela na
migração e o registro STRIDE T-02-21/T-02-12 no Plan 02-03). Os invariantes
de unicidade e lease dessas tabelas (evento único por agregado, lease
exclusiva por `for update skip locked`, idempotência HTTP, `object_key`
único, ledger idempotente por `(origem, legacy_task_id)`) estão provados
contra o Postgres real em `integracao.test.ts`, não só descritos aqui.

## Agenda do motor de Automações (Fase 3)

`005-agenda-de-automacoes.sql` cria **uma** tabela, `plataforma.automacao_agenda`
(PK `(workspace_id, list_id, dia_civil)`), para o motor de Automações
(AUTO-01). Ela é exclusão mútua e auditoria — **nunca idempotência**. A
idempotência de Automação agendada mora em `AutomationExecution` e na
checagem `jaRodou` de `runScheduledAutomations`
(`packages/dominio/src/operations/automations.ts`), que é pura e já decide
sozinha se um par (Automação, Tarefa) rodou hoje; repetir esse controle aqui
criaria uma segunda fonte de verdade a manter sincronizada com a primeira.

O que só o banco dá, e é por isso que a tabela existe: (1) duas instâncias do
`apps/api` não processam o mesmo dia, porque a reivindicação é
`for update skip locked` sobre `estado in ('pendente','falhou')` com
`locked_by`/`locked_at` — o mesmo padrão de lease de
`outbox-worker.ts::reivindicar()` — e DEC-06 serializa escrita por Espaço, de
modo que duas hidratações simultâneas do mesmo Espaço só dariam conflito de
revisão; (2) o dia processado fica observável: uma linha `falhou`, ou uma
`processando` com `locked_at` vencido, é o sinal de que o processo caiu antes
de fechar o dia, e a varredura devolve a linha para `falhou` em vez de o dia
sumir. As quatro garantias (um dia por Lista, reivindicação exclusiva,
`estado` fora do check recusado, dia retomável) estão provadas contra o
Postgres real em `agenda-de-automacoes.test.ts`.

Como as seis tabelas de `003`, esta **não entra em `hidratar()`/`gravar()`** e
`repositorio.ts` não a conhece: quem escreve nela é o scheduler-worker da
Fase 3, direto contra o `pg.Client` da sua própria transação.
`last_error_code`/`last_error_summary` só recebem a saída de
`sanitizarErro()`; nenhuma coluna guarda CPF, CNPJ, chave Pix, código de
barras, valor ou nome de fornecedor (T-3-04).

A importação histórica de Contas a pagar (Planos 03-09/03-10) **reusa**
`plataforma.importacao_ledger` de `003` com `origem = 'clickup:901107637383'` —
nenhum ledger novo nasce para este domínio, porque dois ledgers para a mesma
reconciliação seriam duas contagens a manter iguais.

## A ponte dos Canais saiu (Fase 15, 3.5.4)

`008-canais-conversas-mensagens.sql` cria `plataforma.canais`,
`plataforma.conversas` e `plataforma.mensagens`: **fora de
`hidratar()`/`gravar()`**, como as de `003` e a de `005`. Na Fase 8 o resto do
app ainda lia o Canal do modelo antigo em inglês, e `canais-projetados.ts`
traduzia a tabela nova para ele em `GET /estado` e em `executar()` (D-11). Essa
ponte **saiu na Fase 15 (plano 15-33)**: todas as telas passaram a ler o Canal
por `GET /canais` (`useCanais`), e as Ferramentas (Grupo, Flow e Automação)
recebem o Canal pelo `crm.canais` que o servidor lê da tabela dentro da
transação (`rotas/gesto-no-crm/`). Sem a ponte:

- `GET /estado` não traz Canal em `state.channels`; o Canal só existe em
  `plataforma.canais`.
- `executar()` não lê Canal: nem no lote de entrada, nem na guarda
  `to_regclass`, nem em ida própria, e grava `antes.state` como hidratou. A
  medição perdeu o campo `canaisMs`.
- O serviço de Canais confere nome e conta só dentro de `plataforma.canais`; o
  `channels` de `plataforma.registros` deixou de bloquear a criação (o Canal
  antigo sai no script de migração do corte).
- `plataforma.registros` nunca ganha linha de `channels` pelo caminho novo
  (D-12), e a escrita REST de Canal continua somando a revisão do Espaço (A4),
  então uma `executar()` em voo sobre o estado antigo cai em conflito e tenta de
  novo em vez de gravar por cima.

O que ainda lê `state.channels` é o Grupo e o Flow (F14-D-05):
`operations/ferramentas/conversa-de-grupo.ts` procura o Canal primeiro em
`state.channels` e, na falta dele, no `crm.canais` da operação. Esse arquivo
sai com as Sessões 6 e 7.

## Banco fechado e RLS adiada (Fase 9)

**O que a `009-seguranca-e-cofre.sql` faz** (SEG-04, D-04 a D-06, D-17), nesta
ordem: cria `plataforma.credenciais` (o cofre: segredo só cifrado, com
`iv`, `etiqueta` e `versao_da_chave`, e um índice único parcial
`credenciais_ativa_unica` — uma credencial ativa por dono e tipo); fixa
`search_path = pg_catalog, plataforma` nas três funções da 007; revoga
`plataforma` de `anon`, `authenticated` e `public` (cada papel só se existir em
`pg_roles`: o Postgres dos testes e do CI não os tem); desliga a RLS em toda
tabela de `plataforma`; concede a `n1_api`, se ele existir, só DML; e revoga o
`execute` de `public.rls_auto_enable()` se ela existir, sem derrubar o deploy
quando o dono da função é outro. Tudo na transação de `migrar()`: se falhar,
nem a linha em `plataforma.migracoes` nem os `revoke` ficam. Provada em banco
novo, com e sem os papéis do Supabase, em `src/seguranca/banco-n1-api.test.ts`.

**`n1_api` só com DML e as duas variáveis.** O app conecta como `n1_api`
(`DATABASE_URL`): `usage` no schema, `select/insert/update/delete` nas
tabelas, `usage/select` nas sequências, `execute` nas funções, e **nada** de
escrita em `plataforma.migracoes` — `drop table` e `create table` voltam
`42501`. Não há DDL em `apps/api/src` fora de `migrar.ts`, então isso basta. A
migração, o `banco:conceder` e o backup conectam como o dono do banco
(`DATABASE_URL_MIGRACAO`, `poolDeMigracao()` em `conexao.ts`; sem ela cai em
`DATABASE_URL`). As duas linhas do `api.env` **mudam juntas**: com o app em
`n1_api` e sem `DATABASE_URL_MIGRACAO`, o próximo `migrar` roda como `n1_api`,
falha no DDL e o deploy volta a versão anterior. No pooler compartilhado o
usuário é `n1_api.<ref>` (ver `.env.example`).

**`npm run banco:conceder`.** O papel pode nascer depois da `009`, e editar a
`009` aplicada é proibido. `apps/api/deploy/conceder-n1-api.sql` (fora de
`migracoes/`, a única pasta que `migrar()` lê) repete o bloco de `n1_api` da
`009`; `concederN1Api` o roda se o papel existir e diz "o papel não existe"
se não. É idempotente e deve rodar **a cada deploy, depois do `migrar`**
(09-11). Um teste compara a matriz de privilégios e os privilégios padrão do
caminho "`009` com o papel" com o de "`009` sem o papel + script".

**RLS por `workspace_id`: adiada pela decisão 12.1** (mais de uma empresa no
sistema; hoje há um Espaço de Trabalho em produção). Não foi esquecida:
adicioná-la depois é **custoso** e esta é a lista para a Sessão 12 não
redescobrir. São 103 usos de `pool()` em cerca de 40 arquivos, e vários
caminhos consultam **antes de saber o Espaço**, então uma policy por
`workspace_id` pediria um papel com bypass ou uma exceção por caminho:

- as rotas públicas de Formulário e de Tarefa (o segredo na URL identifica o
  Espaço; a rota ainda não o conhece);
- a credencial de serviço (a chave de serviço entra sem Membro);
- o outbox e a agenda de Automações (rodam em laço, por todos os Espaços);
- os webhooks de Canal (o Espaço sai do Canal, não da sessão).

O custo é: `executar` em `unidade-de-trabalho.ts` e os repositórios do CRM
passariam a abrir toda transação com `set_config('app.workspace_id', …, true)`,
e cada caminho acima precisaria de papel com bypass ou de policy própria. Até lá
a `009` **desliga** a RLS (D-05) em vez de deixá-la ligada e sem policy.

**F7, lembrete para toda migração futura.** Se o projeto tem o event trigger
`ensure_rls` (a função `public.rls_auto_enable()` do guia do Supabase), toda
tabela nova de `plataforma` nasce com RLS ligada e sem policy, e `n1_api` (sem
`bypassrls`) enxerga **zero linhas**. A `010`, a `011`… que criarem tabela em
`plataforma` repetem o bloco "desliga RLS" da `009`, ou o dono remove o event
trigger. Conferência antes de trocar a conexão do app:
`select relname from pg_class where relnamespace = 'plataforma'::regnamespace and relkind = 'r' and relrowsecurity;`
deve voltar 0 linhas.
