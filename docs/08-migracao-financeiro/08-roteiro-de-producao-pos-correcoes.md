# Roteiro de produção depois das correções pós-auditoria

Para: o dono, que roda cada passo que grava em produção. Ordem de cima para
baixo; cada passo diz o que esperar. Plano e estado: `07-plano-de-correcoes-pos-auditoria.md`.

**Regra de ouro:** todo CLI com `--apply` tem um dry-run antes. Rode o
dry-run, compare com o "esperado", e só então o `--apply`. Se o dry-run
mostrar algo diferente, pare e mande a saída.

Onde está o código corrigido:
- CRM N1: `/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao` (branch `integra-frontend-main`).
- Financeiro: `/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria` (branch `main`, local — 116 commits à frente do `origin/main` e 117 do que roda na VPS em `4149032`, sem push; contados em 2026-09-30, em `42ca9b5`).

---

## Passo 0 — Conferência que ficou com você (só lê, nada grava)

O contrato `contas-a-pagar-v1` e os testes da ponte, rodados de novo depois
das correções do legado (o agente não pôde rodá-los nesta rodada):

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && DATABASE_URL= npx vitest run src/automacoes/contrato-contas-a-pagar.test.ts src/automacoes/invocar-agente.test.ts
```

Esperado: todos verdes (o contrato deu 21/21 em 2026-09-28; as fixtures do
`financeiro-tria` não mudaram desde então). E, da raiz do CRM N1, a
comparação da outra matriz de contrato (só lê): `npm run verificar:contratos`.

Depois da Fase 6 (2026-09-29) o contrato é a **v1.1**, com três exemplos a
mais nos dois repositórios, e desde o fechamento da fase (2026-09-30) é a
**v1.2**, com mais sete: 26 exemplos e o README (16 da v1, 3 da v1.1, 7 da
v1.2). O do consumidor dá 43/43, e o de ponta a ponta da ponte, 11/11. Os
números de cada rodada estão em
`.planning/phases/06-conferencia-do-resumo-e-anexos/06-PROVAS.md`.

---

## Passo 1 — Configurar o `ws_n1` (Postgres do CRM N1)

**✅ Aplicado em 2026-09-28** (1a e 1b; a conferência depois deu 0 a fazer).
Os comandos ficam aqui para referência: rodar o dry-run de novo tem de dizer
que não há nada a criar.

Terminal novo:

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao"
```

**1a. Membro "Agente do pipeline"** (quem assina o que o agendador e a ponte gravam):

```bash
npm run solicitacoes:configurar -w @n1/api
```

Esperado no dry-run: `criados 1 — sts_sp_em_revisao` (o Status "em revisão"
das Solicitações, pendente desde D5-06), `agente do pipeline criado`, 3
concessões, 0 divergentes. Então:

```bash
npm run solicitacoes:configurar -w @n1/api -- --apply
```

**1b. Contas a pagar: o que o Omie exige + A7 pausada:**

```bash
npm run contas-a-pagar:configurar -w @n1/api
```

Esperado: 3 exigências novas na saída de "para pagar" (`fd_cp_categoria`,
`fd_cp_fornecedor`, `fd_cp_nome_fornecedor`), `aut_cp_a7` pausada, 0
divergentes. Então:

```bash
npm run contas-a-pagar:configurar -w @n1/api -- --apply
```

Efeito: conta em "para pagar" sem Categoria, Fornecedor, documento e Nome do
fornecedor não sai de lá até ser completada.

**1c. (Opcional agora) limpar lixo de teste no outbox:**

```bash
npm run outbox:limpar-testes -w @n1/api
npm run outbox:limpar-testes -w @n1/api -- --apply
```

---

## Passo 2 — Teste real no Omie (com R$ 1,00)

### 2A. Automático (recomendado)

