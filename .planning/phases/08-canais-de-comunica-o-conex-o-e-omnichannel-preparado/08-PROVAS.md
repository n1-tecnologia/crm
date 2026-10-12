# Fase 8 — As provas

Plano 08-14. A regra das Fases 6 e 7 vale aqui: "provar é a mesma coisa". A
fase leva a 008 ao banco da plataforma pelo mesmo ritual da 007 (07-13): o
dono confirma o contrato que vai ficar imutável, a conferência seca mostra a
008 pendente, a aplicação a leva ao banco e uma segunda conferência seca
mostra nenhum pendente. As quatro etapas estão registradas abaixo, as quatro
do mesmo dia.

**Estado deste relato (2026-10-12):** decisão, conferência, aplicação e
confirmação registradas. Nenhum segredo está neste arquivo: as saídas abaixo
são só as linhas do `migrar` e não trazem `DATABASE_URL`, host nem senha
(T-08-54).

Ponto de partida do código: `main` em `b3940f1` (o último commit de 08-13),
com `apps/api/migracoes/008-canais-conversas-mensagens.sql` como foi entregue
em 08-01 e provada em 08-04.

O que `--seco` faz (`apps/api/src/persistencia/migrar.cli.ts` →
`migracoesPendentes()` em `migrar.ts`): lê a pasta `migracoes/` na mesma
ordem em que `migrar()` aplicaria, pergunta `to_regclass('plataforma.migracoes')`
e, só se a tabela de controle existir, faz `select nome` nela. Imprime
`aplicada  <nome>` ou `pendente  <nome>` por arquivo e a linha
`N pendente(s); nada foi aplicado (--seco).`. Não há `create` nem `insert` no
caminho. Sem `--seco`, o mesmo comando aplica o que falta, cada arquivo numa
transação, e registra o nome em `plataforma.migracoes` — por isso um arquivo
aplicado é imutável (DEC-10) e qualquer ajuste de schema da Caixa de Entrada,
daqui em diante, é `009`.

---

## Decisão do dono sobre o contrato

**Pergunta (Task 1, D-09, `blocking-human`):** aplicar a 008 no banco da
plataforma com o contrato atual? Depois de aplicada ela é imutável: mudar um
slug de provedor, o índice de unicidade de conta ou uma coluna passa a ser a
`009`, mais o contrato REST e a URL `[provedor]`.

O que fica gravado com a aplicação:

| Ref. | O que fica imutável |
|---|---|
| A1 | os quatro slugs de provedor no `CHECK` e na URL: `whatsapp-cloud`, `whatsapp-nao-oficial`, `instagram-graph`, `email-imap-smtp` |
| A2 | `canais_conta_uq` por (tipo, identificador) entre Canais ativos, sem o provedor (INV-CXE-01): o mesmo número não vai em oficial e não oficial ao mesmo tempo |
| A6 | colunas além da lista de D-10: `seq`, `leituras_internas`, `registrado_em`, `conexao_simulada`, `conectada_em`, `grupos_habilitados`, `proprietario_padrao_id` |
| A9 | `carga_bruta` guardada e fora de toda resposta HTTP |

**Evidência apresentada ao dono:** as 17 invariantes provadas no Postgres 16
local por SQLSTATE e nome de constraint, mais a idempotência da segunda
execução (08-04, `canais-008.test.ts`), e o cenário "dois WhatsApps lado a
lado" por HTTP, 9 testes sobre `buildApp()` real (08-13, `canais-fluxo.test.ts`).

**Resposta do dono: "aplicar"** — aplicar agora, com o contrato atual (A1, A2,
A6 e A9 como estão). Nenhum ajuste pedido.

### Desvio registrado em relação ao roteiro do plano

O plano roteirizava a aplicação (Task 2) como feita pelo dono, no terminal
dele. Não foi assim:

1. O dono primeiro respondeu "aprovado" à Task 2 sem colar as saídas; a
   conferência seca de leitura feita pelo orquestrador mostrou a 008 ainda
   `pendente`.
2. O orquestrador então perguntou explicitamente quem deveria aplicar, e o
   dono escolheu **"Eu mesmo aplico (você roda o migrar)"** — uma autorização
   explícita, dada uma única vez na sessão, para o agente (o orquestrador, não
   o executor deste plano) rodar `npm run migrar -w @n1/api` sem `--seco`
   contra o banco da plataforma.
