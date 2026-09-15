# Contexto — intel sintetizada (DOCs) + questões abertas consolidadas

Gerado por `/gsd-ingest-docs` (sintetizador) em 2026-09-15. Notas por tópico, com atribuição. Os DOCs têm a menor precedência (3–4): nada aqui vincula; tudo informa. A última seção reúne **todas** as questões abertas do conjunto (inclusive as que vieram de SPEC e ADR), porque o roadmapper precisa delas num só lugar.

---

## Tópico 1 — O que é a migração (visão de entrada)

source: `docs/08-migracao-financeiro/00-LEIA-PRIMEIRO.md`

- Levantamento de 2026-09-15, lido do código dos dois repositórios: `financeiro-tria` (commit `9274067`, 89 mudanças não commitadas) e `crm-n1` (commit `027d603`).
- "A decisão que define tudo": backend do financeiro-tria intacto; CRM N1 vira o front único (DEC-11, DEC-12). "O que precisar de tabela nova nasce num **schema `plataforma`** novo, no mesmo Supabase" — **superado por DEC-08** (projeto próprio).
- Ordem de leitura da pasta: inventário → comparativo → plano.
- As cinco descobertas que sustentam o plano: (1) acoplamento com o ClickUp = 7 métodos em 132 linhas; (2) o ClickUp não é só o gatilho, é a interface (formulário, conversa, decisão do aprovador, progresso) — "exatamente o que o CRM N1 já sabe fazer com Lista, Tarefa, Status e Comentário"; (3) dois processos consecutivos: financeiro-tria automatiza a **Solicitação de pagamento** (Lista `901109104938`), a plataforma modela a **Conta a pagar** (Lista `901107637383`); encontram-se no `📋 RESUMO DE PAGAMENTO`; (4) o mapper encolhe (~400 → ~50 linhas); (5) "O CRM N1 está mais adiantado do que parece — mas em memória": 1.036 l. de seed, 469 l. de operações, 214 testes verdes, tela de 1.038 linhas; "Falta **persistência e login** — é a Fase 1".
- Custo: 11–14 semanas de uma pessoa; persistência e motor de Automações são "o custo de o CRM N1 virar produto, pagos uma vez".
- Em aberto: Solicitação sem spec (maior risco); D7; Go High Level fora deste plano (zero menções nos repositórios; corresponde ao CRM, não ao Financeiro; precisa de inventário próprio feito da conta GHL).

---

## Tópico 2 — Inventário do financeiro-tria (estado atual, lido do código)

source: `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md`

**Arquitetura em três peças.** ClickUp (webhooks) ↔ `automation/` (Express 4 + Mastra, Node 20, porta 4100, PM2 + nginx na VPS, 3 tenants, cron interno) ↔ Supabase `qewznpnmaqhqfyhncdnx` (Postgres 17 + pgvector, 26 tabelas + 7 views + 33 RPCs). Frontend Vite 5/React 18/shadcn na Vercel e Lovable (23 páginas). Integrações: Omie (6 contas), Gemini (anexos), OpenAI (RESUMO, aprovação, embeddings), Evolution API (WhatsApp), cnpj.ws, Guru/Kiwify/TMB (vendas → NF).

**Autenticação: não existe.** `AuthContext.tsx` compara com `VITE_APP_USERNAME`/`VITE_APP_PASSWORD` embutidos no bundle; policy `anon_read` nas tabelas operacionais — "qualquer um com a chave pública lê `solicitacoes_pagamentos`, `transacoes`, `financas_mp`".

**Módulos** (o código vence a documentação interna, que ainda diz que emissão de NF roda no n8n): pipeline de Solicitação em 3 tenants (tria, marcos-paulo, family-office — clones) — **depende do ClickUp inteiramente**; emissão de NF (ingestão Guru/Kiwify/TMB, verificação 7 dias cron 09h, emissão no Omie cron 10h) — não depende; emissão manual via Google Sheets e cadastro de produtos — n8n, sem código; extratos por WhatsApp e relatório diário (Marcos Paulo); sync semanal de clientes Omie; plano de contas (CRUD + import + Edge Function de embeddings); workflows (catálogo read-only de 8 + histórico). JSONs de n8n em `Arquivos_base/` são a documentação de origem das regras, não runtime.