Um terminal, de dentro de `financeiro-tria/automation` (o `.env` real é lido
dali). Primeiro o ensaio — só leituras, nada gravado:

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && npm run teste:omie-real
```

Esperado: `RESULTADO: OK` (em 2026-09-28 o ensaio passou: fornecedor SAFE2PAY
achado pelo CNPJ, "Contas de consumo" → 2.04.03, código de 36 caracteres
livre). Depois o teste completo — lança R$ 1,00 para um fornecedor que já
existe, confere no Omie, repete (não pode duplicar) e EXCLUI no fim:

```bash
npm run teste:omie-real -- --lancar
```

**Resultado real em 2026-09-28 (autorizado pelo dono):** título
**5871703884** incluído no Omie da Tria (SAFE2PAY, R$ 1,00, vencimento
08/10/2026, categoria 2.04.03, conta corrente 5468785966, Pix TRA/01.3 aceito
sem o fallback Client-1166); os seis campos conferidos; o código de
integração de 36 caracteres gravado inteiro; o segundo `/lancar` devolveu o
mesmo id (`reaproveitado: true`, nada duplicado); excluído — confirmado
depois pelas duas chaves ("não cadastrado"). A conferência final daquela
execução acusou falso positivo (o Omie ainda devolvia o título segundos
depois da exclusão); corrigido em `186147c` (confere pelo id, com espera).

**De novo em 2026-09-29**, depois das correções do legado (elas mexeram no
adaptador do Omie): ensaio OK; `--lancar` com o título **5872219943** —
código de integração, valor, vencimento, categoria, fornecedor e conta
corrente 5468785966 conferidos; o segundo `/lancar` reaproveitou o mesmo id;
excluído e confirmado pelo id ("não cadastrado"). Duas esperas de ~55 s por
`REDUNDANT` do Omie no caminho são normais.

Esperado: todos os passos com ✔ e `RESULTADO: OK`. Se algum passo falhar
depois de o título existir, ele é excluído assim mesmo; se a exclusão falhar,
a saída diz o id para apagar à mão. Opções: `--manter` (não exclui),
`--cnpj=… --nome=…` (outro fornecedor; se não existir, é cadastrado),
`--categoria=…`, `--valor=…` (até 10,00), `--dias=…`.

### 2B. Pela tela, com a Conferência do Resumo (a ponte do CRM N1)

Desde a Fase 6 (2026-09-29) a ponte trabalha em **dois momentos**, como o
legado no ClickUp. Primeiro, assim que a conta fica completa, o Agente
publica o **📋 RESUMO DE PAGAMENTO** no tópico da conta, mencionando o
Financeiro, e abre uma **Conferência**. O Financeiro confere ou pede ajuste.
Só com o Resumo conferido e a conta movida para "em lançamento omie" o Agente
lança no Omie, com os **anexos**. A spec está em
`docs/07-processos/contas-a-pagar.md` §6.3.

A ordem é: **primeiro em modo `conferencia`** (Resumos, Conferências e
revisões de verdade, e **nenhuma** requisição a `/lancar`), e só depois, com
os Resumos certos, em `lancar`.

Três terminais: o Financeiro, um contador de requisições e a API. Use **o
mesmo token** no Financeiro e na API. Gere-o na hora
(`TOKEN=$(openssl rand -hex 24)` numa variável do shell, exportada para os
dois comandos); ele é só local e nunca vai para arquivo nem para o log.
Nada deve estar escutando antes: `lsof -nP -iTCP:3002 -sTCP:LISTEN`,
`lsof -nP -iTCP:4100 -sTCP:LISTEN` e `lsof -nP -iTCP:4101 -sTCP:LISTEN`
vazios (a tela em 3001 pode estar de pé, se for deste checkout).

**Terminal A — Financeiro** (código novo, com o contrato v1.2; escuta só em
127.0.0.1; sem `watch` e sem nada rodando em fundo):

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && HOST=127.0.0.1 PORT=4100 INVOICE_CRON_ENABLED=false INVOICE_EMIT_DRAIN_MINUTES=0 PAYMENT_REQUEST_SOURCE=clickup PLATAFORMA_WEBHOOK_TOKEN= PLATAFORMA_LANCAMENTO_TOKEN="$TOKEN" npx tsx src/server.ts
```

Esperado: `escutando em http://127.0.0.1:4100`, `[cron] desabilitado`,
`[worker-plataforma] desligado (PAYMENT_REQUEST_SOURCE=clickup)` e as linhas
`[seguranca]` (avisos de configuração — normais no local). O que cada chave
desliga neste processo, para ele não disputar trabalho com a produção:
- `PAYMENT_REQUEST_SOURCE=clickup` desliga o worker da plataforma inteiro: a
  fila `platform_adapter_commands`, a varredura de comentários e a
  **varredura de aprovações** do S5 assíncrono (06-09);
- `PLATAFORMA_WEBHOOK_TOKEN=` (vazio) fecha os webhooks
  `/webhooks/plataforma/*` com 401 antes de ler o corpo: nenhuma decisão e
  nenhum S5 depois de um 202. O 06-09 não criou variável nova para isso;
- `INVOICE_CRON_ENABLED=false` e `INVOICE_EMIT_DRAIN_MINUTES=0` desligam as
  notas fiscais.

Sem `npm run dev` (é `watch`) e sem `CONTAS_A_PAGAR_ANEXOS_HOSTS` no modo
`conferencia`, que não chama `/lancar`.

**Terminal C — o contador** (entre a API e o Financeiro). O log do
`automation/` **não** serve para contar: as rotas
`/v1/integrations/contas-a-pagar/*` só registram falhas. Suba um proxy
`node` em `127.0.0.1:4101` que repassa a `127.0.0.1:4100` e anota, por
requisição, só o instante, o método, o caminho e o status — nunca o corpo nem
os cabeçalhos (o token vai no cabeçalho). Foi assim nas provas de 2026-09-29 e
da rodada de fechamento (`06-PROVAS.md`). A API aponta para `4101`.

