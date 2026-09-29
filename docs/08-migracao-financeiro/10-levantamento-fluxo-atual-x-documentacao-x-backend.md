# Levantamento — o fluxo atual, etapa por etapa: documentação × backend do Financeiro × plataforma

Data: 2026-09-29. Pedido do dono: "faça o levantamento novamente do fluxo
que está acontecendo e bata com o projeto da documentação e com o backend;
me diga o que está congruente e o que não está, e explique cada etapa".

Fontes, com a linha de cada evidência:
- **DOC** — `Documentação - Projeto Financeiro Pagamentos.v2.docx`, §2.1
  (jornada) e §3 (módulo TRIA, Fluxos 1–7).
- **BACKEND** — `financeiro-tria/automation/src/` em `c272dad`
  (`PAS` = `tenants/tria/payment-automation-service.ts`, `ROUTES` =
  `http/routes.ts`, `WHP` = `http/webhooks-plataforma.ts`, `OMIE` =
  `adapters/omie.ts`, `RULES` = `tenants/tria/payment-rules.ts`).
- **PLATAFORMA** — `crm-n1-integracao` em `9feeca9` (`PONTE` =
  `apps/api/src/automacoes/invocar-agente.ts`, `FIN` =
  `packages/dominio/src/operations/financeiro.ts`).

"Bate" = os três concordam. "Difere" = doc e código discordam no detalhe
(o código vence, como o inventário já decidiu). "Falta" = a plataforma não
tem a etapa.

## Primeiro, as duas correções do dono

1. **Os anexos vão para o Omie no fluxo atual.** Sim: `PAS:1933-1937` monta
   a lista (campo "Anexos" do RESUMO, ou as URLs de anexo e de nota do
   comentário cru) e `PAS:2069-2083` sobe **um a um** por
   `omie.uploadAttachmentFromUrl` (`OMIE:1006-1047`: baixa, zipa com o nome
   original, MD5 do base64, `IncluirAnexo` em `conta-pagar` com o id do
   título). Uma falha de arquivo fica no relato e não derruba o lançamento.
2. **Depois de lançar, ele só muda o status.** Sim: `PAS:2085-2097` move a
   Tarefa para "lançado omie" (`CLICKUP_STATUS_LANCADO_OMIE`), atribui
   "Contas a Pagar" e notifica. **Não há comentário de sucesso**: o id do
   título vai só para log e `outputPayload` (`PAS:2099-2118`). A DOC diz
   "Tarefa atualizada **ou** comentada" — o código escolheu "atualizada".

O que eu tinha escrito ("os anexos não vão para o Omie") era sobre a
**plataforma**: a ponte monta o corpo do `/lancar` em `PONTE:373-390` com
`valorCentavos`, `vencimento`, `formaDePagamento`, o dado de pagamento e
`fornecedor` — **sem `anexos`** —, embora a rota aceite `anexos` e os suba
igual ao legado (`http/contas-a-pagar-routes.ts:123`,
`tenants/tria/contas-a-pagar-lancamento.ts:340-353`). A frase estava certa
para a plataforma e errada como descrição do fluxo atual; este documento
separa os dois.

## As etapas

### 0. Onde o pedido nasce

| | |
|---|---|
| DOC | §2.1 (1): "usuário cria tarefa de pagamento em formulário do ClickUp". |
| BACKEND | Webhook `task-created` da Lista de Solicitação (`ROUTES:216-224`) → `startPaymentRequest`; ignora Tarefas já em status terminal (`PAS:659-662`). |
| PLATAFORMA | Formulário público (`/f/<segredo>`) ou criação direta na Lista "Solicitações de pagamento" → evento `solicitacao.criada.v1` no outbox → `POST /webhooks/plataforma/solicitacao-criada` (`WHP:735-743`) → o mesmo `syncAndAssignResponsible`. |
| Veredito | **Bate.** |

### 1. Fluxo 1 — Validação (prazo, documento, anexo)