**Pipeline de Solicitação (7 etapas, `step_key` fixo):** `sync → deadline → document → invoice_audit → register_prediction → assign_responsible → approval_comment → account_selector → supplier → category → summary → review → launch_omie`.
1. Validação (webhook `task-created`): extrai campos pelo **nome** (`clickup-payment-mapper.ts`), grava em `solicitacoes_pagamentos`. Prazo: criação ≥ 2–3 dias úteis antes do próximo vencimento padrão (**dias 5, 15, 25**) — `evaluateRequestDeadline`. Documento: CPF por dígito, CNPJ via cnpj.ws. Anexos: Gemini extrai total, nº NF, chave, código de barras e audita contra o valor declarado.
2. Aprovador: `APPROVAL_ROUTES` por (centro de custo, valor): finq→Elifas; presidência ≥R$5k→Elifas, <5k→Fabíola; auton health/tria tech→Thiago; tria ≥5k→Thiago, <5k→Fabíola; igor alves/roberth→Iallas; fallback Financeiro TRIA. Comenta `@Fulano, para aprovação`.
3. Aprovação (webhook `comment-created`): só se `parent == ComentarioID` e autor == `id_responsavel`; OpenAI classifica `approved / failed / review_requested / irrelevant`. Aprovado → status `aprovado`, `Aprovado=true`, atribui Contas a Pagar; reprovado → `não aprovado`.
4. Conta: `CONTA_PAGAMENTO_POR_CENTRO_CUSTO` (igor alves→TRIA TF, roberth→TRIA Roberth, auton→Auton Health, demais→TRIA) + `ListarContasCorrentes`.
5. Fornecedor + categoria + RESUMO: `ListarClientesResumido` por CNPJ/CPF (cria se não existe); categoria por embedding OpenAI → `match_<banco vetorial>` (k=3, threshold 0,3) → código `X.XX.XX`; OpenAI Assistants gera o RESUMO, publicado como comentário. Cache de fornecedor 5 min (rate limit "Consumo redundante" do Omie). `ThreadID` guardado para revisão.
6. Revisão (webhook `contas-pagar-comment`): só revisores em `CLICKUP_REVIEWER_IDS`; refaz RAG, mesma thread, republica.
7. Lançamento (webhook `status-changed` → "em lançamento omie"): **reparseia o RESUMO por regex** (`parseAiSummary`), atualiza vencimento e tag no ClickUp, resolve conta corrente e departamento, `IncluirContaPagar` com CNAB/PIX, `IncluirAnexo`, comenta confirmação. Idempotente por `codigo_lancamento_integracao` (`ConsultarContaPagar`). Fluxo "Manual": webhook `task-updated` quando o campo "Manual" recebe a opção `b6818033-…`.
"Sem ClickUp, o que resta deste pipeline: as regras (`payment-rules.ts` — 619 linhas, com teste), os adapters, os prompts. O serviço em si é 80% leitura/escrita de Tarefa, comentário e status — o que a plataforma faz nativamente."

**Acoplamento com o ClickUp (§4).** Team Tria `9011731314`; Listas: Solicitação `901109104938`, Contas a pagar `901107637383` ("**é a mesma Lista que `docs/07-processos/contas-a-pagar.md` leu**"); outras no `.env.example` sem código. Team MP/FO `9011658148`; Lista compartilhada MP+FO `901111928443`; Solicitação FO `901109642259`; Contas a receber FO `901109642267`. Usuário "Contas a Pagar" `81581816`; aprovadores Elifas `81591229`, Fabíola `81581798`, Thiago `81581826`, Iallas `81582295`; revisor FO `81581802`; opção "Manual" `b6818033-07d2-436a-b01f-aa66313e3300`. Webhooks: `POST /webhooks/{tria|marcos-paulo|family-office}/clickup/{task-created | comment-created | contas-pagar-comment | task-updated | status-changed}`. Campos lidos por nome (com tolerância a prefixo `A-`, `01-`): Centro de Custo · Categoria de pagamento · Valor · Data Vencimento/Vencimento · Data de Emissão · Fornecedor (CPF/CNPJ) · CNPJ · CPF · CPF/CNPJ · Nome Fornecedor/Razão Social · Nome do solicitante · Whatsapp do Solicitante · Forma de pagamento · Chave pix · Pix copia e cola/QR Code · Código de barras/Linha digitável · **Link de pagamento** · Anexo · Integração manual. FO: prefixo numérico + `02-Empresas`. O backend escreve de volta: comentário, atribuição de comentário, status (`aprovado`, `não aprovado`, `lançado omie`), tag (`conta tria`, `conta tf tria`, `conta roberth`, `finq`), data de vencimento.