**Terminal B — API do CRM N1 com a ponte em modo `conferencia`, presa às contas de teste** (sem `watch`: o `vite-node --watch` empilha pontes no mesmo processo):

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao/apps/api" && AGENTE_CONTAS_A_PAGAR_ATIVO=true AGENTE_CONTAS_A_PAGAR_MODO=conferencia AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM="TESTE AUTOMATIZADO" AGENTE_CONTAS_A_PAGAR_AVISAR_ID=<Membro do usuário de teste> AGENTE_CONTAS_A_PAGAR_URL=http://127.0.0.1:4101 PLATAFORMA_LANCAMENTO_TOKEN="$TOKEN" AGENTE_CONTAS_A_PAGAR_ESPACO_ID=ws_n1 AGENTE_CONTAS_A_PAGAR_LISTA_ID=lst_contas_a_pagar AGENTE_CONTAS_A_PAGAR_INTERVALO_MS=20000 npx vite-node src/index.ts
```

Esperado na linha de partida:
`ponte do Agente de lançamento ativa (modo=conferencia resumoAPartirDe=para-pagar conferenciaPorComentario=true integracaoManual=nao-encosta escopo=titulos-com:"TESTE AUTOMATIZADO" avisar=membro-indicado)`.
Com `avisar=financeiro`, com o aviso `AVISAR_ID_INVALIDO`, ou se a API
recusar subir: **pare**. `DATABASE_QUERY_TIMEOUT_MS` fica no padrão (não
`0`: desligaria os prazos do servidor que o 06-13 pôs em cada transação).

As duas variáveis do meio são **só para teste**. Elas existem porque o
`ws_n1` tem as contas reais importadas do ClickUp e a Maryane de verdade:
- `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM` faz a ponte olhar só as contas com
  "TESTE AUTOMATIZADO" no título. O texto é exato, e maiúsculas contam.
- `AGENTE_CONTAS_A_PAGAR_AVISAR_ID` manda toda Menção da ponte para o
  usuário de teste, no lugar do Financeiro, e faz dele o aprovador da
  Conferência (é o que mostra os botões do card para ele). Use o **id do
  Membro** (`mem_…`) do usuário de teste no `ws_n1` (na prova foi
  `mem_tarjrn`). Desde o 06-13 ela **exige** a primeira: com
  `AVISAR_ID` sozinha, a API não sobe. E se o id não for de um Membro ativo,
  a ponte **não age** (nenhuma requisição, nenhuma gravação) e o log avisa a
  cada ciclo com `AVISAR_ID_INVALIDO` — nunca volta a mencionar o
  Financeiro.

Em produção as duas ficam **vazias**. Mesmo sem elas, a conta importada que
ficou parada nunca é varrida: só entra na ponte depois de ser movida de
Status na plataforma.

Não precisa de `AUTOMACOES_WORKER_ATIVO` nem de `AUTOMACOES_ATOR_MEMBER_ID`:
a ponte tem o próprio ciclo, e quem assina é o Agente do pipeline (passo 1a).
Uma gravação na conta cutuca a ponte, que responde em até 2 s; o intervalo
de 20 s é só o relógio de reserva.

**Na tela** (http://localhost:3001 → Financeiro → Contas a pagar):

1. **+ Nova conta** → "TESTE AUTOMATIZADO — OMIE R$ 1,00" (o título precisa
   conter "TESTE AUTOMATIZADO").
2. Preencha: Centro de Custo **TRIA**; Valor **1**; Vencimento **daqui a 10
   dias**; Forma **Chave Pix**; Chave pix (um e-mail de teste); Categoria
   **Contas de consumo**; Fornecedor **CNPJ**; CNPJ de um **fornecedor real
   que já existe no Omie**; Nome do fornecedor. Opcional: um PDF pequeno no
   Campo **Anexo**, para ver o anexo chegar ao Omie no modo `lancar`.
3. Deixe em **"para pagar"**. Em poucos segundos o Agente publica o
   **📋 RESUMO DE PAGAMENTO** no tópico, terminando em `…, confira: responda
   "ok" para eu lançar, ou diga o que ajustar.` Ao lado do Status aparece a
   pílula **"Resumo para conferir"**, e na conta aparece o card
   **"Conferência do Resumo"** (também em IA → Aprovações).
4. Para testar o ajuste: **"Pedir ajuste"** no card, com um motivo — **ou**,
   pelo fio, **"Responder"** no Comentário do Resumo (o que tem a pílula
   "Conferência do Resumo") com o pedido, por exemplo "é prestação comercial,
   não ADM" (para forçar uma categoria, cite o código: "use 2.04.03").
   Esperado: `🔁 Ajuste pedido por …` e, no mesmo fio, o Resumo revisado com
   `Revisado a pedido de …: "…"`, e o card de novo pendente.
5. Confira: **"Conferido, pode lançar"** no card — **ou "Responder"** no
   Resumo com **"ok"** ("Enviar resposta"). Esperado: `✅ Resumo conferido
   por …` no fio, a pílula **"Resumo conferido"** e o card "Conferido por … ·
   por comentário" (ou "· por clique"). Um Comentário novo na raiz do tópico
   não confere: enquanto a Conferência está pendente, o compositor raiz
   avisa para usar "Responder". Só uma mensagem que é inteira aprovação
   aprova ("ok", "certo, pode lançar"); "ok, mas o vencimento é dia 15" é
   ajuste.
6. Mude o Status para **"em lançamento omie"** e não mexa mais.

Esperado em `conferencia`:
- No fio: `Resumo conferido. Neste ambiente o lançamento no Omie está
  desligado (modo conferência): nada foi lançado, a conta fica aqui.`
- A conta continua em **"em lançamento omie"**.
- Requisições a `/resolver` e **nenhuma** a `/lancar`, pelo contador do
  Terminal C (na prova de 2026-09-29, em
  `.planning/phases/06-conferencia-do-resumo-e-anexos/06-PROVAS.md`: 3
  `/resolver`, 0 `/lancar`). Olhe também o log do Terminal B: `Falha de
  banco no ciclo…`, `Ciclo da ponte demorou.` e os códigos
  `TEMPO_DE_CONSULTA_ESGOTADO`/`TEMPO_DE_CONEXAO_ESGOTADO` dizem se os
  timeouts do ciclo de 2026-09-29 voltaram (06-13).

A ponte só lê **respostas** ao Resumo, nunca um Comentário raiz — por isso
o gesto "Responder" (06-14). Quem decide pelo fio é um revisor que alcança a
conta: o Financeiro, ou um Administrador ou Proprietário. No `ws_n1`, com
`AVISAR_ID`, o usuário de teste é o aprovador da Conferência e é
Administrador, então decide pelo clique e pelo fio.

Os passos 1–6 também rodam sozinhos, no navegador, pela jornada. Ela cria
as contas com "TESTE AUTOMATIZADO" no título, confere e pede ajuste
**respondendo no fio** do Resumo (`cp-conferida` responde "ok"; `cp-ajuste`
responde com o pedido) e deixa as capturas na pasta temporária.
`cp-conferida-pelo-card` é o cenário opcional que confere pelo botão do card;
vai na mesma lista (`JORNADA_SO=cp-conferida,cp-ajuste,cp-conferida-pelo-card`):

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && JORNADA_VISIVEL=1 JORNADA_MODO=conferencia JORNADA_SO=cp-conferida,cp-ajuste JORNADA_EMAIL=<e-mail do usuário de teste> JORNADA_SENHA=<senha> npm run jornada:financeiro -w @n1/web
```

