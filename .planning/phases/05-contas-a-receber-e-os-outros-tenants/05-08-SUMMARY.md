---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 08
subsystem: automation
tags: [webhooks, whatsapp, evolution-api, outbox, idempotencia]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 07)
    provides: "EVENTOS['automacao.notificar-canal.v1'] no outbox de apps/api, entregue em POST /webhooks/plataforma/notificar-canal com Idempotency-Key = id da linha"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 04)
    provides: "confirmação de que o corte de MP/FO é responsabilidade de 05-05; este plano só implementa a rota, não a publica em produção"
provides:
  - "POST /webhooks/plataforma/notificar-canal (../financeiro-tria/automation) — última perna de AUTO-02: entrega WhatsApp via EvolutionAdapter, autenticada, idempotente, com dois modos de destino"
  - "montarRotasDeNotificacaoPorCanal / notificarCanalRouter — exports de ../financeiro-tria/automation/src/http/notificar-canal-routes.ts"
  - "códigos de erro DESTINO_INDISPONIVEL / ROTULO_DESCONHECIDO (422, permanentes)"
affects: ["deploy de automation/ (fora deste plano — parte do corte 05-05)", "qualquer Automação publicada que use o canal WhatsApp (nenhuma foi publicada ainda — decisão de produto)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bearer em tempo constante + receipt idempotente RECRIADOS neste módulo, não importados de webhooks-plataforma.ts (mesma decisão já travada em contas-a-pagar-routes.ts) — superfície nova não acopla ao módulo do contrato v1"
    - "Tudo ou nada no modo rótulos: todos os rótulos são traduzidos ANTES de qualquer envio começar; um rótulo desconhecido no meio do lote produz zero chamadas de sendText, nunca envio parcial"
    - "Mapeamento id de Campo -> chave do DTO (CAMPO_ID_PARA_CHAVE) como ponte deliberadamente estreita: o contrato v1 expõe Campos por chave nomeada, não por id, então só o id que o automation/ já conhece (fd_cp_whatsapp -> requesterWhatsApp) é aceito; qualquer outro é DESTINO_INDISPONIVEL (422), nunca um Campo por semelhança"
    - "Classificação de erro de envio default TRANSITÓRIO (500), ao contrário de webhooks-plataforma.ts (default permanente): uma falha de rede/API da Evolution não é veredito de regra de negócio, e o outbox pode refazer o lote inteiro com segurança (T-5-27)"

key-files:
  created:
    - ../financeiro-tria/automation/src/http/notificar-canal-routes.ts
    - ../financeiro-tria/automation/src/http/notificar-canal-routes.test.ts
  modified:
    - ../financeiro-tria/automation/src/http/routes.ts

key-decisions:
  - "Tasks 1 e 2 do plano foram implementadas em um único commit de produção (auth/idempotência/schema/receipt E os dois modos de destino/as duas mensagens), em vez de dois commits sequenciais com um estado intermediário artificial: as duas partes vivem no MESMO arquivo, são estruturalmente inseparáveis sem produzir código descartável (uma resolução de destino incompleta só para ser substituída no commit seguinte), e nenhuma delas é testável isoladamente sem a outra. Task 3 (o mount em routes.ts) ficou em commit separado, como o plano pede, porque é genuinamente um arquivo e uma preocupação distintos."
  - "'relatorio' usa o MESMO molde visual de 'gasto-novo' (título em negrito + corpo), mas com fonte de dado diferente da real: a fonte de verdade do relatório diário (financas_mp/relatorio_semanal_marcos_paulo, Fluxo 6 do Marcos Paulo) não é acessível por esta rota — o contrato v1 só expõe a Tarefa via getTask (D3-02/D5-09), nunca uma tabela auxiliar de outro tenant. O corpo do relatório usa o que a Tarefa que disparou a Automação já carrega (readableId/descrição/vencimento). Isto é uma decisão de escopo, não uma tentativa de reproduzir financas_mp por outro caminho — nenhuma Automação real usa mensagemId 'relatorio' ainda (nenhuma foi publicada), então não há comportamento de produção divergindo do que o Marcos Paulo recebe hoje via n8n."
  - "O texto de 'gasto-novo' foi copiado (formato, não import) de notifyNewRequest em src/tenants/tria/payment-automation-service.ts — o único precedente em CÓDIGO (não em n8n JSON) de um aviso de 'nova solicitação' por WhatsApp no repositório, apesar do comentário do plano citar 'o formato que o serviço do Marcos Paulo já usa hoje'. Nenhuma lógica de notifyNewRequest foi importada ou alterada; só a forma do texto (título/fornecedor/valor/vencimento/centro de custo, negrito Markdown do WhatsApp) foi replicada."
  - "Classificação de erro de envio (classificarErroDeEnvio) trata erro não reconhecido como TRANSITÓRIO (500, retryable), ao contrário da convenção 'não classificado = permanente' de webhooks-plataforma.ts. Justificativa: aquela convenção existe para recusas de REGRA DE NEGÓCIO do domínio (onde um erro desconhecido pode esconder um bug perigoso de repetir); aqui o erro típico é falha de rede/API da Evolution, que É seguro reagendar — T-5-27 do threat model do plano aceita explicitamente que um retry do outbox refaça o lote inteiro."

requirements-completed: []

# Metrics
duration: ~90min
completed: 2026-09-24
---

# Phase 05 Plan 08: A rota de notificação por Canal (AUTO-02) Summary

**`POST /webhooks/plataforma/notificar-canal` no repositório `financeiro-tria` — a última perna de AUTO-02: recebe o evento pobre do outbox de `crm-n1`, resolve o destino (Campo da Tarefa ou rótulo do ambiente, nunca ambos, nunca um padrão) e entrega pelo `EvolutionAdapter` já existente, com a mesma disciplina de autenticação em tempo constante e receipt idempotente que as outras três rotas plataforma → `automation/` já têm.**

## Performance

- **Duration:** ~90min
- **Completed:** 2026-09-24
- **Tasks:** 3/3
- **Files modified:** 3, todos em `../financeiro-tria/automation/` (2 criados, 1 modificado)

## Accomplishments

- `notificar-canal-routes.ts` (novo) — cabeçalho de doutrina próprio; Bearer em tempo constante, `Idempotency-Key`, corpo `zod().strict()` e receipt idempotente RECRIADOS (não importados de `webhooks-plataforma.ts`), mesma decisão já travada em `contas-a-pagar-routes.ts`. `eventId` do corpo precisa ser exatamente a `Idempotency-Key`, mesma regra dos outros três eventos.
- Dois modos de destino, nunca um terceiro: `campo` (lê a Tarefa via `obterTarefa`/`getTask`, único id conhecido hoje é `fd_cp_whatsapp` → `requesterWhatsApp`) e `rotulos` (`mari`/`marcos`/`grupo-financeiro`, traduzidos por um mapa construído de `MARCOS_PAULO_CONFIG.whatsapp` — nenhum número literal no arquivo). Modo rótulos é tudo-ou-nada: um rótulo desconhecido no meio do lote produz zero envios.
- As duas mensagens do escopo de AUTO-02 (D5-11): `gasto-novo` (copiado em FORMA de `notifyNewRequest`, `tria/payment-automation-service.ts`) e `relatorio` (mesmo molde, fonte de dado limitada à Tarefa — ver `key-decisions`).
- `routes.ts` ganha uma linha de mount: `router.use("/webhooks/plataforma", notificarCanalRouter())`, ao lado do router do contrato v1, caminhos disjuntos, nenhum import cruzado.
- 16 testes novos: auth (401 sem/com Bearer errado, corpo nunca lido), idempotência (400 sem `Idempotency-Key`, 400 `eventId` divergente, 202 duplicado sem reenvio), schema (400 campo a mais), os dois modos de destino (rótulos válidos em ordem, rótulo desconhecido no meio → zero envios, Campo preenchido, Campo desconhecido, Campo vazio na Tarefa), conteúdo das duas mensagens, e ausência de dígitos de telefone em qualquer resposta de erro.

## Task Commits

Cada task foi commitada atomicamente no repositório irmão `../financeiro-tria` (branch `main`):

1. **Task 1 + Task 2 (combinadas — ver `key-decisions`): a rota inteira, auth/idempotência/schema/receipt e a resolução de destino/as duas mensagens** — `6abe57d` (feat)
2. **Task 3: o mount em `routes.ts`, ao lado do contrato v1** — `d3216f2` (feat)

**Plan metadata:** este arquivo, commitado em `crm-n1` (não em `financeiro-tria`)

_Nota CON-05: as SHAs acima são do repositório irmão `../financeiro-tria`, um repositório git distinto de `crm-n1`. Nenhum arquivo de código deste plano vive em `crm-n1`._

## Files Created/Modified

- `../financeiro-tria/automation/src/http/notificar-canal-routes.ts` (novo, 396 linhas) — `montarRotasDeNotificacaoPorCanal`, `notificarCanalRouter`, `ClienteDeReceipts`, `TarefaParaNotificar`.
- `../financeiro-tria/automation/src/http/notificar-canal-routes.test.ts` (novo, 16 testes).
- `../financeiro-tria/automation/src/http/routes.ts` — import de `notificarCanalRouter` + uma linha de mount + comentário de duas frases citando D5-09.

## Decisions Made

Ver `key-decisions` no frontmatter: (1) Tasks 1+2 em um commit por acoplamento estrutural real, Task 3 separada; (2) `relatorio` usa o Task DTO disponível via `getTask`, não `financas_mp` (inacessível por esta rota); (3) texto de `gasto-novo` copiado de `tria/payment-automation-service.ts` (único precedente em código); (4) erro de envio não classificado é TRANSITÓRIO por padrão (diverge de `webhooks-plataforma.ts` de propósito, justificado por T-5-27).

## Deviations from Plan

### Auto-fixed Issues

Nenhum bug encontrado durante a implementação — o design seguiu o plano e o 05-PATTERNS.md linha a linha (auth recriada, receipt na mesma tabela, dois modos de destino, tudo-ou-nada em rótulos).

### Estruturais (documentadas, não Rule 1-3)

1. **Commits de Task 1/Task 2 combinados.** Ver `key-decisions` acima — decisão de organização de commit, não uma mudança de comportamento, arquitetura ou escopo. Todos os critérios de aceite de AMBAS as tasks foram verificados contra o estado final (greps e testes abaixo).
2. **`relatorio` com fonte de dado mais estreita que o Fluxo 6 real do Marcos Paulo.** Documentada como decisão de escopo (ver `key-decisions`), não um stub: a mensagem É funcional e testada (teste (p)), só usa um subconjunto de dados menor que o `financas_mp` porque essa tabela não está no raio de alcance desta rota. Nenhuma Automação publicada usa `mensagemId: "relatorio"` ainda, então não há regressão de comportamento observável.

## Issues Encountered

Nenhum. `npx tsc --noEmit` verde na primeira tentativa (o padrão de atribuir `criarPlataformaAdapter(...).getTask` — tipo `Promise<PaymentRequestDtoV1>` — a uma variável tipada `Promise<TarefaParaNotificar>` mais estreita compilou de primeira, replicando exatamente o padrão já usado por `obterTarefaPadraoFn()` em `webhooks-plataforma.ts`).

## User Setup Required

Nenhum NESTA sessão — todas as variáveis de ambiente (`EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`, `MP_EVOLUTION_INSTANCE`, `MP_WHATSAPP_MARI`, `MP_WHATSAPP_MARCOS`, `MP_WHATSAPP_GRUPO`, `PLATAFORMA_WEBHOOK_TOKEN`) já existem no ambiente do `automation/` (ver `user_setup` do plano) — nenhuma nova. O `dashboard_config` do plano ("confirmar que a instância Evolution do Marcos Paulo está conectada antes do primeiro envio real") é uma verificação operacional para quando a rota for exercitada em produção, fora do escopo de execução deste plano (nenhum envio real ocorreu nesta sessão — todos os testes stubam `enviarWhatsApp`).

## Next Phase Readiness

- AUTO-02 tem as três pernas: domínio (05-06, `case "notificar"` com `canal: "whatsapp"`), outbox (05-07, `automacao.notificar-canal.v1`) e agora a entrega (este plano). `requirements-completed` fica vazio de propósito: a rota existe e é testada, mas (a) `automation/` com este código não está deployado (deploy é escopo de 05-05, fora deste plano) e (b) nenhuma Automação real foi publicada usando o canal — decisão de produto, não pendência de código.
- `notificarCanalRouter()` está montado em `routes.ts` e pronto para receber tráfego assim que `automation/` for deployado com este código.
- Nenhum bloqueio para 05-05 (que roda em paralelo) nem para planos seguintes: os arquivos tocados por este plano (`notificar-canal-routes.ts`, `notificar-canal-routes.test.ts`, o mount em `routes.ts`) não se sobrepõem aos que 05-05 lê/escreve.

## Verificação executada nesta sessão (regras operacionais do projeto)

- `git -C ../financeiro-tria status --short` (snapshot ANTES de tocar em qualquer arquivo) — 89 arquivos sujos pré-existentes, nenhum dos três `files_modified` deste plano entre eles; `routes.ts` limpo (confirmando que o commit `25716c1` de 05-04 está estável).
- `cd ../financeiro-tria/automation && npx tsc --noEmit` — verde (0 erros), rodado após cada arquivo escrito.
- `cd ../financeiro-tria/automation && npm run build` — exit 0.
- `cd ../financeiro-tria/automation && npx tsx --test --test-concurrency=1 src/http/notificar-canal-routes.test.ts` — **16/16 verde**, redirecionado a arquivo, sem pipe.
- `cd ../financeiro-tria/automation && npm test` (suíte inteira) — **187/188, exit 1** — a ÚNICA falha é a pré-existente documentada nas regras operacionais deste plano (`src/tenants/tria/payment-rules.test.ts:37`, `/FINQ/i` vs `'Elifas'`); nenhuma outra falha.
- `grep -c "timingSafeEqual" notificar-canal-routes.ts` = 2 (≥ 1, critério de aceite Task 1).
- `grep -c 'from "./webhooks-plataforma"' notificar-canal-routes.ts` = 0 (recriado, não importado — critério de aceite Task 1).
- `grep -c "5514998380047\|5511933441997\|120363420719492227" notificar-canal-routes.ts` = 0 (nenhum número literal — critério de aceite Task 2).
- `grep -c "notificarCanalRouter" routes.ts` = 2 (import + chamada — critério de aceite Task 3, plano pedia ≥1 na chamada, import conta como ocorrência adicional esperada).
- `grep -n "notificar-canal" webhooks-plataforma.ts` — nenhuma ocorrência (critério de aceite Task 3, nenhum acoplamento).
- `git -C ../financeiro-tria diff --name-only` (após os commits) — só os arquivos pré-existentes dos outros 89, mais nada: os três arquivos deste plano já estão commitados e não aparecem como diff pendente. `git status --short` idêntico ao snapshot inicial (diff vazio entre os dois arquivos de snapshot).
- `git -C ../financeiro-tria diff --name-only` durante a sessão (antes de commitar) confirmou que nenhum `payment-automation-service.ts` nem `adapters/evolution.ts` foi tocado.
- Nenhuma chamada real à Evolution API: todos os testes stubam `enviarWhatsApp`; `EvolutionAdapter` (`adapters/evolution.ts`) não foi modificado, só instanciado na função de wiring de produção (`notificarCanalRouter()`), que não roda em teste.
- Nenhum pacote novo instalado (T-5-SC): só `express`/`zod`/`node:crypto`/`@supabase/supabase-js`, todos já presentes em `package.json`.

## Self-Check: PASSED

Arquivos criados encontrados em disco: `../financeiro-tria/automation/src/http/notificar-canal-routes.ts`, `../financeiro-tria/automation/src/http/notificar-canal-routes.test.ts`. Ambos os commits (`6abe57d`, `d3216f2`) encontrados em `git -C ../financeiro-tria log --oneline -5`.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*

## Self-Check: PASSED (confirmado)

`.planning/phases/05-contas-a-receber-e-os-outros-tenants/05-08-SUMMARY.md` — FOUND.
`git -C ../financeiro-tria log --oneline --all | grep 6abe57d` — FOUND.
`git -C ../financeiro-tria log --oneline --all | grep d3216f2` — FOUND.