3. A aplicação foi executada **uma vez** pelo agente sob essa autorização,
   imediatamente seguida de uma conferência seca de leitura. O executor de
   08-14 não rodou `migrar` sem `--seco` em nenhum momento.

Nada mais do ritual mudou: decisão do dono antes, conferência seca antes,
aplicação de uma só vez, confirmação seca depois.

---

## Conferência

**Feita pelo orquestrador (somente leitura) em 2026-10-12, no checkout
principal, com o `apps/api/.env` da plataforma, e repetida logo antes da
aplicação — as duas saídas foram idênticas.** É o passo 1 da Task 2: antes do
primeiro `migrar` com a 008, ver o que ele aplicaria. O critério de parada era
a 008 aparecer como `aplicada` ("008 já aplicada") — nesse caso o plano não
seguiria. Não foi o caso.

```
$ npm run migrar -w @n1/api -- --seco

[conexao] DATABASE_SSL_INSECURE=true: a verificação da cadeia TLS do Postgres está DESLIGADA. Isto é proibido fora de desenvolvimento local — nesse modo um MITM na rota poderia ler e alterar dado financeiro sem detecção (T-02-TLS). Fixe DATABASE_CA_CERT ou DATABASE_CA_PATH antes de qualquer ambiente que não seja o notebook do desenvolvedor.
aplicada  001-plataforma.sql
aplicada  002-registros-colunas-geradas.sql
aplicada  003-integracao-e-importacao.sql
aplicada  004-outbox-indice-unico-por-workspace.sql
aplicada  005-agenda-de-automacoes.sql
aplicada  006-outbox-indice-unico-canal.sql
aplicada  007-crm.sql
pendente  008-canais-conversas-mensagens.sql
1 pendente(s); nada foi aplicado (--seco).
```

| Critério (Task 2, passo 1) | Resultado |
|---|---|
| `aplicada` para `001-plataforma.sql` … `007-crm.sql` | sim, as sete |
| `pendente  008-canais-conversas-mensagens.sql` presente | sim |
| `aplicada  008-canais-conversas-mensagens.sql` ausente | sim — a 008 nunca tinha sido aplicada neste banco |

A linha `[conexao] DATABASE_SSL_INSECURE=true …` faz parte da saída real e fica
como está: é o aviso de T-02-TLS do `conexao.ts`, que diz que a cadeia TLS do
Postgres não está sendo verificada neste notebook. Não é desta fase (ver
"Fica com o dono", item 5).

---

## Aplicação

**Executada em 2026-10-12T22:02:08Z, no checkout principal, pelo agente
orquestrador sob a autorização explícita do dono (ver "Desvio registrado"
acima).** É o passo 2 da Task 2 — o único comando desta fase que escreve no
banco da plataforma. Uma única execução.

```
$ npm run migrar -w @n1/api

[conexao] DATABASE_SSL_INSECURE=true: a verificação da cadeia TLS do Postgres está DESLIGADA. Isto é proibido fora de desenvolvimento local — nesse modo um MITM na rota poderia ler e alterar dado financeiro sem detecção (T-02-TLS). Fixe DATABASE_CA_CERT ou DATABASE_CA_PATH antes de qualquer ambiente que não seja o notebook do desenvolvedor.
aplicada  008-canais-conversas-mensagens.sql  (905 ms)
```

| Critério (Task 2, passo 2) | Resultado |
|---|---|
| `aplicada  008-canais-conversas-mensagens.sql` presente | sim — 905 ms, uma transação, só ela (001-007 não reaparecem porque já constavam em `plataforma.migracoes`) |

As tabelas de Canais, Conversas e Mensagens nascem vazias. Desfazer, se um dia
for preciso, seria `drop` sem perda de dado — mas o caminho normal, a partir
de agora, é `009`.

---

## Confirmação

Duas conferências secas, ambas somente leitura, depois da aplicação.

**1. Pelo orquestrador, em 2026-10-12T22:02:12Z, quatro segundos depois da
aplicação:**