Esperado: `RESULTADO: OK — contas: …`; em `cp-conferida`, `Responder "ok"
no fio do Resumo — respondido no fio (<id>)`, o `✅ Resumo conferido`, o
card "Conferido … · por comentário", o aviso do modo conferência e a conta
em "em lançamento omie"; em `cp-ajuste`, `respondido no fio (<id>)`, o
`🔁 Ajuste pedido por`, o `Revisado a pedido de` e o card de novo
"Pendente". No contador, `/resolver` ≥ 3 e `/lancar` = 0. Não edite código
enquanto ela roda: o `next dev` recarrega a tela no meio e o passo falha em
falso. No fim, pare os três terminais e confirme 3002, 4100 e 4101 livres.

**Depois, em `lancar`** (lança de verdade no Omie; só com a sua decisão): o
mesmo Terminal B com `AGENTE_CONTAS_A_PAGAR_MODO=lancar`, mantendo as duas
variáveis de teste, e os passos 1, 2, 3, 5 e 6 numa conta nova, com um PDF
pequeno no Campo Anexo. O **Terminal A precisa de
`CONTAS_A_PAGAR_ANEXOS_HOSTS=<host do Storage do Supabase da plataforma>`**
(o hostname do `SUPABASE_URL` do `apps/api`, sem `https://` e sem caminho).
Sem ela, o anexo volta `ANEXO_HOST_NAO_PERMITIDO` e o título lança sem
anexo (`anexos 0 de 1` no fio, com `• <nome>: não subiu
(ANEXO_HOST_NAO_PERMITIDO)`). Esperado:
- No fio: `✅ Lançado no Omie — título <id> · <conta> · <categoria> (<código>) · anexos 1 de 1`
  (ou `· sem anexos`). O `/lancar` leva `codigoCategoriaConfirmado` e
  `contaConfirmada`; o contador mostra 1 `/lancar`.