| | |
|---|---|
| DOC | Prazo: criação com **3 dias úteis** antes dos dias 5/15/25; CNPJ/CPF em API pública; Gemini extrai o total do anexo e audita contra o Valor; reprovado → observações em comentário. |
| BACKEND | Prazo com **2 dias úteis** (`PAYMENT_MIN_BUSINESS_DAYS`, `RULES:199-221`); fora do prazo **não bloqueia**, só comenta a realocação (`PAS:1294-1339`). CPF aceito sem consulta, CNPJ em `publica.cnpj.ws`; Gemini `extractInvoiceTotals` + `auditCrossCheck`; recusa = comentário + status "não aprovado" (`rejectTask`, `PAS:2172-2223`). |
| PLATAFORMA | O mesmo código roda para a coorte plataforma (mapper tipado, anexos por URL assinada); os comentários saem sem Menção ao criador (`criadorId` vazio, `PAS:615-631`). |
| Veredito | **Bate na regra; difere no número** (3 × 2 dias úteis — a DOC está desatualizada) e no efeito do prazo (a DOC sugere encerrar o fluxo; o código só desloca a previsão). |

### 2. Fluxo 2 — Aprovador ("estrategista")

| | |
|---|---|
| DOC | Centro de Custo → aprovador; comentário mencionando ("@Petriv, para aprovação"); ids gravados no Supabase. |
| BACKEND | Centro de Custo **e Valor** (corte R$ 5.000; `RULES:55-98`): finq → Elifas; presidência ≥ 5k Elifas / < 5k Fabíola; auton health e tria tech → Thiago; tria ≥ 5k Thiago / < 5k Fabíola; igor alves e roberth → Iallas; outros → Financeiro. Texto literal `"<Nome>, para aprovação"` (`PAS:1688`); no ClickUp a "menção" é `assignee` do comentário + `notify_all`. Grava `id_responsavel`, `ComentarioID` = `comentario_aprovacao`. |
| PLATAFORMA | Mesmo comentário pelo adapter; a Menção só existe se `PLATAFORMA_MEMBRO_POR_CLICKUP_ID` traduzir o id (`PAS:1689-1707`). A decisão vira entidade de Aprovação com botão (D-07), além do tópico. |
| Veredito | **Bate.** A DOC omite o corte por valor. |

### 3. Fluxo 3 — Análise da resposta do aprovador

| | |
|---|---|
| DOC | IA classifica a resposta em approved/failed; aprovado → status "aprovado" e Fluxo 4; reprovado → "não aprovado" + aviso ao solicitante. |
| BACKEND | Só conta resposta **do aprovador designado, dentro do tópico** (`PAS:1759-1772`). Heurística + OpenAI (`adapters/ai.ts:305-343, 750-767`): approved / failed / irrelevant (pergunta, "aguardando"). Aprovado → `Aprovado=true`, status "aprovado" + assignee Contas a Pagar (`PAS:1795-1802`) e **segue direto** para os Fluxos 4 e 5 (`PAS:1836-1849`). Reprovado → "não aprovado" + "Sua solicitação foi reprovada, verifique o comentário do Especialista." (`PAS:1810-1818`). |
| PLATAFORMA | Clique (oficial) ou comentário classificado (fallback de 90 dias) → evento `aprovacao-decidida` → `handlePlatformApprovalDecision` (`PAS:1189-1217`): grava `Aprovado` e muda o Status **e para aí** — não roda os Fluxos 4 e 5, não avisa o solicitante. |
| Veredito | **Bate na decisão. Não bate no que vem depois** (a plataforma corta o encadeamento 3 → 4 → 5; é o S5/S6 da spec). |

### 4. Fluxo 4 — Conta bancária

| | |
|---|---|
| DOC | Switch por centro de custo → conta bancária; nenhuma escrita na Tarefa. |
| BACKEND | `resolveAccountConfig` (TRIA ou FINQ, `RULES:303-337`) e `CONTA_PAGAMENTO_POR_CENTRO_CUSTO` (igor alves → TRIA TF; roberth → TRIA Roberth; auton → Auton Health; demais → TRIA). Grava `centro_custo` e `banco_de_categorias`; não escreve no ClickUp (`PAS:1487-1519`). |
| PLATAFORMA (Contas a pagar) | `/resolver` devolve `contaPorTag` a partir da Tag `conta *` e do centro, buscando a descrição real em `ListarContasCorrentes` (`contas-a-pagar-resolucao.ts:349-366`). |
| Veredito | **Bate.** |

### 5. Fluxo 5 — Fornecedor, categoria e o RESUMO

