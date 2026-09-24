# O corte de Marcos Paulo e Family Office

**Escrito antes de desligar qualquer coisa.** Este documento é o inventário completo
do corte (TEN-01): as Listas envolvidas, as variáveis de ambiente, os webhooks do
ClickUp a desligar, a ordem, a coorte, o rollback e as perguntas que só o painel do
ClickUp responde. Nada aqui foi executado — a Task 1 deste plano só lê os dois
repositórios e escreve. As Tasks 2 e 3 (portões humanos bloqueantes) executam o corte
de verdade, fora deste documento.

Todas as citações de código são de `git -C ../financeiro-tria show HEAD:<arquivo>` —
a versão committada, não o que pode estar em edição concorrente pelo plano 05-08
(que toca `automation/src/http/notificar-canal-routes*.ts` e `routes.ts`, mas em
seções diferentes das citadas aqui).

---

## 1. As Listas

| Lista (`listId`) | Tenant(s) | Papel | Arquivo:linha |
|---|---|---|---|
| `901109642259` | Family Office | `listSolicitacaoPagamentoId` | `automation/src/tenants/family-office/config.ts:18` |
| `901111928443` | Family Office | `listContasPagarId` | `automation/src/tenants/family-office/config.ts:20` |
| `901111928443` | Marcos Paulo | `listSolicitacaoPagamentoId` **e** `listContasPagarId` | `automation/src/tenants/marcos-paulo/config.ts:19` e `:20` |
| `901109642267` | Family Office | `listContasReceberListId` | `automation/src/tenants/family-office/config.ts:19` |

**O achado de D5-07, confirmado no código:** `901111928443` aparece nos DOIS
`config.ts` — é ao mesmo tempo a Lista de Contas a pagar do Family Office
(`family-office/config.ts:20`) e a Lista de Solicitações do Marcos Paulo
(`marcos-paulo/config.ts:19` **e** `:20`, o mesmo id nos dois campos do Marcos Paulo).
Não há como arquivar uma sem arquivar a outra — são a mesma Lista. É por isso que o
corte é UM gesto, não dois: arquivar `901111928443` aposenta os dois tenants ao mesmo
tempo.

**`901109642267` (Contas a receber do Family Office) fica fora do escopo dos
critérios desta fase.** TEN-01 e o `must_haves` do plano citam só `901109642259` e
`901111928443` como as Listas a arquivar. `901109642267` é um achado deste
inventário — existe, está configurada (`family-office/config.ts:19`), e não é tocada
por este corte. O destino dela vira pergunta aberta (seção 6).

**Confirmado por `apps/api/exportacoes/MANIFESTO.md`:** a exportação da Fase 0 cobriu
exatamente três Listas — `901107637383`, `901107648977` e `901109104938`. Nenhuma das
quatro linhas da tabela acima (`901109642259`, `901111928443`, `901109642267`)
aparece no manifesto. As duas Listas do corte, e a terceira que fica de fora dele,
nunca foram exportadas. Isso é um fato do inventário, não uma pendência a resolver
aqui — se a decisão depois for migrar histórico de alguma delas, é trabalho de
importação novo, fora deste plano.

---

## 2. As variáveis de ambiente

Saída de `grep -rn "MP_CLICKUP_\|FO_CLICKUP_" ../financeiro-tria/automation/src`,
consolidada por nome de variável (a mesma variável aparece mais de uma vez quando é
lida em mais de um lugar — `MP_CLICKUP_STATUS_PARA_PAGAR` e
`FO_CLICKUP_STATUS_PARA_PAGAR` cada uma tem duas ocorrências no código, contadas como
uma linha aqui). A contagem final — **24** — bate com
`grep -rno "MP_CLICKUP_[A-Z_]*\|FO_CLICKUP_[A-Z_]*" ../financeiro-tria/automation/src | sort -u -t: -k3 | wc -l`.

Nenhuma foi alterada. Nenhuma tem uso fora do que está citado.

### Marcos Paulo (11 variáveis)