- A conta em **"lançado omie"**.
- No Omie: a conta a pagar de R$ 1,00 com o fornecedor certo, a categoria
  conferida, a conta corrente TRIA, o vencimento, a forma Pix (TRA/01.3) e o
  anexo com o nome original.

Se o Omie recusar: `Não consegui lançar no Omie: <motivo> (<código>). A conta
voltou para "para pagar".` — e a conta volta mesmo. Copie o comentário e as
últimas linhas dos terminais. Duas recusas novas da v1.2 seguem o mesmo
caminho: um título que já existe no Omie com outros dados
(`TITULO_EXISTENTE_DIVERGENTE`: `o título <id> já existe no Omie com outros
dados (<campos>)…`) e a conta corrente diferente da conferida
(`CONTA_DIVERGENTE`: `a conta corrente conferida no Resumo (…) não é a que o
Omie usaria agora (…)…`, e o Resumo é republicado para conferir de novo).

Depois: exclua o título no Omie e descarte a conta na plataforma. Pare os
terminais (`Ctrl+C`) e confirme 3002, 4100 e 4101 livres.

Confirmar neste teste (o código não tem como provar sozinho): que o Omie
aceita o `codigo_lancamento_integracao` de ~30 caracteres; qual forma do
filtro de CNPJ acha o fornecedor (aparece no log do Terminal A); o texto real
da recusa quando algo está errado; que o anexo aparece no título com o nome
original e some quando o título é excluído.

**Em produção**, a recomendação é a mesma ordem. Primeiro
`AGENTE_CONTAS_A_PAGAR_MODO=conferencia` com as duas variáveis de teste
**vazias**: a Maryane passa a receber os Resumos das contas completas e
confere na plataforma, e nada vai ao Omie. Contas importadas paradas não
recebem Resumo. Depois de alguns Resumos certos, reinicie a API com
`AGENTE_CONTAS_A_PAGAR_MODO=lancar`. As variáveis estão no Passo 4.

---

## Passo 3 — Supabase do Financeiro (SQL à mão, nunca `db push`)

Siga `financeiro-tria/supabase/manual/README.md`, na ordem:

0. `supabase migration list --linked` (só lê).
1. A consulta que prova quais objetos já existem.
2. `supabase migration repair --status applied <versão>` das migrações
   aplicadas à mão (registra no histórico, não executa).
3. A migração nova `20260928120000_platform_event_receipts_payload.sql` no
   SQL Editor, e o `repair` dela.
4. `supabase/manual/2026-09-28-deduplicar-solicitacoes.sql`, parte por parte:
   pré-visualização → transação com backup → índice único → conferência.
   Fora do expediente, e **depois** do deploy do passo 4 (o código antigo
   recria duplicatas).
4b. `supabase/manual/2026-09-28-limpar-credenciais-das-solicitacoes.sql`
   (README, passo 4b): tira `app_key`/`app_secret` das linhas de solicitação.
   **Depois** do deploy do passo 4 (o código antigo regrava as duas colunas a
   cada passo) e sem esperar o 5. Repita a conferência (iii-b) um dia depois.
5. `20261001120000_remove_anon_read_painel.sql` por último, e só com o painel
   Vercel pausado.

---

## Passo 4 — Deploy do Financeiro na VPS

Depende de você decidir o push (`git push` do `financeiro-tria/main`).

`.env` de produção (`/root/financeiro-tria/automation/.env`) — acrescentar
**antes** de subir o código novo (só nomes aqui; valores nunca em arquivo do
repo nem no chat):