| | |
|---|---|
| DOC | Consulta/cadastra o fornecedor no Omie; Assistente OpenAI com base vetorial acha o código da categoria e monta o resumo; **resumo publicado como comentário "para conferência final da equipe financeira"**; ThreadID e id do comentário gravados. |
| BACKEND | `ensureSupplier` (`ListarClientesResumido` → `IncluirCliente`); embedding + `match_conciliador_contas` + validação contra `ListarCategorias`, corte 0,3, senão "REVISAR" (`PAS:1549-1601`); `formatPaymentSummary` (OpenAI) → `renderResumoComment` → **comentário RAIZ, mencionando "Contas a Pagar"** (`PAS:1644-1654`); grava `ThreadID`, `ComentarioID` = RESUMO, `comentario` = resumo cru (`PAS:1656-1661`); run "aguardando liberação humana" (`PAS:1851-1863`, não persistido). |
| PLATAFORMA | **Contas a pagar:** o RESUMO só nasce **depois** de o Omie confirmar (`PONTE:683-694`), publicado e **já resolvido pelo próprio Agente** (`FIN:491-499`), com a conta indo para "lançado omie" na mesma transação. **Solicitação:** nenhum RESUMO (etapa 3). |
| Veredito | **Não bate.** É o ponto central: no fluxo atual o RESUMO é publicado ANTES, aberto ao Financeiro, para conferência; na plataforma ele é publicado DEPOIS, fechado. |

### 6. Fluxo 6 — Revisão do RESUMO

| | |
|---|---|
| DOC | Comentário em resposta ao resumo → mesma conversa da IA → novo resumo publicado; ids atualizados. |
| BACKEND | Webhook `contas-pagar-comment` (`ROUTES:226-242`): comentário raiz é ignorado; só resposta (`parentId`) ao RESUMO **atual**, de um revisor de `CLICKUP_REVIEWER_IDS` (`RULES:263-265`; Maryane e Liliane). Refaz o RAG com `título + categoria + texto do pedido`, valida no plano de contas, `reviseSummary` na OpenAI, **publica um RESUMO novo (raiz)** e troca `ComentarioID` (`PAS:775-949`). Riscos vistos: o código forçado só entra no texto exibido, não no `raw` que o lançamento lê (`PAS:866-869` × `PAS:903-907`); a 2ª revisão parte do resumo original (`ThreadID` nunca atualizado). |
| PLATAFORMA | Nada. |
| Veredito | **Falta.** |

### Entre 6 e 7 — a liberação e a passagem para Contas a Pagar

| | |
|---|---|
| DOC | §2.1 (9): "Status alterado para 'em lançamento'". |
| BACKEND | A "liberação" é o próprio Financeiro mover a Tarefa para "em lançamento omie" (status da Lista **Contas a Pagar**, `PAS:1064-1067`); alternativa pelo painel: `POST /automation/runs/:id/approve` chama `launchOmie` direto (`PAS:1103-1127`). **A passagem da Solicitação para Contas a Pagar não é feita pelo backend** (spec L-01; confirmado: nenhum método cria ou move Tarefa entre Listas). Hipótese a confirmar com o dono: a mesma Tarefa é movida de Lista no ClickUp, levando os comentários (o RESUMO junto). |
| PLATAFORMA | Botão "Converter em Conta a pagar" no card da Solicitação aprovada (`converterSolicitacaoEmContaAPagar`): nasce uma Conta em "para pagar", com Campos copiados, Vínculo e proveniência — **sem o RESUMO** (comentários não são copiados). O Financeiro move para "em lançamento omie". |
| Veredito | **Bate na intenção** (o humano libera movendo o status); **difere na passagem** (manual no ClickUp; botão na plataforma). |

### 7. Fluxo 7 — Lançamento no Omie