**Modelo de dados (§5).** ★ `solicitacoes_pagamentos` (`id, TaskID, ThreadID, ComentarioID, Aprovado, comentario, Data_previsao, id_responsavel, comentario_aprovacao, centro_custo, app_key, app_secret, banco_de_categorias, tipo, empresa`) — fonte de verdade; **credenciais Omie por linha**; `comentario` guarda o RESUMO e é reparseado. ★ `solicitacoes_pagamentos_marcos_paulo`. `payment_requests` — desenhada e nunca usada (0 linhas). Observabilidade `automation_runs/steps/events`, `approval_tasks`, `integration_jobs`, `automation_workflows`, `automation_workflow_runs` — 9 runs para 1.110 solicitações; o painel sintetiza a partir de `solicitacoes_pagamentos`. RAG: 13 tabelas `conciliador_contas_{pagar|receber}_{tria|finq|pf|plx|exo_loteamentos|exo_participacoes|oliveira_participacoes}` + 33 `match_*` + 7 views; a unificada `conciliador_contas` (276 linhas) com filtro `metadata @> {empresa, tipo}` — "a migration de unificação **rodou**"; embedding `text-embedding-3-small`. `planos_de_contas` — **vazia** (a tela lê daqui). `omie_clientes` (50 colunas, com dados bancários e chave Pix; 9.510 linhas). `contas_pagar`/`contas_a_receber` (18 colunas `text`; 872 / 10). `transacoes` (34 colunas, com `api_key`/`app_secret` do Omie; 1.987). `produtos_cadastrados_emissao_notas` (42). Auxiliares MP: `financas_mp` (469), `gastos_financeiros` (882), `machine_marcos_paulo`, `omie_marcos`, `relatorio_semanal_marcos_paulo`. Fora do financeiro: `candidatos`, `webhook_test_log`.

**Volume (§5.7, medido 2026-09-15):** "O volume não é problema." "A observabilidade nunca pegou." "`planos_de_contas` está vazia ... O de-para de categorias que funciona é o RAG em `conciliador_contas`, não esta tabela."

**Integrações (§6).** Omie `adapters/omie.ts` (594 l.): `ListarClientesResumido, IncluirCliente, ConsultarCliente, IncluirContaPagar, ConsultarContaPagar, ListarContasCorrentes, ListarResumoContasCorrentes, ListarDepartamentos, ListarCategorias, IncluirAnexo, IncluirPedido, FaturarPedido, IncluirOS, FaturarOS, ListarProdutos, ListarPaises`; retry no erro "REDUNDANT"; 6 contas (Tria, FINQ/Konq, Marcos Paulo, EXO Loteamento, EXO Participações, Oliveira Participações). Gemini `gemini-3.5-flash` (padrão). OpenAI Assistants (um `assistant_id` por tenant). Evolution API (instância `numeropvmarcos`). ClickUp `adapters/clickup.ts` (132 l.).

**Telas (§7):** hub `/financeiro` com `EmpresaSwitcher`; Dashboard, Automações (runs + timeline; approve/review/retry/cancel), Aprovações pendentes, Problemas, Solicitações (toggle Aprovado), Contas a pagar/receber (**só solicitações aprovadas**, por `tipo`), Plano de contas (oculto), Notas fiscais e Produtos (edição direta no Supabase), Upload de extratos, Workflows/Notificações/Integrações (parcialmente ocultos). "**Não porta** para a plataforma ... O que a UI do financeiro-tria informa é **quais leituras** o Financeiro precisa (dashboard, problemas, aprovações pendentes, timeline por solicitação)."

**Operação (§8):** deploy `setup-vps.sh` + `deploy.sh` (git pull, npm ci, pm2 reload), `max_memory_restart 512M`; cron interno por minuto, "Sem fila, sem retry persistente: se o processo cair no minuto errado, o dia é pulado" (`fix-stuck-runs.ts`); `supabase db push`; tabelas antigas nunca dropadas.

**Pontos de atenção (§9):** 89 arquivos modificados sem commit (regeneração shadcn/Lovable) — decidir antes de portar; `automation/.env` com credenciais reais no diretório — confirmar `.gitignore`; credenciais Omie hardcoded em `tenants/marcos-paulo/config.ts` (histórico do git) — rotacionar; credenciais por linha — não copiar; RESUMO como fonte canônica parseado por regex — "Frágil por desenho. Na plataforma os campos são estruturados e o RESUMO é **saída**, não entrada"; três clones do serviço — não portar três vezes (diferença em `config.ts` + `payment-rules.ts`); docs internos desatualizados — usar o código; 38 `CLICKUP_*` IDs precisam de de-para; `CLICKUP_LIST_CONTAS_RECEBER_ID` tem env e nada de código.