| Variável | De onde vem | Sem ela |
|---|---|---|
| `MP_OMIE_APP_KEY`, `MP_OMIE_APP_SECRET` | O valor que estava no código: `git show 4149032:automation/src/tenants/marcos-paulo/config.ts \| sed -n '34,35p'` (rode no seu terminal) | Todo passo do Marcos Paulo que resolve a conta Omie recusa |
| `FO_EMPRESA_EXO_LOTEAMENTO_APP_KEY/_SECRET`, `FO_EMPRESA_EXO_PARTICIPACOES_APP_*`, `FO_EMPRESA_MARCOS_PAULO_APP_*`, `FO_EMPRESA_OLIVEIRA_PARTICIPACOES_APP_*`, `FO_EMPRESA_KONQ_APP_*` (a KONQ aceita também as `OMIE_FINQ_APP_*`) | A credencial do Omie de cada empresa do Family Office. Confira quais já existem no `.env` da VPS; a linha `[seguranca]` do boot lista as que faltam | Hoje o lançamento dessa empresa cai **no Omie da Tria**; com o código novo, ele **recusa** com "Configuração ausente" e o nome da variável |
| `OMIE_FINQ_APP_KEY`, `OMIE_FINQ_APP_SECRET` | Só se a FINQ tiver Omie próprio (decisão 1) | A FINQ continua na `OMIE_APP_*` da Tria, como hoje, e o boot avisa |
| `PLATAFORMA_LANCAMENTO_TOKEN` | O mesmo do `apps/api` do CRM N1 | `/v1/integrations/contas-a-pagar/*` e todo POST de `/v1/leituras` dão 401 |
| `PLATAFORMA_LEITURA_TOKEN` | O mesmo do `apps/api` (diferente do de lançamento) | As leituras do CRM N1 dão 401 |
| `PAINEL_LEGADO_ABERTO=true` **ou** `PAINEL_LEGADO_TOKEN` | Transição: `true` mantém o painel Vercel funcionando como hoje | Os botões e listas do painel Vercel dão 401 |
| `CLICKUP_WEBHOOK_SECRETS` | `secret` de cada webhook do ClickUp que aponta para `financeiro.85.155.186.214.nip.io` (API do ClickUp: `GET /team/<time>/webhook`, times 9011731314 e 9011658148), separados por vírgula | Webhooks aceitos sem conferir assinatura (como hoje), com aviso |
| `EXTRATO_WEBHOOK_TOKEN` | Deixe vazio (o upload do painel não manda o cabeçalho) | — |
| `HOST` | Não defina (padrão 127.0.0.1, atrás do nginx) | — |
| `PLATAFORMA_MEMBRO_POR_CLICKUP_ID` (quando ligar `PAYMENT_REQUEST_SOURCE=plataforma`) | Pares `<id do ClickUp>=<id do Membro no ws_n1>`, separados por vírgula. Da Fase 6 em diante precisa ter **`81581816=<Membro de Contas a Pagar>`**: é quem o RESUMO publicado na Solicitação depois da aprovação por clique (S5) menciona. Mais os pares dos Aprovadores, para o "para aprovação". | O RESUMO da Solicitação sai **sem Menção** (nunca com o id do ClickUp), e o log avisa a cada RESUMO (`[summary] sem Membro da plataforma para Contas a Pagar`); o roteamento, também |
| `CONTAS_A_PAGAR_ANEXOS_HOSTS` | Os hostnames de onde o `/lancar` pode baixar anexo, separados por vírgula. **Produção: o host do Storage do Supabase da plataforma**, isto é, o hostname do `SUPABASE_URL` do `apps/api` do CRM N1 — só o host, sem `https://`, sem porta e sem caminho (a comparação é exata, e só `https:` é aceito). A variável continua só o hostname; desde o 06-17 o caminho da URL também tem de ser do Storage (`/storage/v1/object/…`) — nada a configurar a mais: a ponte manda URL assinada do Storage. `/rest/v1`, `/auth/v1`, `/functions/v1` e `/graphql/v1` do mesmo host saem `ANEXO_HOST_NAO_PERMITIDO` | Todo anexo do `/lancar` volta `ANEXO_HOST_NAO_PERMITIDO`, nada é baixado, e o título **lança sem anexo** (`anexos 0 de n` no fio, uma linha `• <nome>: não subiu (ANEXO_HOST_NAO_PERMITIDO)` por anexo); o `/lancar` avisa na montagem |

Os planos 06-09 e 06-10 (S5 assíncrono e S5 sobre o dado atual) **não
criaram variável nova**. Em produção o S5 assíncrono só roda com
`PAYMENT_REQUEST_SOURCE=plataforma` (a varredura de aprovações é o terceiro
passo do worker da plataforma, a cada `PLATAFORMA_FILA_INTERVALO_MS`, padrão
30 s) e com `PLATAFORMA_WEBHOOK_TOKEN` definido (sem ele, o
`/webhooks/plataforma/aprovacao-decidida` é 401). O S5 agora faz um `GET` da
Tarefa pela plataforma a cada ciclo: a plataforma precisa responder.

**O código a subir** (`financeiro-tria/main`, até `42ca9b5`) inclui:
- o contrato `contas-a-pagar-v1.1` (`d462f6e..5a65e5b`) e o S5/S6 da
  Solicitação (`2cd13cd`);
- o contrato **v1.2**: anexos seguros e honestos (`a65a862..364a7ef`, 06-07)
  e o `/lancar` que só reaproveita o título igual e só lança na conta
  conferida, com o código de categoria só de despesa, folha e ativa
  (`317feac..5ceca48`, 06-08);
- o **S5 assíncrono**, idempotente por evento e com repetição só do Resumo
  (`afd2188..9e45d84`, 06-09), e o S5 que relê a Solicitação, recusa o
  Centro de Custo sem rota e avisa com texto fixo (`c889556..42ca9b5`, 06-10).