| | |
|---|---|
| DOC | Status 'em lançamento' → dados da Tarefa + Supabase formatados → `IncluirContaPagar` → **loop de anexos** (baixa, codifica, envia) → "Tarefa atualizada ou comentada". |
| BACKEND | Webhook `status-changed` = "em lancamento omie" (`ROUTES:285-297`) → `launchFromStatusChange` (`PAS:1008-1101`): re-sincroniza com a Tarefa viva **preservando o RESUMO** (`PAS:1026-1033`), exige `Aprovado === true` (`PAS:1042-1044`), `launchOmie` (`PAS:1876-2121`): lê o RESUMO por regex, atualiza vencimento e Tag `conta *`, conta corrente (sem achar, usa a primeira da lista — `PAS:1922-1926`), departamento, **anexos** (`1933-1937`), nº da NF por Gemini (`1943-1953`), fornecedor, `IncluirContaPagar` idempotente por consulta, **upload dos anexos zipados um a um** (`2069-2083`), **status "lançado omie" + assignee** (`2085-2097`), sem comentário de sucesso. Falha → status volta a "para pagar" + comentário "⚠️ Falha ao lançar no Omie…" (`PAS:1057-1083`). |
| PLATAFORMA | Ponte, a cada ciclo: conta em "em lançamento omie" que **entrou por movimento** (`PONTE:236-243`) e não é Manual → `erpMissingFields` → `/resolver` → veredito da categoria → `/lancar` (corpo `PONTE:373-390`, **sem anexos**) → RESUMO + "lançado omie" numa transação (`PONTE:683-694`). Falha permanente → comentário do Agente; a conta **fica** em "em lançamento omie" (`PONTE:559-563`). Modo `ensaio` (padrão): só `/resolver` e log. |
| Veredito | **Bate em "lança, depois muda o status". Não bate em:** anexos (backend sim, plataforma não); ordem do RESUMO (antes × depois); falha (backend volta a "para pagar", plataforma fica). |

### 8. Depois do lançamento

| | |
|---|---|
| DOC | Não cobre. |
| BACKEND | Termina no "lançado omie". |
| PLATAFORMA | Remessa, autorização (A3), negado (A4), pago (A2), recorrência (A1), lote de 61, Observadores (A9), cobrança de nota (A5/A6) — processo de `contas-a-pagar.md`. |
| Veredito | **Só a plataforma tem** (por desenho). |

### 9. Fluxo Manual ("Integração manual = Manual")

| | |
|---|---|
| DOC | Não descreve. |
| BACKEND | Webhook `task-updated` com a opção Manual (`ROUTES:255-283`) → `processManualPayment` (`PAS:689-771`): **pula prazo, documento e aprovação**, grava `Aprovado=true`, roda conta/fornecedor/categoria e **publica o RESUMO**; o lançamento continua dependendo de "em lançamento omie". Ou seja: Manual = "sem aprovação, mas o robô ainda lança". |
| PLATAFORMA | Manual = "o Agente não encosta": sem RESUMO, sem `/lancar` (`PONTE:570-576`); o Financeiro lança à mão e registra pelo diálogo "Lançado no Omie" (`FIN:526-567`). |
| Veredito | **Não bate — são dois significados para o mesmo Campo.** Decisão do dono. |

## O que está congruente

Nascimento do pedido; validação de prazo/documento/anexo (regra); roteamento
do aprovador; a decisão do aprovador; conta bancária; fornecedor e
categoria pelo RAG validado no plano real; "lança e depois muda o status";
idempotência no Omie por consulta antes de incluir.

## O que não está

1. **RESUMO antes, aberto ao Financeiro** (Fluxo 5) — plataforma publica
   depois, fechado. Central.
2. **Revisão pelo tópico** (Fluxo 6) — plataforma não tem.
3. **Anexos no lançamento** — backend envia; a ponte da plataforma não
   manda.
4. **Encadeamento 3 → 4 → 5 na Solicitação da plataforma** — a aprovação
   por clique para no Status (S5/S6 da spec).
5. **Comportamento na falha** — backend volta a "para pagar"; plataforma
   fica em "em lançamento omie" com o comentário.
6. **"Integração manual"** — significados opostos.
7. **Doc × código**: prazo 3 × 2 dias úteis; "@Fulano" × assignee do
   comentário; "atualizada ou comentada" × só status; corte por valor
   (R$ 5.000) ausente da DOC.

## O que fica para o dono confirmar

- Como a Tarefa passa hoje da Lista de Solicitação para a de Contas a
  Pagar no ClickUp (movida de Lista, com os comentários?).
- Qual significado de "Integração manual" vale na plataforma.
- Se, na falha do lançamento, a conta deve voltar para "para pagar" (como
  hoje) ou ficar em "em lançamento omie" (como o plano pós-auditoria
  decidiu).
