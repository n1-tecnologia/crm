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
| 7 | **Resultado da UAT de fim de fase** (`## Roteiro da UAT`, 08-15): dez passos no app real, mais as conferências visuais, com a coluna "Resultado" em branco | aberto — do dono |

---

## Portão

Plano 08-15, Task 2. **2026-10-12, `main@79304b6`** (o commit dos `CONTEXT.md`
da Task 1; nenhum código mudou nesta fase de fechamento), no checkout
principal, com o `apps/api/.env` da plataforma e a **008 já aplicada** (0
pendentes, ver "Confirmação"). É a primeira vez que o código da ponte (D-11)
roda contra um banco da plataforma que tem `plataforma.canais`. Nenhum segredo
está nesta seção: só os resumos do vitest, os nomes de arquivo e a lista de
rotas do build (T-08-57).

### `npm run check`

Terminou com **exit 1**. Pela régua do plano ("só as duas falhas
pré-existentes"), **este portão não é verde limpo**: além das duas aceitas,
um terceiro arquivo falhou uma vez e passou isolado (abaixo). Não o registro
como verde.

| Etapa | Resultado |
|---|---|
| `typecheck` (`@n1/api`, `@n1/web`, `@n1/dominio`) | verde, 0 erros |
| `lint` (`@n1/web`) | 0 erros, 3 avisos `no-unused-vars` pré-existentes (`KnowledgeDocument`, `Target`, `memberReachesContainer`), nenhum em arquivo desta fase |
| `verificar:tokens` | `445 definidos · 356 arquivos varridos · 0 falhas` |
| `verificar:contratos` | passou; o repositório irmão `financeiro-tria` não existe neste notebook, e o script avisa e pula a comparação (mesmo aviso das fases anteriores) |
| testes `@n1/web` | `Test Files  60 passed (60)` · `Tests  546 passed (546)` |
| testes `@n1/dominio` | `Test Files  83 passed (83)` · `Tests  1785 passed (1785)` |
| testes `@n1/api` | `Test Files  3 failed \| 115 passed \| 15 skipped (133)` · `Tests  6 failed \| 1214 passed \| 198 skipped \| 1 todo (1419)` · 836,71 s |

**Arquivos que falharam em `@n1/api`, cada um com a razão:**

| Arquivo | Situação | Razão |
|---|---|---|
| `src/e2e/lote-contas-a-pagar.test.ts` (5 de 6) | **aceito, pré-existente (Fase 3/03-12, `deferred-items.md` da Fase 7)** | asserções de tempo de lock e semeadura de 61 contas contra o Supabase da plataforma; é o Financeiro, nada de Canal o toca. Mesmos cinco casos (a)–(e) de antes. |
| `src/rotas/formularios-publicos.test.ts` (suíte de Automação de Canal, `beforeAll`) | **aceito, pré-existente (Fase 5/05-17, `deferred-items.md` da Fase 7)** | `seed de teste: A pergunta "Centro de Custo (Financeiro)" aponta para um Campo que esta Lista não tem.` — configuração do Financeiro na Lista de Solicitações. Os demais casos do arquivo passam (11 passam, 2 pulam). |
| `src/persistencia/colunas-geradas.test.ts` (1 de 8, "due_date: coluna gerada ordena como dueDate.value") | **NÃO listado como aceito — flaky, tratado abaixo** | a ordem de três registros de mesmo vencimento (`tsk_cp_aluguel_out`, `tsk_cp_condominio`, `tsk_cp_energia`) veio diferente da ordem estável do JavaScript: o `select … order by due_date` do teste não tem desempate, e o Postgres devolve empates em ordem não especificada. |

**O terceiro arquivo, honestamente.** `colunas-geradas.test.ts` não foi
tocado por esta fase (último commit no arquivo: `0c1a26b`, Plan 01-06; a
migração 002 que ele cobre também não mudou) e não lê `plataforma.canais`. Foi
re-executado **sozinho**, no mesmo checkout e contra o mesmo `.env`:

```
$ cd apps/api && npx vitest run src/persistencia/colunas-geradas.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

Resultado nas duas execuções: **falhou 1 vez no `check` completo, passou 1 vez
isolado.** Isso é instabilidade de ordem de empate no banco compartilhado, não
regressão da Fase 8; fica registrado em
`.planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/deferred-items.md`
para quem tocar nesse teste (a correção é um `order by due_date, id` com o
mesmo desempate no sort do JS). Nenhum arquivo de Canal, Conversa, Mensagem, a
ponte (`canais-projetados`, `executar`) ou `estado.test.ts` falhou.
`outbox-worker.test.ts`, o arquivo que 08-07 viu instável em execuções
paralelas, passou nesta execução em série.

**O que o `skipped` significa (198 testes em 15 arquivos).** Os blocos
`describeComBanco` (`apps/api/src/testes/banco-crm.ts`) só rodam com
`DATABASE_URL` em `localhost`/`127.0.0.1`: contra o Supabase do `.env` eles
pulam por desenho (T-07-08, nunca aplicar `migrar()` num banco remoto sem
conferir), e é nesses blocos que moram as provas de banco de Canal, Conversa e
Mensagem de 08-01..08-13. Para não deixar o pulado passar por provado, as
mesmas suítes foram rodadas uma vez, nesta sessão, num Postgres 16 descartável
(`crm-n1-pg-0815`, porta 55595, parado e removido depois):

```
$ DATABASE_URL=postgres://postgres:x@localhost:55595/postgres \
    npx vitest run canais conversas mensagens crm contato-com 008
 Test Files  23 passed (23)
      Tests  319 passed (319)
```

(a URL acima é a do container descartável, sem relação com o banco da
plataforma.) Os testes que usam `Boolean(DATABASE_URL)`, como
`rotas/estado.test.ts`, rodaram no `check` contra o banco da plataforma com a
008, e passaram.

### `npm run build`

**Exit 0.** Rotas da Fase 8 na listagem do `next build`, todas dinâmicas (`ƒ`):

```
├ ƒ /crm/caixa-de-entrada
├ ƒ /crm/caixa-de-entrada/[conversa]
├ ƒ /crm/caixa-de-entrada/configuracoes
├ ƒ /crm/caixa-de-entrada/configuracoes/canais/[canal]
├ ƒ /crm/caixa-de-entrada/configuracoes/canais/conectar
├ ƒ /crm/caixa-de-entrada/configuracoes/canais/conectar/[provedor]
├ ƒ /crm/caixa-de-entrada/configuracoes/filas/[fila]
```

As duas rotas novas de conexão (`/conectar` e `/conectar/[provedor]`) estão
listadas.

### Grep de segurança (T-08-56)

```
$ git grep -n "dangerouslySetInnerHTML=" -- apps/web/src/features/crm "apps/web/src/app/(shell)/crm/caixa-de-entrada"
(sem saída)   exit 1
```

Nenhum componente do chat ou das páginas de Canal renderiza HTML cru.

---

## Roteiro da UAT

**Quando:** no lote de fim de fase, depois da verificação automática da fase
(verificador, revisão de código, regressão). **Onde:** no app real — `npm run
dev` da raiz sobe web (3001) e api (3002) contra o banco da plataforma, com a
008 aplicada (08-14, "Confirmação": `0 pendente(s)`). **Quem:** o dono, ou
quem ele indicar, com dois logins reais do Supabase no mesmo Espaço de
Trabalho: um Administrador (ou Proprietário) e um Membro (B35). **Por que
humano:** o fluxo depende de JWT real do Supabase, do navegador e do banco da
plataforma com a 008 — nenhum teste automatizado desta base tem os três
juntos (`08-VALIDATION.md`, "Manual-Only Verifications"). O que está coberto
por teste: o mesmo fluxo por `app.inject` contra Postgres local
(`apps/api/src/e2e/canais-fluxo.test.ts`, 08-13, 9 casos) e as telas por
teste de componente com `fetch` falso (08-08 a 08-11).

Antes de começar: `lsof -nP -iTCP:3001 -sTCP:LISTEN` e `…:3002…` vazios (ou o
`npm run dev` deste checkout já de pé); a api precisa do `apps/api/.env` da
plataforma. **Recarregar a página depois de cada gravação é parte do
critério:** o dado tem de vir da api, não da memória da tela. Use dois números
distintos, **A** para o "Comercial" e **B** para o "Suporte" (o mesmo número
não vai nos dois provedores, ver "Limitações aceitas", item 5). Os Canais
criados aqui ficam no Espaço depois da UAT; arquive-os no passo 10 ou deixe-os,
como preferir.

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 1 | Como Administrador, `/crm/caixa-de-entrada/configuracoes` → "Conectar Canal" | Chega na página dos quatro cartões: WhatsApp oficial, WhatsApp não oficial, Instagram, E-mail | |
| 2 | Cartão **WhatsApp oficial** → orientação com três passos e o espaço "Token de acesso e número verificado" → Nome **Comercial**, o número **A**, um Setor → "Conectar" | Os três passos aparecem com o espaço reservado do token; a ficha abre com o Canal **desconectado**; recarregar mantém o Canal, o nome, o número e o Setor | |
| 3 | Voltar → cartão **WhatsApp não oficial** → Nome **Suporte**, o número **B** → ficha desconectada. Tentar de novo o não oficial com o número **A** | O Suporte nasce desconectado e persiste ao recarregar. A segunda tentativa é **recusada** com "Esta conta já está conectada em outro Canal ativo." e um link para o Canal que já usa o número | |
| 4 | Na ficha de cada um, "Simular conexão" | O Canal passa a **conectado** com a marca "conexão simulada" e o aviso de que nenhuma Mensagem sai da plataforma; recarregar mantém a conexão e a marca | |
| 5 | Configurações da Caixa de Entrada, lista de Canais | "Comercial" (selo **oficial**, marca **cadastrado**), "Suporte" (selo **não oficial**, **cadastrado**) e "Comercial SP" (do seed, marca **demo**) aparecem juntos e distinguíveis | |
| 6 | Abrir um Contato do seed com WhatsApp (pela Caixa de Entrada ou pela ficha legada) | Abas "Comercial · WhatsApp oficial", "Suporte · WhatsApp não oficial" e "Comercial SP · WhatsApp oficial"; a aba de e-mail aparece desligada se o Contato não tem e-mail | |
| 7 | No compositor, "Responder por" → "Suporte" | A aba muda para Suporte; o topo do fio mostra Suporte com o selo do provedor e a marca de conexão simulada; uma Mensagem livre é enviada **sem pedir modelo** e sem aviso de janela de 24 h | |
| 8 | Caixa de Entrada | O item da Conversa mostra o ícone e o nome "Suporte"; o filtro "Canal" lista "Suporte · WhatsApp não oficial" e, escolhido, filtra a lista | |
| 9 | Sair e entrar como **Membro** → Configurações da Caixa de Entrada e ficha de um Canal | "Conectar Canal" aparece **desabilitado** com a frase de quem administra; a ficha não tem "Simular conexão" | |
| 10 | De volta como Administrador: "Desconectar" o Suporte; depois "Arquivar" | Desconectar leva a ficha a **desconectada**; arquivar tira o Canal dos Canais ativos (some da lista e das abas do Contato); recarregar mantém ambos | |

**Esperado em geral:** cada passo grava e relê (recarregar mantém o dado); os
Canais novos nascem desconectados e só ficam conectados pelo "Simular
conexão", sempre marcado; os dois WhatsApps aparecem separados por nome e selo
em todas as telas; trocar o "Responder por" nunca move uma Conversa existente
de Canal.

**O que olhar com olho humano, passo a passo** (os testes provam o
comportamento e o texto, não o visual — são as conferências de juízo que os
planos 08-01, 08-02, 08-08, 08-09, 08-10 e 08-11 deixaram para esta UAT; anote
em "Resultado" se algo estiver feio, ilegível ou confuso, mesmo que o passo
funcione):

| Passo(s) | O que julgar | Plano que deixou |
|---|---|---|
| 1–3 | hierarquia visual dos quatro cartões, do bloco de passos e do espaço tracejado reservado ao token/QR; a orientação se entende sem ajuda | 08-08, 08-01 |
| 2–3 | o layout do formulário (Nome, número, Setor, Origem) e a página `[provedor]` | 08-01, 08-08 |
| 4 | a faixa de aviso "conexão simulada" e os botões da ficha: legíveis, e fica claro que nada sai da plataforma | 08-09 |
| 5 | os selos (oficial / não oficial / cadastrado / demo) distinguem os Canais sem precisar ler o nome inteiro | 08-01 |
| 6–7 | o desenho das abas com rótulo longo "Nome · Provedor", a barra do topo com ícone + nome + selo + marca simulada e o "Responder por" no topo do compositor | 08-10 |
| 6, 7 | para o Suporte (não oficial): a barra de modelo **não** aparece, não há ponto de janela de 24 h aberta nem marcador "fora da janela" — o oficial continua com eles | 08-02 |
| 6 | os atalhos WhatsApp / E-mail das fichas (Contato, Empresa, Negócio, Tarefa) levam à aba certa quando há dois WhatsApps | 08-10 |
| 8 | o nome do Canal na linha de meta do item cabe na largura real da coluna (truncamento, quebra de linha) | 08-11 |

**O que este roteiro fecha no `WINDOWS.md`:** a janela `unrun-verify` da Fase
8 (#6: a UAT de fim de fase e as conferências visuais dos planos 08-01, 08-02,
08-08, 08-09, 08-10 e 08-11) fica `open` até o dono preencher a coluna
"Resultado". A janela #7 (`deviation`) registra a instabilidade de
`colunas-geradas.test.ts` no portão.

---

## Limitações aceitas

O que a UAT **não** vai encontrar funcionando, de propósito, e onde cada
limitação está decidida. Nada disto é defeito desta fase.

1. **D-11 — o chat segue no modelo antigo.** Conversas e Mensagens que a tela
   cria vão para `plataforma.registros` (operações `startConversation` e
   `sendMessage` do domínio), não para `plataforma.conversas` e
   `plataforma.mensagens`. `POST /conversas` e `POST /mensagens` existem e
   estão provados (08-06, 08-12, 08-13), mas só se alcançam por REST ou por
   teste, não pela tela. A tela enxerga os Canais da tabela por projeção (a
   ponte de `GET /estado` e `executar()`), nunca o contrário. Some na fase de
   unificação.
2. **Pitfall 8 — Contatos da Fase 7 e o chat não se enxergam.** Um Contato
   criado em `/crm/contatos` (tabela da 007) não aparece no chat, e os Contatos
   do modelo antigo (os do seed) não aparecem nas listas novas. Por isso o
   passo 6 usa um Contato **do seed**. Mesma família do D-15 da Fase 7.
3. **D-12 — o seed continua.** Os Canais, Conversas e Mensagens do seed
   continuam existindo e aparecem marcados como **demo**, ao lado dos Canais
   **cadastrados**. A ficha do Canal do seed grava pela operação antiga, não
   por REST.
4. **Decisão 1 — o popup de Lista nasce `conectada`.** O popup de adicionar
   Canal das Listas é o caminho legado: o Canal sai já `conectada` em
   `plataforma.registros`, sem passar pela página de conexão. C36 deixa de
   valer só para os Canais criados pela página nova (D-08). Pendência do dono
   (abaixo).
5. **Decisão 3 — o mesmo número não vai em oficial e não oficial.**
   `canais_conta_uq` é por (tipo, identificador), sem o provedor (INV-CXE-01),
   e vale também contra o `channels` do seed. Confirmado pelo dono em 08-14,
   antes de a 008 ficar imutável. É por isso que o roteiro usa dois números.
6. **Decisão 2 — sem aba "Todas".** O separador "via …" (`SeparadorDeCanal`,
   derivado por `marcadoresDeCanal`) está ligado às Mensagens, mas numa aba por
   Canal todas as Mensagens são de um Canal só, então ele não tem onde aparecer
   e não tem prova positiva (08-10). A aba "Todas" fica para a unificação,
   pendência do dono.
7. **Decisão 4 — Flows e "enviar ao contato" das Automações não distinguem os
   dois WhatsApps.** Com o oficial e o não oficial no mesmo Espaço, uma
   automação de Canal ainda não diz a qual dos dois se refere (o payload de
   `automacao.notificar-canal.v1` leva o tipo do Canal, não o id). Decidir a
   regra antes de a fase de Flows ligar nisto.
8. **Decisão 7 (08-09) — "Simular conexão" existe no Espaço de produção.**
   Enquanto não há provedor real, é o único jeito de conectar um Canal novo;
   fica visível só para Administrador/Proprietário e sempre marcada. Se deve
   continuar visível no Espaço de produção depois que houver provedor real é
   decisão do dono (abaixo).
9. **A reabertura automática de Conversa por Mensagem recebida espera a Caixa
   relacional.** `registrarRecebida` (08-12) é idempotente e guarda a carga
   bruta, mas não reabre sozinha uma Conversa resolvida: isso depende de a
   Caixa de Entrada ler Conversas da tabela nova.
10. **`isOutsideWindow` usa a última atividade como "agora"** (visto em 08-11,
    anterior a esta fase e fora do escopo dela). A janela de 24 h exibida na
    tela do oficial pode divergir do relógio real; o servidor (08-12) aplica a
    janela com o relógio dele.
11. **Mensagem com `em_resposta_a_id` inexistente ou de outra Conversa recebe a
    mesma frase `RESPOSTA_DE_OUTRA_CONVERSA`** (08-12): a FK dispara nos dois
    casos e o servidor não os distingue na mensagem. Não vaza se o id existe em
    outro Espaço.
12. **`outbox-worker.test.ts` é instável só em execução paralela contra banco
    compartilhado** (08-07). No portão, com `fileParallelism: false`, passou.
13. **Portão `npm run check` com duas falhas pré-existentes fora desta fase**
    (`deferred-items.md` da Fase 7): `apps/api/src/e2e/lote-contas-a-pagar.test.ts`
    (5 de 6, asserções de tempo de lock contra o banco remoto) e a suíte
    "Automação de Canal publicada na Lista de Solicitações (CR-05/05-17)" de
    `apps/api/src/rotas/formularios-publicos.test.ts` (o seed aponta para um
    Campo que a Lista não tem). Mais uma instabilidade nova, não aceita como
    pré-existente: `colunas-geradas.test.ts` (empate de vencimento sem
    desempate; passou isolado — `deferred-items.md` desta fase).
14. **`DATABASE_SSL_INSECURE=true` no `.env` deste notebook** (a linha
    `[conexao]` das saídas de 08-14, T-02-TLS): a verificação da cadeia TLS do
    Postgres está desligada no desenvolvimento, por decisão da Fase 2. Fora do
    notebook, `DATABASE_CA_CERT` ou `DATABASE_CA_PATH` é obrigatório.

## Correção depois da verificação (2026-10-12)

Ao começar a UAT, o dono não encontrou a página de Configurações da Caixa de Entrada: ela existia desde a Fase 7, mas nenhum menu apontava para ela (nem a Caixa, nem as Configurações do Espaço). Nem o code review nem a auditoria de UI viram a lacuna, porque olharam só as telas novas.

Correção em `main@0b5c5b3`, decidida pelo dono ("implementar agora"): ícone de engrenagem no cabeçalho da coluna de Conversas (`inbox-columns.tsx`, link "Configurações da Caixa de Entrada") e cartão "Caixa de Entrada" na página `/configuracoes`. Teste (5) em `inbox-columns.test.tsx`; `tsc`, `eslint` e `verificar:tokens` sem falha. O passo 1 do Roteiro da UAT passa a começar pela engrenagem da Caixa, não pela URL.