**O que fica / muda / morre (§10):** ver DEC-11 e CAND-03. "Muda — três pontos, só": `adapters/clickup.ts`, `clickup-payment-mapper.ts` (×3), entrada do pipeline. Morre: `clickup-webhooks.ps1`, `AuthContext` e `anon_read`, as 23 telas, `payment_requests`, as 13 tabelas vetoriais e 7 views. Fica como referência: JSONs do n8n; `solicitacoes_pagamentos` como fonte de verdade com `TaskID` apontando para a plataforma.

---

## Tópico 3 — Comparativo plataforma × financeiro-tria (bate / não bate / falta)

source: `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md`

**O que a plataforma já tem de Financeiro (§1):** specs de Contas a pagar e a receber; `packages/dominio/src/operations/financeiro.ts` (469 l.: `CP`, `CR`, `CONTA_POR_TAG`, `CATEGORIA_OMIE`, `erpMissingFields`, `buildResumoDePagamento`, `runLancamentoAgent` — Omie **simulado**, `contaSemResumo`, `createReceivableSeries`, `parcelaDuplicada`); `seed-financeiro.ts` (677 l.) + `seed-contas-a-receber.ts` (359 l.) com Espaço/Pasta/Listas, Tipo "Conta", Conjuntos de Status com requisitos de saída/entrada, Definições de Campo herdadas, Tags, Membros e Papéis, Agente + Coleção de Conhecimento, Automações, Regra de Recorrência, Tarefas fictícias; testes (161 l.); tela `apps/web/src/features/estrutura/financeiro/` (`contas-view.tsx` 1.038 l. — indicadores, grupos a pagar/vencidas/aguardando/programadas/pagas, ações em lote; `conta-drawer.tsx` 350; `serie-dialog.tsx` 170); tipos `Integration` (com `exposedTools`), `Automation` (gatilhos evento/agenda; ações `invocarAgente`, `solicitarAprovacao`, `aguardar`, `notificar`), `RecurrenceRule` (`businessDays: "anterior"`), `AgentExecution`, `Grant`, `ActivityRecord`, `Link`. "Tudo isso roda **em memória**."

**Dois processos, não um (§2):** "a migração não é 'trocar o backend do financeiro-tria'. É **unir dois processos** que hoje vivem em Listas diferentes do ClickUp, sendo que a plataforma já tem um e o `automation/` já tem a lógica do outro." A plataforma não tem a Solicitação; o financeiro-tria não tem a Conta depois do lançamento.

**Status (§3.1):** `para pagar`, `em lançamento omie`, `lançado omie` batem. `aprovado`/`não aprovado`: **não bate** — "no financeiro-tria `aprovado` é o fim da Solicitação; na plataforma é um Status da Conta que ninguém usa. É o mesmo nome para duas coisas — o sinal mais claro de que são Listas diferentes" (→ D9). `em remessa bancária`, `em autorização bancária`, `pago`: só na plataforma (por desenho). `em revisão`: só Family Office — falta na plataforma; decidir se entra (OQ-CMP-02).

**Campos (§3.2):** batem um a um. Divergências: `Data Vencimento` vs nativa → CAND-02; **`Link de pagamento` (cartão)** — "O mapper trata `Cartão` como forma; a plataforma tem três formas → Acrescentar `Cartão` + `Link de pagamento` — aparece no código real" (OQ-CMP-01); `02-Empresas` (FO) → Campo `Empresa` existe, falta a ligação Empresa → Integração (CAND-01); `Whatsapp do Solicitante` → campo existe (Z), falta a Ação de notificar por Canal (REQ-x-notificar-por-canal); prefixo de ordem — bate na intenção.

**Papéis (§3.3):** Financeiro bate (`81581816` = `mem_maryane`). Aprovador/pagador da Conta (`mem_marcos_paulo`, `mem_walter` para Konq) — só na plataforma. Aprovador da Solicitação ("estrategista": Elifas, Fabíola, Thiago, Iallas por centro de custo e valor) — **falta na plataforma**: quatro Membros e uma regra de roteamento. Revisores do RESUMO — parcial. Agente de lançamento — bate no papel; a plataforma simula o Omie. Pessoa da conta — só na plataforma.