| Variável | Default | Arquivo:linha |
|---|---|---|
| `MP_CLICKUP_TEAM_ID` | `9011658148` | `marcos-paulo/config.ts:17` |
| `MP_CLICKUP_LIST_SOLICITACAO_ID` | `901111928443` | `marcos-paulo/config.ts:19` |
| `MP_CLICKUP_LIST_CONTAS_PAGAR_ID` | `901111928443` | `marcos-paulo/config.ts:20` |
| `MP_CLICKUP_CONTAS_A_PAGAR_ID` | `81581816` | `marcos-paulo/config.ts:21` |
| `MP_CLICKUP_STATUS_APROVADO` | `aprovado` | `marcos-paulo/config.ts:22` |
| `MP_CLICKUP_STATUS_REPROVADO` | `não aprovado` | `marcos-paulo/config.ts:23` |
| `MP_CLICKUP_STATUS_EM_LANCAMENTO_OMIE` | `em lançamento omie` | `marcos-paulo/config.ts:24` |
| `MP_CLICKUP_STATUS_LANCADO_OMIE` | `lançado omie` | `marcos-paulo/config.ts:25` |
| `MP_CLICKUP_CF_MANUAL_OPTION_ID` | `""` (vazio) | `marcos-paulo/config.ts:29` |
| `MP_CLICKUP_REVIEWER_IDS` | `81581816,81581814` | `marcos-paulo/config.ts:30` |
| `MP_CLICKUP_STATUS_PARA_PAGAR` | `para pagar` | `marcos-paulo/payment-automation-service.ts:690` |

### Family Office (13 variáveis)

| Variável | Default | Arquivo:linha |
|---|---|---|
| `FO_CLICKUP_TEAM_ID` | `9011658148` | `family-office/config.ts:17` |
| `FO_CLICKUP_LIST_SOLICITACAO_ID` | `901109642259` | `family-office/config.ts:18` |
| `FO_CLICKUP_LIST_CONTAS_RECEBER_ID` | `901109642267` | `family-office/config.ts:19` |
| `FO_CLICKUP_LIST_CONTAS_PAGAR_ID` | `901111928443` | `family-office/config.ts:20` |
| `FO_CLICKUP_CONTAS_A_PAGAR_ID` | `81581816` | `family-office/config.ts:21` |
| `FO_CLICKUP_REVIEWER_SECONDARY_ID` | `81581802` | `family-office/config.ts:22` |
| `FO_CLICKUP_STATUS_APROVADO` | `aprovado` | `family-office/config.ts:23` |
| `FO_CLICKUP_STATUS_REPROVADO` | `reprovado` | `family-office/config.ts:24` |
| `FO_CLICKUP_STATUS_EM_LANCAMENTO_OMIE` | `em lançamento omie` | `family-office/config.ts:25` |
| `FO_CLICKUP_STATUS_LANCADO_OMIE` | `lançado omie` | `family-office/config.ts:26` |
| `FO_CLICKUP_STATUS_REVISAO` | `em revisão` | `family-office/config.ts:27` |
| `FO_CLICKUP_REVIEWER_IDS` | `81581816,81581802` | `family-office/config.ts:29` |
| `FO_CLICKUP_STATUS_PARA_PAGAR` | `para pagar` | `family-office/payment-automation-service.ts:741` (repete em `:781`) |

**Todas as 24 deixam de ter uso depois do corte.** As 20 de `config.ts` (team id,
list ids, nomes de status, reviewer ids, o CF de opção manual) só são lidas para
montar chamadas à API do ClickUp disparadas pelos handlers de webhook
(`/clickup/task-created`, `/clickup/comment-created`, `/clickup/task-updated`,
`/clickup/status-changed`, `/clickup/contas-pagar-comment` — seção 3). As 4 restantes
(`*_STATUS_PARA_PAGAR`) são lidas dentro de `launchOmie`, chamado a partir do handler
`status-changed` (a mesma cadeia de webhook) para reverter o status da Tarefa quando
o lançamento no Omie falha — sem tráfego de webhook, esse `catch` nunca executa.
Com os webhooks desligados (Task 2) e as Listas arquivadas (Task 3), nenhuma dessas
24 variáveis tem mais efeito. Nenhuma é removida por este plano — CON-05 e D5-05
mandam que o código morto do `automation/` fique onde está.

---

## 3. Os webhooks do ClickUp a desligar

Fonte: `git -C ../financeiro-tria show HEAD:automation/src/http/routes.ts`. O router
de cada tenant é montado assim (linha 392–394, citação literal):

```
392  // Cada tenant tem o seu prefixo. Cadastre os webhooks ClickUp do tenant correto na URL certa.
393  for (const [tenantId, service] of Object.entries(services)) {
394    router.use(`/webhooks/${tenantId}`, criarRouter({ tenantId, service }));
395  }
```

com `services` contendo as chaves `"tria"`, `"marcos-paulo"`, `"family-office"`
(`routes.ts:388-391`). `criarRouter` monta, por tenant, as cinco rotas definidas em
`mountTenantWebhooks` (`routes.ts:185-269`): `/clickup/task-created` (`:189`),
`/clickup/contas-pagar-comment` (`:199`), `/clickup/comment-created` (`:217`),
`/clickup/task-updated` (`:228`), `/clickup/status-changed` (`:258`). O mesmo desenho
está documentado em `docs/sistema-financeiro.md:86`: *"Multi-tenant por path HTTP:
`POST /webhooks/tria/clickup/...`, `POST /webhooks/marcos-paulo/clickup/...`,
`POST /webhooks/family-office/clickup/...`"*.