O `apps/api` da Fase 6 manda campos da v1.1 e da v1.2 (`pedidoDeRevisao` no
ajuste; `codigoCategoriaConfirmado`, `contaConfirmada` e `anexos` com nome no
lançamento), e os schemas da rota são `.strict()`: um `automation/` anterior
à v1.2 recusaria o `/lancar` com `400`. Por isso o deploy do `automation/`
vem **antes** de ligar a ponte em `conferencia` ou `lancar` contra ele.

Na **API do CRM N1** (`apps/api`, onde ela rodar em produção) — a ponte da
Fase 6; a tabela completa está em `apps/api/README.md`:

| Variável | Produção | O que faz |
|---|---|---|
| `AGENTE_CONTAS_A_PAGAR_ATIVO` | `true` | Liga a ponte (exige `AGENTE_CONTAS_A_PAGAR_URL`, `PLATAFORMA_LANCAMENTO_TOKEN`, `AGENTE_CONTAS_A_PAGAR_ESPACO_ID=ws_n1`, `AGENTE_CONTAS_A_PAGAR_LISTA_ID=lst_contas_a_pagar`) |
| `AGENTE_CONTAS_A_PAGAR_MODO` | **`conferencia` primeiro**, `lancar` depois | `ensaio` (padrão; nada gravado) · `conferencia` (Resumos e Conferências, zero `/lancar`) · `lancar`. Outro valor cai em `ensaio`, com aviso |
| `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE` | vazio (`para-pagar`) | D6-01: `em-lancamento-omie` adia o Resumo para quando a conta entra em "em lançamento omie" |
| `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO` | vazio (`true`) | D6-02: `false` faz só o clique conferir |
| `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL` | vazio (`nao-encosta`) | D6-04: `sem-conferencia` faz a conta Manual receber o Resumo já conferido e ser lançada |
| `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM` | **vazio** | Só teste: restringe a ponte às contas com o texto no título |
| `AGENTE_CONTAS_A_PAGAR_AVISAR_ID` | **vazio** | Só teste: toda Menção da ponte vai a esse Membro. Desde o 06-13 **exige** `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM`: com a `AVISAR_ID` sozinha a API **recusa subir**. Um `AVISAR_ID` que não é Membro ativo deixa a ponte parada: ela **não escreve nada** nem chama o `automation/`, e o log avisa a cada ciclo com `AVISAR_ID_INVALIDO` |
| `AGENTE_CONTAS_A_PAGAR_INTERVALO_MS` | vazio (15 min) | O relógio entre ciclos; a gravação numa conta já cutuca a ponte em até 2 s (inclusive criar, mover, mandar à lixeira, restaurar e anexar, desde o 06-13) |
| `DATABASE_QUERY_TIMEOUT_MS` | vazio (30000) | O prazo de cada consulta. Desde o 06-13 também deriva, em toda Unidade de Trabalho, o `statement_timeout` (80 %) e o `lock_timeout` (1/3) do servidor: a trava esgotada volta como conflito, e não como `Query read timeout`. **Não use `0`** em produção: desliga os três prazos do servidor |

O ciclo da ponte (06-13) roda um de cada vez, não segura o banco durante
chamada HTTP, grava no máximo 20 vezes por ciclo e, num erro de banco, para
e se recupera sozinho (10 s, dobrando até 60 s), sem contar como falha do
Omie. No log: `Ciclo da ponte demorou.` (acima de 5 s), `Falha de banco no
ciclo do Agente de lançamento.` com o código, `ORCAMENTO_DO_CICLO_ESGOTADO`
e `PARADA_RESTAURADA` (depois de reiniciar, uma parada restaurada do fio, sem
Comentário repetido).

A linha de partida do log mostra tudo o que está valendo (`modo=…
resumoAPartirDe=… conferenciaPorComentario=… integracaoManual=… escopo=todas
avisar=financeiro`). Em produção, `escopo=todas avisar=financeiro`.

Na VPS:

```bash
cd /root/financeiro-tria && git checkout -- automation/package.json automation/package-lock.json
git pull --ff-only
cd automation && npm ci
pm2 restart financeiro-tria-automation && pm2 logs financeiro-tria-automation --lines 40
```

Esperado nos logs: `escutando em http://127.0.0.1:4100`, as linhas
`[seguranca]` e, depois de um comentário de teste no ClickUp, `[webhook] …`
sem "recusado".

**Não** ligar `PAYMENT_REQUEST_SOURCE=plataforma` ainda: a entrada de
Solicitações pela plataforma precisa do Formulário no `ws_n1`, do outbox
ligado e das variáveis `PLATAFORMA_BASE_URL`, `PLATAFORMA_SERVICE_TOKEN`,
`PLATAFORMA_WEBHOOK_TOKEN` e `PLATAFORMA_MEMBRO_POR_CLICKUP_ID` (próxima rodada).