**De-para para o ERP (§3.4):** Centro de custo → Conta de pagamento: parcial (plataforma prioriza a Tag, financeiro-tria o centro; concordam nos casos observados). Categoria → código: **não bate** — `CATEGORIA_OMIE` tem códigos inventados; o `automation/` já chama `ListarCategorias` e valida contra o plano real (commit `fd8090b`). CNPJ da Empresa pagadora: `CNPJ_POR_EMPRESA` fictício → buscar de `omie_clientes` ou cadastrar na Empresa do CRM. Departamento Omie: falta na plataforma (OQ-CMP-03).

**Regras de negócio (§3.5):** batem: Centro de Custo obrigatório (RN-CP-01), dado de pagamento coerente (RN-CP-02), CPF/CNPJ (RN-CP-03 — mas a plataforma **não valida dígito nem consulta CNPJ**), uma Tag `conta *` (RN-CP-07), idempotência do lançamento (na intenção). Faltam na plataforma (são regras da Solicitação): prazo ≥ N dias úteis antes do vencimento padrão 5/15/25; aprovação por valor (R$ 5.000); auditoria de anexo (Gemini). Só na plataforma: INV-CP-01; recorrência com dia útil anterior; pagamento em lote.

**Automação, IA e integração (§3.6):** cada webhook é um Gatilho por evento — bate; gatilho por horário — bate; aprovação humana — "**Bate melhor na plataforma** — a aprovação é entidade, não texto a classificar"; chamada externa via `Integration` que expõe Ferramentas de classe `externa` — bate; multi-empresa → CAND-01; run/step/event ↔ Execução de Automação/Agente — bate; RAG de categorias ↔ Coleção de Conhecimento + Fonte + Referência — bate no conceito, "a implementação (pgvector) pode ser a mesma"; memória do Assistant (`ThreadID`) ↔ Memória do Agente — parcial.

**Contas a receber (§3.7):** financeiro-tria só tem o espelho `contas_a_receber` do Omie (10 linhas) e 6 tabelas vetoriais de receita; plataforma tem a Lista completa (dormente na origem). "se o recebimento migrou para o Omie, a Lista da plataforma vira espelho de leitura da Integração, e `contas_a_receber` do Supabase é o protótipo desse espelho."

**Só o financeiro-tria tem (§4):** Solicitação de pagamento; emissão de NF (`transacoes`, produtos, Guru/Kiwify/TMB, 7 dias, pedido e OS no Omie); plano de contas com embeddings; espelhos do Omie; extratos por WhatsApp e relatório diário; validação CPF/CNPJ e enriquecimento; leitura de anexos por IA; multi-empresa com 6 contas Omie.

**Só a plataforma tem (§5):** ciclo de vida pós-lançamento; recorrência com dia útil; permissões por papel; Registro de Atividade e Execuções auditáveis; Contas a receber como processo ligado ao Contato; aprovação como entidade; tela financeira sobre a Lista sem sistema paralelo.

**Go High Level (§6):** zero ocorrências; corresponde ao CRM (`ontologia/03-crm/`); fora deste plano.

---

## Tópico 4 — Arquitetura do frontend (histórico, Fase 3 do protótipo)

source: `docs/03-fundacao/ARQUITETURA.md` — **documento anterior ao monorepo**; os caminhos `app/src/...` hoje são `apps/web/src/` e `packages/dominio/src/`; "`/entrar` — escolha do Membro" foi substituído por autenticação real; "45 testes" hoje são 214; o store singleton virou `StoreProvider` por árvore. Os **princípios** continuam valendo e foram confirmados pelo ADR (a operação pura roda "sem alterá-la").