### Marcos Paulo — 5 endpoints sob `/webhooks/marcos-paulo`

| Endpoint | Handler (routes.ts) |
|---|---|
| `POST /webhooks/marcos-paulo/clickup/task-created` | `:189` |
| `POST /webhooks/marcos-paulo/clickup/contas-pagar-comment` | `:199` |
| `POST /webhooks/marcos-paulo/clickup/comment-created` | `:217` |
| `POST /webhooks/marcos-paulo/clickup/task-updated` | `:228` |
| `POST /webhooks/marcos-paulo/clickup/status-changed` | `:258` |

### Family Office — 5 endpoints sob `/webhooks/family-office`

| Endpoint | Handler (routes.ts) |
|---|---|
| `POST /webhooks/family-office/clickup/task-created` | `:189` |
| `POST /webhooks/family-office/clickup/contas-pagar-comment` | `:199` |
| `POST /webhooks/family-office/clickup/comment-created` | `:217` |
| `POST /webhooks/family-office/clickup/task-updated` | `:228` |
| `POST /webhooks/family-office/clickup/status-changed` | `:258` |

**Nenhum desses 10 endpoints é removido do código.** Depois do corte eles continuam
montados, só sem tráfego — a mesma disciplina do `/webhooks` de retro-compatibilidade
para Tria (`routes.ts:397-399`), que também não é tocado.

### Onde cada um está cadastrado no painel do ClickUp

Isto é o que `grep` no repositório NÃO responde. `MP_CLICKUP_TEAM_ID` e
`FO_CLICKUP_TEAM_ID` têm o MESMO default (`9011658148`) — os webhooks de Marcos
Paulo e Family Office estão registrados no mesmo Team do ClickUp, diferenciados por
`endpoint` (a URL completa, incluindo o path `/webhooks/marcos-paulo/...` ou
`/webhooks/family-office/...`) e por `list_id` dentro do payload de cada evento, não
por Team separado.

O repositório tem uma ferramenta que lista os webhooks cadastrados por Team direto na
API do ClickUp — `automation/scripts/clickup-webhooks.ps1` (modo `list`, usa
`CLICKUP_API_TOKEN`/`CLICKUP_TEAM_ID` do `.env`, não imprime o token). Este plano não
a executa (a regra deste corte é não chamar a API do ClickUp), mas é o roteiro
literal para a Task 2: rodar `./clickup-webhooks.ps1 list` mostra `id`, `endpoint`,
`events` e `list_id` de cada webhook do Team — de onde dá para identificar,
olhando o `endpoint`, quais 10 (dos endpoints acima) desligar. O host de produção que
completa a URL (o que vem antes de `/webhooks/marcos-paulo/...` num webhook cadastrado
hoje em produção, e não em `ngrok`) não está em nenhum arquivo lido para este
inventário — é o que o próprio `list` mostra, ou o painel. Fica registrado como
pergunta aberta (seção 6) o que só o painel confirma: se cada um dos 10 endpoints
está de fato cadastrado individualmente (um webhook por evento) ou agrupado (um
webhook por tenant assinando os 5 eventos).

---

## 4. A coorte e a ordem

A ordem é rígida, em três passos, e nenhum é pulado:

**(a) Desligar o webhook do ClickUp dos dois tenants primeiro.** Os 10 endpoints da
seção 3 — todos os que atendem `/webhooks/marcos-paulo/*` e `/webhooks/family-office/*`
— saem do painel do ClickUp antes de qualquer arquivamento. Enquanto o webhook está
ativo e a Lista existe, ele é uma segunda entrada válida para a mesma obrigação (a
plataforma, via `TENANT_POR_EMPRESA` do plano 05-04, é a primeira).

**(b) Confirmar silêncio por um período declarado.** Depois de (a), nenhuma Tarefa
nova deve aparecer em `901109642259` nem em `901111928443` por **48 horas corridas**
— duas contagens (Tarefas na Lista antes de desligar × Tarefas na Lista 48h depois),
registradas no SUMMARY da Task 2. 48h cobre um ciclo de trabalho completo de MP e FO
(inclui o relatório diário de segunda a sexta às 10h — `MP_RELATORIO_CRON`,
`marcos-paulo/config.ts:71` — que roda sobre `financas_mp`, não sobre a Lista, mas é
o ritmo operacional do tenant) sem prolongar o corte além do necessário. Se qualquer
Tarefa nova aparecer nesse período, o corte para: o webhook não foi desligado por
completo, ou existe uma segunda integração escrevendo na Lista (seção 6).