---

## Decisões pendentes

1. **FINQ:** não tem Conta de Pagamento mapeada (`CONTA_PAGAMENTO_POR_CENTRO_CUSTO`).
   Antes o lançamento caía na primeira conta corrente da lista; agora é
   recusado. Qual conta usar? E sem `OMIE_FINQ_APP_*` ela lança no Omie da
   Tria (não mudou; o boot avisa): é de propósito?
2. **Marcos Paulo:** criado no `ws_n1` (`mem_marcos_paulo`), **sem login e
   sem convite**, com o e-mail provisório `marcos.paulo@triacompany.com.br`.
   Troque o e-mail em Configurações → Membros → Marcos Paulo → **Alterar
   e-mail** (só enquanto ele não tiver login). O "pago" não depende mais dele:
   desde 2026-09-29 **qualquer pessoa move para "pago"** (Configurações da
   Lista → Status → Ações → **Quem pode mover para cá**; para restringir de
   novo, "Só estas pessoas").
3. **Walter:** não criado (decisão). No `ws_n1` ele só aparecia na regra do
   "pago", que foi aberta; criar só se ele for usar a plataforma.
4. **Contas do ClickUp lançadas desde 20/05:** o legado apagava o RESUMO antes
   de lançar (corrigido em `c272dad`), então o `IncluirContaPagar` ia sem
   categoria. Vale conferir essas contas no Omie.
5. **Agenda do `ws_n1`:** as linhas de 25 a 28/09 das Automações de Contas a
   receber estão em `falhou` (faltava o Agente do pipeline, que agora existe).
   Reprocessar dispara as Automações de verdade nas contas importadas —
   decidir se quer isso ou deixar como está (SQL da agenda, Etapa 2.3).
6. **Painel Vercel:** pausar (recomendado) e depois aplicar a migração que
   tira a leitura anônima.
7. **Push e merge:** `financeiro-tria/main` para o GitHub; `integra-frontend-main`
   na sua branch do CRM N1.
8. **Próxima rodada (6.5 e itens de produto):** Formulário público no `ws_n1`,
   outbox ligado, aceitar convite, retomada do pipeline sem reexecutar tudo,
   upload real no Conhecimento, credencial em `conectarIntegracao`. (O Resumo
   depois da aprovação na plataforma, S5, foi feito na Fase 6.)
9. **Conferência do Resumo (Fase 6) — as quatro perguntas de
   `10-levantamento-fluxo-atual-x-documentacao-x-backend.md`.** O código
   segue um padrão em cada uma; se quiser o outro lado, é só a variável (Passo
   4), sem código:
   - **D6-01**, quando o Resumo aparece: assim que a conta está completa
     (padrão, como no ClickUp) ou só em "em lançamento omie".
   - **D6-02**, "ok" no fio vale como conferência: sim (padrão) ou só o clique.
   - **D6-03**, falha no lançamento: volta para "para pagar" (padrão, como
     hoje no legado) ou fica em "em lançamento omie". Esta é a única que
     pede uma linha de código, não uma variável.
   - **D6-04**, "Integração manual = Manual": o Agente não encosta (padrão,
     o seguro) ou Resumo sem conferência e lançamento (como o backend faz).
   - E ainda: como a Tarefa passa hoje da Lista de Solicitação para a de
     Contas a Pagar no ClickUp.
10. **Ir a produção com a ponte:** primeiro em `conferencia`, depois em
    `lancar` (passo 2B, "Em produção"). Antes disso: o deploy do
    `automation/` com o contrato v1.2 e o S5 assíncrono, e
    `CONTAS_A_PAGAR_ANEXOS_HOSTS` no `.env` dele (Passo 4).
11. **Dois anexos no mesmo título, no Omie real (06-20, com a sua
    autorização):** o `automation/` sobe cada anexo com o `cCodIntAnexo`
    igual ao id do título, como o legado sempre mandou (NF e boleto no mesmo
    título desde o n8n), e os nomes já saem desambiguados (`nome.pdf`,
    `nome-2.pdf`). Falta ver no Omie de produção que o segundo anexo não
    substitui nem é recusado pelo primeiro. O `teste:omie-real --lancar`
    aceita hoje um só `--anexo`; com dois, é um ajuste no script — senão,
    fica registrado o que o legado já faz. Nada a decidir agora: só a
    autorização para rodar no 06-20.

Resolvidas nesta rodada (2026-09-28/29, sem push): o legado do ClickUp
passa a cadastrar fornecedor novo (`0014772`); o Family Office sem
credencial própria recusa em vez de lançar no Omie da Tria (`a157f0a`,
`cf29662`); as credenciais deixam de ser gravadas nas linhas de solicitação
(`0ec964b`; o que já está gravado sai pelo SQL 4b, `bb1df69`).