- Stack (PRD I.4): Next.js 16 (App Router, Turbopack), React 19, TypeScript strict endurecido (`noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`; `exactOptionalPropertyTypes` desligado), Tailwind 4, Zustand 5, Zod 4, lucide-react, Vitest. Consequências do Next 16: `params` é `Promise` (`use(params)`); `next lint` não existe (`npx eslint src`); nada é cacheado sem opt-in.
- Fronteira: "**`app/` não calcula nada.** Uma página lê de `derive.ts`, escreve por `operations/` e formata por `features/shell/format.ts`."
- Tipos por região da ontologia (`primitives, workspace, structure, crm, ai, panels`). "**`readonly` é uma declaração de invariante, não decoração.**" "quando o tipo diz `readonly` e a vontade é mutar, o tipo costuma estar certo."
- `derive.ts` — "nada derivado é armazenado": `effectiveLifecycleOfList/Task` (A4.4), `effectiveListConfig` (B25: `statusSet` e `features` substituem; `fieldDefinitions` e `taskTypes` acumulam), `isTerminalCategory`/`statusCategory` (A4.3), `isOverdue`, `isBlocked`, `effectiveProbability`/`weightedValue` (DO-NEG-05), `responseWindowOpenUntil`, `executionChainOf` (B79), `marketingConsentMissing` (RN-CON-16).
- `operations/` — "nada é escrito fora daqui": `(state, actingMemberId, ...) → OperationResult<T>` (`{ok:true, value}` | `{ok:false, error, field?}`); "**Um erro nunca é lançado através da fronteira.**" Toda mutação chama `recordActivity` (A6.2) com o nome do objeto gravado (INV-ET-12).
- `store.ts` — mutar o grafo no lugar + `revision`; "**nenhum componente guarda uma referência a um objeto do estado entre renders** — sempre se lê pelo `id`."
- `seed.ts` — volumes do PRD II.7; "**Um teste vermelho não é automaticamente um bug de código.**"
- Rotas: 52 `page.tsx`; `(shell)/` com `AppShell`; SideNav respeita A3.1/A3.4 e B38e (contêiner privado como nome inerte). Telas com fluxo real: Lista (Quadro → `changeTaskStatus`), Tarefa (Status por categoria, `terminalBlockReason`), Negócios (B58: `ganho`/`perdido` não são colunas), Negócio (B59), Conversa (RN-CXE-19), Aprovações (`decideApproval`), Membros (remover **é** suceder), Configurações de contêiner (B25).
- Padrões impostos por componente: `StateSeal` × `ConditionMarker`; `Button.disabledReason`; `EmptyState` × `NoAccessState` (B103); `RecordList` "Mostrando N de M"; pt-BR via `Intl` (`makeFormatters(locale)` — P1 fechada); códigos de estado invariantes em gênero.
- Idioma: identificadores em inglês; toda string visível em pt-BR; comentário só para o *porquê*.
- Verificação: `tsc --noEmit`, `eslint src`, `vitest run`; 52 rotas exercidas contra o dev server com ids reais.
- Fase 6 não recebe decisão visual (Fase 5).

---

## Tópico 5 — Pendências do frontend (registro de leituras adotadas)

source: `docs/PENDENCIAS-FRONTEND.md` (atualizado Fase 6, 2026-09-10; A2 fechado em 2026-09-15 pelo commit `d713253`)

**A. Conceitos de interface sem base ontológica (nenhum persiste dado novo):**
- A1 Notificação — visão derivada de Eventos e Registros de Atividade; "lida/não lida" é estado de sessão.
- A2 **fechado** — autenticação real (ver REQ-f1-supabase-auth). Revelou o store singleton no SSR → `StoreProvider` por árvore.
- A9 **aberto** — em nome de quem age uma resposta anônima a Formulário (`/f/<segredo>`, `/p/<segredo>`): `PublicoProvider` mantém a sessão do Proprietário; "`submitForm` deveria ignorar a sessão e usar `form.ownerMemberId`, e a sessão pública deveria ser um Ator `sistema`? É decisão de ontologia (documento 19, Proveniência)". → OQ-PF-01.
- A3 Avatar — iniciais sobre cor derivada do id; Agente com forma própria (B7).
- A4 Visualizações salvas no CRM — estado de sessão; A8 restrita à Estrutura.
- A5 Busca global — nome e título com `ver`; não alcança Fragmento/Mensagem/Comentário/Memória (RN-PAI-15).
- A7 Administrador alcança contêiner privado — via Auditoria (T50) ou campo de identificador; diálogo D06 exige motivo e gera Registro.
- A6 Limites impostos e Política de lixeira — valores do seed, sempre exibidos.

**B. Questões abertas da ontologia (leitura conservadora):** DO-CNH-06 (Tags em Documento — segue B5); C5 grupos; C12 horas úteis só onde há Horário de atendimento; C13 Campos em Membro/Equipe/Integração — não; C14 Definições entre Espaços (Painéis fechado por B105; Automações de escopo Espaço de Trabalho aberta); C16; C17 Prioridade fixa; C18; C19; C20; C21 escopo `equipe` — não; C22 uma série por moeda; C23; C24; C25; C26; C27; C28; C29; C30; C31; **C32 decidida (b)** — CAND-04; **C33** espelho Negócio → Tarefa é cópia de seed, não sincronização — "Ligar os dois ... é decisão de produto e pede backend"; **C34** Contas a receber — CAND-05.