**(c) Só então arquivar.** Task 3, depois de (b) confirmado.

A coorte é por ORIGEM, não por data: toda Tarefa que já existia em `901109642259` ou
`901111928443` antes do passo (a) pertence à coorte ClickUp e termina no ClickUp —
sua obrigação (lançamento no Omie, aprovação, o que for) é resolvida ali, mesmo que
isso aconteça depois do desligamento do webhook (o webhook só impede Tarefas NOVAS;
não apaga as existentes). Toda Solicitação criada na plataforma a partir do momento
em que `TENANT_POR_EMPRESA` está em produção (plano 05-04) pertence à coorte
plataforma e nasce, vive e termina lá. Nenhuma obrigação atravessa os dois caminhos —
uma Tarefa do ClickUp nunca é relançada como Solicitação na plataforma, e uma
Solicitação da plataforma nunca é replicada como Tarefa no ClickUp. É essa separação
que impede o double-write no Omie (T-5-15): cada obrigação tem exatamente uma origem,
e a origem decide o caminho do início ao fim.

---

## 5. O rollback

- **Se o silêncio do passo (b) falhar** (Tarefa nova aparece numa das duas Listas
  durante as 48h): reabrir a entrada do webhook no ClickUp vale **só para pedidos
  NOVOS** a partir dali — não para os que já chegaram à plataforma durante a janela.
  O que já nasceu na plataforma não volta ao ClickUp.
- **Se o corte precisar ser desfeito depois de (a) mas antes de (c):** reativar os 10
  webhooks da seção 3 no painel. Nenhuma Lista foi tocada ainda; o estado volta ao de
  antes do passo (a) sem perda.
- **Se precisar desfazer depois de (c):** desarquivar `901109642259` e/ou
  `901111928443` no ClickUp é uma ação suportada pelo próprio ClickUp e é o primeiro
  passo do rollback — mas ele não desfaz nada que já tenha sido lançado no Omie pelo
  caminho novo, nem revive Tarefas da coorte antiga que já foram concluídas.

**O ponto sem volta é o arquivamento de `901111928443` (Task 3, passo 3).** Ele vem
por último, depois de (a) e (b) comprovados, e depois da verificação de gêmeas da
Task 3 (nenhuma Tarefa aberta nas duas Listas tem correspondente lançada pelo caminho
novo). Arquivar `901109642259` também é irreversível na prática (mesma classe de
ação), mas `901111928443` é citada aqui porque é a Lista que a Task 3 arquiva por
último, depois de confirmar Marcos Paulo e Family Office juntos — D5-07.

---

## 6. Perguntas abertas

Nenhuma destas é respondida por `grep`. Todas exigem o painel do ClickUp ou uma
decisão de produto.

1. **O destino de `901109642267`** (Contas a receber do Family Office). Fica fora do
   escopo de TEN-01 (seção 1). Arquivar junto, deixar aberta indefinidamente, ou
   tratar como insumo do ramo REC-01 desta mesma fase (D5-02/D5-02b) — decisão de
   produto, não deste plano.

2. **Alguma integração fora do `automation/` (Zapier, Make, app nativo do ClickUp,
   Automação interna do próprio ClickUp) também escreve nas duas Listas do corte?**
   `grep` no repositório só vê o que o `automation/` faz; não vê o que está
   configurado dentro do Workspace do ClickUp. Se existir, desligar só os 10
   endpoints da seção 3 não é suficiente — o passo (b) (silêncio de 48h) é o que
   pegaria isso na prática, mas a origem de uma eventual Tarefa nova durante a
   janela só o painel identifica.

3. **Cada um dos 10 endpoints da seção 3 está cadastrado individualmente no painel,
   ou agrupado por tenant (um webhook assinando os 5 eventos de uma vez)?**
   `automation/scripts/clickup-webhooks.ps1 list` responde isso — não foi executado
   para este inventário (a regra deste plano é não chamar a API do ClickUp).

4. **Qual é o host de produção** que completa a URL registrada hoje no ClickUp para
   Marcos Paulo e Family Office (o que substitui o `ngrok` de desenvolvimento
   mencionado em `clickup-webhooks.ps1`)? Nenhum arquivo lido para este inventário
   declara o host de produção do `automation/` — só o painel do ClickUp (via o
   `endpoint` de cada webhook listado) ou o ambiente de produção confirmam.

5. **`901109642259` e `901111928443` têm Tarefas abertas hoje**, e se sim, quantas e
   com que dono? Esta pergunta pertence formalmente à Task 3 (verificação de gêmeas e
   de trabalho aberto), mas fica registrada aqui porque nenhum dado deste inventário
   (todo ele de código) responde por contagem — só uma consulta ao painel do ClickUp,
   feita na hora da Task 3.
