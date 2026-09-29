# Roteiro de produção depois das correções pós-auditoria

Para: o dono, que roda cada passo que grava em produção. Ordem de cima para
baixo; cada passo diz o que esperar. Plano e estado: `07-plano-de-correcoes-pos-auditoria.md`.

**Regra de ouro:** todo CLI com `--apply` tem um dry-run antes. Rode o
dry-run, compare com o "esperado", e só então o `--apply`. Se o dry-run
mostrar algo diferente, pare e mande a saída.

Onde está o código corrigido:
- CRM N1: `/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao` (branch `integra-frontend-main`).
- Financeiro: `/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria` (branch `main`, local — 99 commits à frente do `origin/main` e 100 do que roda na VPS, sem push).

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

### 2B. Pela tela (a jornada inteira, com a ponte do CRM N1)

Dois terminais, um para cada serviço. Use **o mesmo token** nos dois (o de
teste que já usamos serve; é só local).

**Terminal A — Financeiro** (código novo; escuta só em 127.0.0.1):

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria/automation" && INVOICE_CRON_ENABLED=false INVOICE_EMIT_DRAIN_MINUTES=0 PLATAFORMA_LANCAMENTO_TOKEN=<token> npm run dev
```

Esperado: `escutando em http://127.0.0.1:4100` e as linhas `[seguranca]`
(avisos de configuração — normais no local).

**Terminal B — API do CRM N1 com a ponte em modo de lançamento real:**

```bash
cd "/Users/TRIA2026/Projetos/Projetos Cursor/crm-n1-integracao" && AGENTE_CONTAS_A_PAGAR_ATIVO=true AGENTE_CONTAS_A_PAGAR_MODO=lancar AGENTE_CONTAS_A_PAGAR_URL=http://127.0.0.1:4100 PLATAFORMA_LANCAMENTO_TOKEN=<token> AGENTE_CONTAS_A_PAGAR_ESPACO_ID=ws_n1 AGENTE_CONTAS_A_PAGAR_LISTA_ID=lst_contas_a_pagar AGENTE_CONTAS_A_PAGAR_INTERVALO_MS=20000 npm run dev -w @n1/api
```

Não precisa mais de `AUTOMACOES_WORKER_ATIVO` nem de `AUTOMACOES_ATOR_MEMBER_ID`
para este teste: a ponte tem o próprio ciclo, e depois do passo 1a quem
assina é o Agente do pipeline. Esperado: `ponte do Agente de lançamento ativa (modo=lancar)`.

**Na tela** (http://localhost:3001 → Financeiro → Contas a pagar):

1. **+ Nova conta** → "TESTE OMIE - R$ 1,00".
2. Preencha: Centro de Custo **TRIA**; Valor **1**; Vencimento **daqui a 10
   dias**; Forma **Chave Pix**; Chave pix (um e-mail de teste); Categoria
   **Contas de consumo**; Fornecedor **CNPJ**; CNPJ de um **fornecedor real
   que já existe no Omie**; Nome do fornecedor.
3. Mude o Status para **"em lançamento omie"** e não mexa mais.
4. Espere ~30 s e aperte F5.

Esperado:
- A conta em **"lançado omie"**, com o **📋 Resumo de pagamento** na Atividade.
- Terminal B: `Conta lançada no Omie e movida para "lançado omie"`.
- No Omie: a conta a pagar de R$ 1,00 com o fornecedor certo, a categoria, a
  conta corrente TRIA, o vencimento e a forma Pix (TRA/01.3).

Se não der: o Agente comenta na conta **o motivo** (ex.: "O Omie recusou o
lançamento: …"). Copie o comentário e as últimas linhas dos dois terminais.

Depois: exclua o título no Omie e descarte a conta na plataforma. Pare os dois
terminais (`Ctrl+C`).

Confirmar neste teste (o código não tem como provar sozinho): que o Omie
aceita o `codigo_lancamento_integracao` de ~30 caracteres; qual forma do
filtro de CNPJ acha o fornecedor (aparece no log do Terminal A); o texto real
da recusa quando algo está errado.

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
   outbox ligado, aceitar convite, Resumo depois da aprovação na plataforma
   (S5), retomada do pipeline sem reexecutar tudo, upload real no
   Conhecimento, credencial em `conectarIntegracao`.

Resolvidas nesta rodada (2026-09-28/29, sem push): o legado do ClickUp
passa a cadastrar fornecedor novo (`0014772`); o Family Office sem
credencial própria recusa em vez de lançar no Omie da Tria (`a157f0a`,
`cf29662`); as credenciais deixam de ser gravadas nas linhas de solicitação
(`0ec964b`; o que já está gravado sai pelo SQL 4b, `bb1df69`).