**D. Divergências do PRD resolvidas contra a ontologia:** Negócios em Quadro (aba = situação, coluna = Etapa); `/minha-conta` acrescentada; `/configuracoes` por contêiner; rotas de Canal e Fila; `/configuracoes/templates`; sem link público de Painel (B104); restaurar devolve `pausado` também para Automação (B94); `pendente` em Conversa (DO-CXE-07).

**Pendências técnicas:** P1 fuso — **fechada** (`makeFormatters(locale)`, 73 chamadas em 24 arquivos). P2 reconvite por identidade de Usuário — **aberta**; "Fecha quando existir um diretório de Usuário — ou seja, quando existir backend" → REQ-f1-reconvite-por-usuario.

---

## Questões abertas — consolidação de todo o conjunto

Nenhuma delas está decidida. As recomendações são dos próprios documentos, citadas como tal. O roadmapper deve planejar **quem decide e quando**, não decidir.

### Do SPEC 03-plano §7 ("Decisões ainda abertas")
- **D6** — Solicitação: Lista própria com Vínculo à Conta, ou Status iniciais na própria Lista de Contas? Recomendação: Lista própria ("tem aprovador e prazo próprios, e nem toda Conta nasce de Solicitação"). Bloqueia REQ-f2-lista-solicitacoes.
- **D7** — Onde o recebimento é controlado hoje? "Perguntar ao Financeiro — aberto desde `contas-a-receber.md §12`." Bloqueia REQ-f5-contas-a-receber. (= OQ-CR-01)
- **D8** — Aprovação só por clique ou manter o classificador de comentário? Recomendação: as duas; classificador como fallback por 90 dias, depois medir. Afeta REQ-f2-classificador-fallback.
- **D9** — Status `aprovado` da Lista de Contas (configurado, nunca usado). Recomendação: remover ao criar a Lista de Solicitações. (= OQ-CP-01)
- **D10** — Emissão manual de NF: ação na Tarefa ou manter Google Sheets? Recomendação: ação na Tarefa. Afeta Fase 4.
- **D11** — Onde `apps/api` roda? Recomendação: a mesma VPS, ao lado do `automation/`, na nginx existente. Bloqueia REQ-f1-deploy-apps-api.
- **D12** — Quando mover o `automation/` para o monorepo? "Adiado por decisão sua. Reavaliar ao fim da Fase 2." (DEC-15)

### Do ADR 04-spike
- **OQ-ADR-01** — Região do projeto Supabase: `us-west-2` (Oregon) hoje; `sa-east-1` (São Paulo) reduz a conexão de 250 para 99 ms daqui. "recriá-lo em São Paulo agora custa um `npm run migrar`. Depois, custa uma migração de dados. É decisão do dono do projeto." Interage com D11 (onde o `apps/api` roda determina qual latência importa). **Barata agora, cara depois** — candidata a primeira decisão.

### Do SPEC 03-plano §2.4 (ponto de revisão explícito)
- **OQ-PLAN-01** — A divisão "ontologia para o que substitui o ClickUp; telas portadas para o resto" (DEC-16) "é o ponto a corrigir antes da Fase 2" se não for a desejada.

### Do SPEC contas-a-pagar §12
- **OQ-CP-01** — Status `aprovado`: entra na plataforma ou o Conjunto fica com sete? (= D9)
- **OQ-CP-02** — Campos `Data Vencimento` (L) e nativa duplicados: "Manter só o nativo e migrar L para ele" (CAND-02, a confirmar).
- **OQ-CP-03** — `Equipe` (W, USD) e `Produto` (Y) herdados, vazios: não replicar na Lista; se o Espaço "Gestão" os definir, ocultá-los.
- **OQ-CP-04** — De-para ERP (Centro de Custo, Tag, Categoria) → (Conta de pagamento, Categoria Omie, Código) "não está em lugar nenhum que a API alcance. Precisa ser exportada do Omie ou ditada pelo Financeiro antes de o Agente funcionar." Bloqueia REQ-f3-agente-lancamento-omie-real e REQ-f3-de-para-categorias-real. (O `automation/` já resolve parte disso por RAG em `conciliador_contas` + `ListarCategorias`.)
- **OQ-CP-05** — Quem gera a remessa (CNAB) e como: sai do Omie ou do banco? Não afeta a plataforma, afeta a Integração.
- **OQ-CP-06** — Regra exata da recorrência ("mesmo dia, dia útil anterior" inferida de três vencimentos): confirmar com o Financeiro antes de codificar. Afeta A1 (CON-CP-05).
- (o item "Volume" do §12 é restrição — CON-CP-12 — não pergunta.)