```
$ npm run migrar -w @n1/api -- --seco

aplicada  001-plataforma.sql
aplicada  002-registros-colunas-geradas.sql
aplicada  003-integracao-e-importacao.sql
aplicada  004-outbox-indice-unico-por-workspace.sql
aplicada  005-agenda-de-automacoes.sql
aplicada  006-outbox-indice-unico-canal.sql
aplicada  007-crm.sql
aplicada  008-canais-conversas-mensagens.sql
0 pendente(s); nada foi aplicado (--seco).
```

**2. Pelo executor de 08-14, em 2026-10-12T22:03:31Z, no checkout principal
(`main` em `b3940f1`).** O ambiente não recusou a conexão nem o comando — o
`--seco` rodou de verdade contra o banco da plataforma (o mesmo `apps/api/.env`
do dono), e esta é a saída:

```
$ npm run migrar -w @n1/api -- --seco

> @n1/api@0.1.0 migrar
> vite-node src/persistencia/migrar.cli.ts --seco

[conexao] DATABASE_SSL_INSECURE=true: a verificação da cadeia TLS do Postgres está DESLIGADA. Isto é proibido fora de desenvolvimento local — nesse modo um MITM na rota poderia ler e alterar dado financeiro sem detecção (T-02-TLS). Fixe DATABASE_CA_CERT ou DATABASE_CA_PATH antes de qualquer ambiente que não seja o notebook do desenvolvedor.
aplicada  001-plataforma.sql
aplicada  002-registros-colunas-geradas.sql
aplicada  003-integracao-e-importacao.sql
aplicada  004-outbox-indice-unico-por-workspace.sql
aplicada  005-agenda-de-automacoes.sql
aplicada  006-outbox-indice-unico-canal.sql
aplicada  007-crm.sql
aplicada  008-canais-conversas-mensagens.sql
0 pendente(s); nada foi aplicado (--seco).
```

| Critério (Task 3) | Resultado |
|---|---|
| nenhuma linha `pendente` | sim — `0 pendente(s)`, nas duas conferências |
| `aplicada  008-canais-conversas-mensagens.sql` | sim — a 008 consta em `plataforma.migracoes` |
| nada foi escrito | sim, por contrato do `--seco` (07-12) e pela própria linha final |

As três saídas são coerentes entre si: 1 pendente antes, a 008 aplicada em
905 ms, 0 pendentes depois (duas vezes). O portão `npm run check` e a UAT de
08-15 passam a rodar a projeção (D-11) contra um banco com a 008.

---

## Fica com o dono

Itens desta fase que dependem de decisão ou de ação do dono, e que nenhum teste
automatizado fecha:

| # | Item | Situação |
|---|---|---|
| 1 | **Caminho legado `criarCanal` / popups de Lista nascendo `conectada`** (decisão 1 do planejamento): as telas antigas que criam Canal pelo modelo em memória continuam criando o Canal já `conectada`, sem o fluxo de conexão da página nova. Decidir se isso fica até a fase de unificação ou se passa a nascer `desconectada` | aberto |
| 2 | **Aba "Todas" para o separador "via …"** (decisão 2): o separador que diz por qual Canal a mensagem entrou depende de a Caixa de Entrada ter a aba "Todas". Decidir se a aba entra agora ou fica para a unificação | aberto |
| 3 | **"Simular conexão" no Espaço de produção** (decisão 7): a conexão simulada (`conexao_simulada`) existe para desenvolvimento e UAT; decidir se o botão fica visível no Espaço de produção ou só em Espaço de teste | aberto |
| 4 | **Flows e automações com dois WhatsApps** (decisão 4): com o oficial e o não oficial no mesmo Espaço, uma automação de Canal precisa dizer a qual dos dois se refere. Decidir a regra antes de a fase de Flows ligar nisto | aberto |
| 5 | **`DATABASE_SSL_INSECURE=true` no `.env` deste notebook** (a linha `[conexao]` das saídas acima, T-02-TLS): a verificação da cadeia TLS do Postgres está desligada no ambiente de desenvolvimento, por decisão da Fase 2. Não é desta fase e não muda o que a 008 aplicou; fora do notebook do desenvolvedor, `DATABASE_CA_CERT` ou `DATABASE_CA_PATH` é obrigatório | aceito desde a Fase 2 |
| 6 | **Qualquer ajuste de schema da Caixa de Entrada a partir daqui** | é `009` — a 008 está aplicada e é imutável |