### Do SPEC contas-a-receber §12
- **OQ-CR-01** — Lista dormente desde out/2025: onde o recebimento é controlado hoje (Omie? planilha? plataforma de pagamento?). "Se a resposta for 'no Omie', este documento vira spec da **Integração** de leitura, não de uma Lista." (= D7)
- **OQ-CR-02** — Cliente = Tarefa em outro Espaço no ClickUp; na plataforma o Vínculo deve apontar para Contato/Empresa do CRM e "Gestão de clientes" deixa de existir como Lista. Decisão de produto. (Protótipo adotou Contato — CAND-05.)
- **OQ-CR-03** — `disponível para saque` e `estornado` nunca usados: manter só se os Saques passarem a usar o primeiro; o segundo pode ser Motivo dentro de `descartado`.
- **OQ-CR-04** — Valor dos Saques (todos `0`): confirmar se o valor sacado deve ser registrado ("provável: sim, senão a Lista não fecha com o extrato"). Afeta RN-CR-03.
- **OQ-CR-05** — Prazos de escalonamento 30/60 dias (R4/R5) propostos a partir de um único caso; o Financeiro precisa dizer o prazo real.
- **OQ-CR-06** — Tag `conta tria` em Contas a receber: se a intenção era espelhar Contas a pagar, vira campo "Conta de recebimento", não Tag.
- (o item "Data de pagamento vs `date_closed`" é restrição — CON-CR-10.)

### Do DOC 02-comparativo (divergências sem dono)
- **OQ-CMP-01** — Forma de pagamento `Cartão` + campo `Link de pagamento`: o mapper do financeiro-tria os trata; a Lista de Contas a pagar tem só três formas. Acrescentar? (Provavelmente pertence à spec da Solicitação — REQ-f0-spec-solicitacao-de-pagamento.)
- **OQ-CMP-02** — Status `em revisão` (só Family Office): entra na plataforma?
- **OQ-CMP-03** — Departamento Omie (match por centro de custo em `ListarDepartamentos`): falta na plataforma; onde vive?
- **OQ-CMP-04** — Validação de dígito de CPF e consulta de CNPJ (cnpj.ws): a plataforma não faz; fica no `automation/` (via Solicitação) ou entra na plataforma?
- **OQ-CMP-05** — Autonomia do Agente de lançamento no ERP: "Ensaio na primeira semana e Política de aprovação depois, decisão de produto" (`contas-a-pagar.md` §9).

### Do DOC PENDENCIAS-FRONTEND
- **OQ-PF-01 (A9)** — Em nome de quem age uma resposta anônima a Formulário: `form.ownerMemberId` + Ator `sistema`? Decisão de ontologia (Proveniência). Afeta REQ-f2-formulario-solicitacao diretamente.
- **OQ-PF-02 (C33)** — Espelho Negócio → Tarefa: qual lado manda, o que acontece em Ganho/Perdido, quem vê o quê. Decisão de produto; pede backend. Fora do plano do Financeiro.
- **OQ-PF-03 (C14, Automações)** — Definições de Campo de Tarefa em Automação de escopo Espaço de Trabalho: aberta na ontologia. Relevante para o motor de Automações (REQ-x-motor-automacoes).

### Do DOC 00-LEIA-PRIMEIRO
- **OQ-GHL-01** — Go High Level: fora deste plano; precisa de inventário próprio feito a partir da conta.

### Pré-requisitos não escritos que a síntese detectou (para o roadmapper confirmar)
- **OQ-SYN-01** — Fase 4 porta telas que hoje leem o `automation/` com `anon_read` e sem autenticação. O plano não diz como o CRM N1 autentica essas leituras nem se o `automation/` ganha autenticação de entrada. Não é decisão registrada em lugar nenhum.
- **OQ-SYN-02** — `POST /webhooks/plataforma/solicitacao-criada` exige que o `apps/api` emita eventos de saída (webhook/fila) — capacidade que não existe e que o Motor de Automações (REQ-x-motor-automacoes) provavelmente compartilha. Decidir se é a mesma peça.
- **OQ-SYN-03** — Com DEC-08 (projetos Supabase separados), qualquer leitura que o plano imaginava "por JOIN" entre `plataforma` e `public` precisa passar por HTTP. Nenhum documento lista quais leituras são essas (candidatas: `omie_clientes` para o CNPJ da Empresa; `conciliador_contas` para o de-para; `solicitacoes_pagamentos` para a timeline).
