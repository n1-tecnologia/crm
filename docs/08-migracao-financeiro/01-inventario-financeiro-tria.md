# Inventário — o que existe hoje no financeiro-tria

Repositório: `/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria`. Lido em 2026-09-15 a partir do código, das migrations e da documentação interna (`docs/sistema-financeiro.md`, `docs/supabase-schemas.md`, `docs/n8n-mastra-payment-matrix.md`). Onde a documentação e o código divergem, o código venceu e a divergência está anotada.

---

## 1. Arquitetura em três peças

```text
┌──────────────────────┐   webhooks    ┌─────────────────────────────────┐
│  ClickUp             │ ────────────► │  automation/  (Express + Mastra) │
│  Solicitação de pgto │ ◄──────────── │  porta 4100 · PM2 · nginx · VPS  │
│  Contas a pagar      │  comentários  │  3 tenants · cron interno        │
└──────────────────────┘  status, tags └────────────┬────────────────────┘
                                                    │ service role
┌──────────────────────┐   anon key    ┌────────────▼────────────────────┐
│  Frontend Vite/React │ ────────────► │  Supabase (Postgres 17 + vector) │
│  Lovable · Vercel    │  leitura      │  projeto qewznpnmaqhqfyhncdnx    │
│  15 telas /financeiro│ ────────────► │  26 tabelas + 7 views + 33 RPCs  │
└──────────────────────┘  API :4100    └─────────────────────────────────┘
                                                    │
                     ┌──────────┬──────────┬────────┴───┬──────────┬──────────┐
                   Omie ERP   Gemini    OpenAI      Evolution   cnpj.ws   Guru/Kiwify/TMB
                   (6 contas) (anexos)  (resumo,    (WhatsApp)  (CNPJ)    (vendas → NF)
                                        aprovação,
                                        embedding)
```

| Peça | Stack | Onde roda | Tamanho |
|---|---|---|---|
| Frontend | Vite 5, React 18, React Router 6, shadcn/Radix, Tailwind 3, TanStack Query, Recharts, xlsx | Vercel (`financeiro-tria.vercel.app`) e Lovable | 23 páginas, 20 componentes de domínio |
| `automation/` | Node 20, Express 4, Mastra, zod 4, `@supabase/supabase-js`, tsx | VPS via PM2 (`ops/deploy/ecosystem.config.cjs`), nginx com HTTPS | 50 arquivos `.ts`; serviço Tria com 1.928 linhas |
| Supabase | Postgres 17, `pgvector`, `pgcrypto`; 9 migrations versionadas + tabelas criadas fora delas (Lovable/n8n) | Nuvem | 26 tabelas nos tipos gerados, 41 objetos segundo o catálogo interno |

**Autenticação:** não existe. `AuthContext.tsx` compara usuário e senha com `VITE_APP_USERNAME` / `VITE_APP_PASSWORD` (variáveis do build, portanto embutidas no bundle) e grava `localStorage.auth = "true"`. As tabelas operacionais têm policy `anon_read` — qualquer um com a chave pública lê `solicitacoes_pagamentos`, `transacoes`, `financas_mp`.

---

## 2. Módulos e onde cada um está implementado

`docs/sistema-financeiro.md` (maio/2026) diz que Emissão de Notas, Verificações e Acompanhamentos ainda rodam no n8n. **O código diz outra coisa**: `automation/src/tenants/tria/invoice-emission/` existe, `server.ts` tem o cron das 9h e 10h, e os últimos 8 commits são de NF-e. A tabela abaixo reflete o código.

| Módulo | Tenant | Implementação | Evidência | Depende do ClickUp? |
|---|---|---|---|---|
| Solicitação de pagamento — pipeline de 7 etapas | tria | `automation/` | `tenants/tria/payment-automation-service.ts` (1.928 l.) | **Sim, inteiramente** |
| Idem | marcos-paulo | `automation/` (clone) | `tenants/marcos-paulo/payment-automation-service.ts` | Sim |
| Idem, multi-empresa | family-office | `automation/` (clone) | `tenants/family-office/…` + `config.ts` com 5 empresas | Sim |
| Emissão de NF — ingestão Guru / Kiwify / TMB | tria | `automation/` (webhooks) | `invoice-emission-service.ts` `ingestGuru/Kiwify/Tmb`; catálogo `tria-invoice-ingest-*` | Não |
| Emissão de NF — Verificação 7 dias | tria | `automation/` (cron 09h BRT) | `markSeteDias()`; `server.ts` | Não |
| Emissão de NF — emissão no Omie (pedido + OS) | tria | `automation/` (cron 10h + worker) | `emitirNotas()`, `emitirNotasIfPending()`; `omie.ts` `incluirPedido/faturarPedido/incluirOS/faturarOS` | Não |
| Emissão manual via Google Sheets | tria | **n8n** (sem código) | só `Arquivos_base/Tria/Emissão de notas/Emissão de notas.json` | Não |
| Cadastro de produtos via Sheets | tria | **n8n** (sem código); a UI edita a tabela direto | `Produtos.tsx` faz `.from("produtos_cadastrados_emissao_notas")` | Não |
| Extratos por WhatsApp (CSV/XLSX/OFX/PDF) | marcos-paulo | `automation/` | `http/bank-statement-webhooks.ts` → `financas_mp` | Não |
| Relatório diário WhatsApp | marcos-paulo | `automation/` | `extras/whatsapp-daily-report.ts`, cron `0 10 * * 1-5` | Não |
| Sync semanal de clientes Omie | marcos-paulo | `automation/` | `extras/weekly-client-sync.ts` → `omie_marcos` (vetorial) | Não |
| Plano de contas (CRUD + import + embeddings) | todos | `automation/` + Edge Function | `http/plano-contas-routes.ts`; `supabase/functions/gerar-embeddings-plano-contas` | Não |
| Workflows (catálogo read-only + histórico de runs) | todos | `automation/` | `workflows/catalog.ts` (8 workflows), `workflow-store.ts` | Não |

**Peças que não têm código e vivem só como JSON de n8n em `Arquivos_base/`:** 8 fluxos da Solicitação Tria (já portados), 5 de Emissão (4 portados, 1 manual não), 7 do Marcos Paulo (portados), 3 do Family Office (portados). Os JSONs são a documentação de origem das regras; não são runtime.

---

## 3. O pipeline de Solicitação de pagamento (o coração)

Um `run` por Tarefa do ClickUp. Etapas com `step_key` fixo: `sync → deadline → document → invoice_audit → register_prediction → assign_responsible → approval_comment → account_selector → supplier → category → summary → review → launch_omie`.

| # | Etapa | Gatilho | O que faz | Regra / integração |
|---|---|---|---|---|
| 1 | Validação | webhook `task-created` | Lê a Tarefa, extrai campos pelo **nome** (`clickup-payment-mapper.ts`), grava em `solicitacoes_pagamentos` | Prazo: criação ≥ 2–3 dias úteis antes do próximo vencimento padrão (**dias 5, 15, 25**) — `evaluateRequestDeadline`. Documento: CPF por dígito verificador, CNPJ via `publica.cnpj.ws`. Anexos: Gemini extrai total, nº NF, chave de acesso, código de barras e **audita** contra o valor declarado |
| 2 | Aprovador | continua a 1 | Resolve o "estrategista" por `(centro de custo, valor)` e comenta `@Fulano, para aprovação` | `APPROVAL_ROUTES`: finq→Elifas; presidência ≥R$5k→Elifas, <5k→Fabíola; auton health/tria tech→Thiago; tria ≥5k→Thiago, <5k→Fabíola; igor alves/roberth→Iallas; fallback Financeiro TRIA |
| 3 | Aprovação | webhook `comment-created` (resposta no thread) | Só aceita se `parent == ComentarioID` **e** autor == `id_responsavel`. OpenAI classifica: `approved / failed / review_requested / irrelevant` | Aprovado → status `aprovado`, `Aprovado=true`, atribui Contas a Pagar. Reprovado → `não aprovado` |
| 4 | Conta | continua | Centro de custo → conta corrente Omie por nome (`ListarContasCorrentes`) | `CONTA_PAGAMENTO_POR_CENTRO_CUSTO`: igor alves→TRIA TF, roberth→TRIA Roberth, auton→Auton Health, demais→TRIA |
| 5 | Fornecedor + categoria + RESUMO | continua | `ListarClientesResumido` por CNPJ/CPF; se não existe, enriquece e `IncluirCliente`. Categoria: embedding OpenAI → `match_<banco vetorial>` (k=3, threshold 0,3) → código `X.XX.XX`. OpenAI Assistants gera o RESUMO; publicado como comentário `📋 RESUMO DE PAGAMENTO` | Cache de fornecedor 5 min (rate limit "Consumo redundante" do Omie). `ThreadID` do Assistant guardado para a revisão |
| 6 | Revisão | webhook `contas-pagar-comment` (resposta no thread do RESUMO) | Só revisores em `CLICKUP_REVIEWER_IDS`. Refaz RAG com o texto do pedido, reenvia ao Assistant na **mesma thread**, republica | — |
| 7 | Lançamento | webhook `status-changed` → "em lançamento omie" | **Reparseia o RESUMO por regex** (`parseAiSummary`), atualiza vencimento e tag `conta *` no ClickUp, resolve conta corrente e departamento, `IncluirContaPagar` com CNAB/PIX, `IncluirAnexo` por arquivo, comenta confirmação | Idempotente por `codigo_lancamento_integracao` (`ConsultarContaPagar`). Fluxo "Manual": webhook `task-updated` quando o campo "Manual" recebe a opção `b6818033-…` |

**Sem ClickUp, o que resta deste pipeline:** as regras (`payment-rules.ts` — prazo, documento, roteamento, parsers, 619 linhas, com teste), os adapters, os prompts. O serviço em si é 80% leitura/escrita de Tarefa, comentário e status — o que a plataforma faz nativamente.

---

## 4. Acoplamento com o ClickUp — a lista completa

### 4.1 Workspaces, Listas e usuários

| O quê | Valor | Onde |
|---|---|---|
| Team Tria | `9011731314` | `CLICKUP_TEAM_ID` |
| Lista Solicitação de pagamento (Tria) | `901109104938` | `CLICKUP_LIST_SOLICITACAO_PAGAMENTO_ID` |
| Lista Contas a pagar (Tria) | `901107637383` | `CLICKUP_LIST_CONTAS_PAGAR_ID` — **é a mesma Lista que `docs/07-processos/contas-a-pagar.md` leu** |
| Outras Listas referenciadas no `.env.example` | Contas a receber, Apuração, Gestão de ferramentas, Backlog financeiro, Abertura/gestão de contas | sem código que as use |
| Team Marcos Paulo / Family Office | `9011658148` | `MP_CLICKUP_TEAM_ID`, `FO_CLICKUP_TEAM_ID` |
| Lista compartilhada MP + FO (solicitação e contas a pagar) | `901111928443` | `MP_CLICKUP_LIST_*`, `FO_CLICKUP_LIST_CONTAS_PAGAR_ID` |
| Lista Solicitação FO | `901109642259`; Contas a receber FO `901109642267` | `FO_CLICKUP_LIST_*` |
| Usuário "Contas a Pagar" (Financeiro) | `81581816` | usado como atribuído, revisor e fallback nos três tenants |
| Aprovadores | Elifas `81591229`, Fabíola `81581798`, Thiago `81581826`, Iallas `81582295`; revisor secundário FO `81581802` | `CLICKUP_RESPONSAVEL_*` |
| Opção "Manual" do campo Integração manual | `b6818033-07d2-436a-b01f-aa66313e3300` | `CLICKUP_CF_MANUAL_OPTION_ID` |

### 4.2 Webhooks (rotas em `http/routes.ts`)

`POST /webhooks/{tria|marcos-paulo|family-office}/clickup/{task-created | comment-created | contas-pagar-comment | task-updated | status-changed}` + retrocompat `/webhooks/clickup/*` → Tria. Cadastro dos webhooks pelo script `automation/scripts/clickup-webhooks.ps1`.

### 4.3 Campos personalizados lidos (por nome, com tolerância a prefixo `A-`, `01-`)

Centro de Custo · Categoria de pagamento · Valor · Data Vencimento / Vencimento · Data de Emissão · Fornecedor (CPF/CNPJ) · CNPJ · CPF · CPF/CNPJ · Nome Fornecedor / Razão Social · Nome do solicitante · Whatsapp do Solicitante · Forma de pagamento · Chave pix · Pix copia e cola / QR Code · Código de barras / Linha digitável · Link de pagamento · Anexo · Integração manual (Manual). O Family Office usa os mesmos com prefixo numérico (`01-Centro de Custo` … `15-Valor`) e mais `02-Empresas`.

### 4.4 O que o backend escreve de volta no ClickUp

Comentário (menção ao aprovador; RESUMO; confirmação; erro com ação recomendada) · atribuição de comentário · status (`aprovado`, `não aprovado`, `lançado omie`) · tag (`conta tria`, `conta tf tria`, `conta roberth`, `finq`) · data de vencimento.

---

## 5. Modelo de dados no Supabase

Agrupado por função. `★` = tabela que o backend escreve; sem marca = só lida ou legado.

### 5.1 Operacional da Solicitação

| Tabela | Colunas | Observação |
|---|---|---|
| ★ `solicitacoes_pagamentos` | `id, TaskID, ThreadID, ComentarioID, Aprovado, comentario, Data_previsao, id_responsavel, comentario_aprovacao, centro_custo, app_key, app_secret, banco_de_categorias, tipo` (+ `empresa`, migration 2026-05-26) | Fonte de verdade do fluxo. **Credenciais Omie por linha.** `comentario` guarda o RESUMO da IA em texto e é reparseado no lançamento. Mesmo schema do n8n "por compatibilidade" |
| ★ `solicitacoes_pagamentos_marcos_paulo` | idem, `data` no lugar de `Data_previsao` | Tenant PF isolado por tabela |
| `payment_requests` | modelo "rico" (uuid, `run_id`, `supplier_document`, `amount`, `due_date`, `cost_center`, `payment_account`, `status`) | **Desenhado e nunca usado** — o esquema-alvo que a migração deveria ter feito |

### 5.2 Observabilidade das automações

`automation_runs` · `automation_steps` · `automation_events` · `approval_tasks` · `integration_jobs` · `automation_workflows` · `automation_workflow_runs`. Enums `automation_run_status` (10 valores), `automation_step_status`, `automation_event_severity`, `automation_recommended_action` (7 ações), `approval_task_status`. O adapter escreve nelas (`createOrResumeRun`, `upsertStep`), mas segundo `n8n-mastra-payment-matrix.md` o painel **sintetiza os runs a partir de `solicitacoes_pagamentos`** e não depende delas. Realtime habilitado em `automation_runs` e `automation_events`.

### 5.3 RAG de categorias contábeis

13 tabelas `conciliador_contas_{pagar|receber}_{tria|finq|pf|plx|exo_loteamentos|exo_participacoes|oliveira_participacoes}` (`id, content, metadata, embedding vector(1536)`) + 33 funções `match_*` + 7 views `_v` legadas. A migration `20260526120000` criou a **unificada** `conciliador_contas` com filtro `metadata @> {empresa, tipo}` e função `match_conciliador_contas`; a `20260526120100` copiou os dados sem dropar as antigas. Embedding: OpenAI `text-embedding-3-small`.

### 5.4 Plano de contas e cadastros

| Tabela | Uso |
|---|---|
| `planos_de_contas` (`organizacao, cod, categoria, categoria_clickup, descricao, embedding`) | CRUD pela UI; import CSV; embeddings pela Edge Function |
| `omie_clientes` (50 colunas: documento, razão social, endereços, **dados bancários** incl. chave Pix) | Espelho do Omie |
| `contas_pagar` / `contas_a_receber` (18 colunas, tudo `text`) | Espelho de lançamentos do Omie para relatório |

### 5.5 Emissão de notas

| Tabela | Uso |
|---|---|
| `transacoes` (34 colunas: pedido, cliente, endereço, `plataforma`, `"7 dias"`, `controle_emissao`, `nota_cancelamento`, `emissao_nota_produto/servico`, **`api_key`, `app_secret`** do Omie, taxas) | Uma linha por venda Guru/Kiwify/TMB |
| `produtos_cadastrados_emissao_notas` (`id_produto, nome_produto, porcentagem_servico, porcentagem_produto`) | Alíquotas por produto |

### 5.6 Auxiliares Marcos Paulo

`financas_mp` (extratos), `gastos_financeiros`, `machine_marcos_paulo` e `omie_marcos` (vetoriais), `relatorio_semanal_marcos_paulo`.

### 5.7 Fora do financeiro

`candidatos` (recrutamento), `webhook_test_log`.

---

## 6. Integrações externas

| Sistema | Adapter | Chamadas usadas | Credenciais |
|---|---|---|---|
| **Omie** | `adapters/omie.ts` (594 l.) | `ListarClientesResumido`, `IncluirCliente`, `ConsultarCliente`, `IncluirContaPagar`, `ConsultarContaPagar`, `ListarContasCorrentes`, `ListarResumoContasCorrentes`, `ListarDepartamentos`, `ListarCategorias`, `IncluirAnexo`, `IncluirPedido`, `FaturarPedido`, `IncluirOS`, `FaturarOS`, `ListarProdutos`, `ListarPaises`; retry centralizado no erro "REDUNDANT" | **6 contas**: Tria, FINQ/Konq, Marcos Paulo, EXO Loteamento, EXO Participações, Oliveira Participações — `OMIE_*_APP_KEY/SECRET`, `FO_EMPRESA_*` |
| **Google Gemini** | `adapters/ai.ts` | leitura de anexos (total, nº NF, chave de acesso, boleto), auditoria cruzada, extração de extratos em PDF | `GOOGLE_API_KEY`, `GEMINI_MODEL` (padrão `gemini-3.5-flash`) |
| **OpenAI** | `adapters/ai.ts` | Assistants (RESUMO e revisão, um `assistant_id` por tenant), classificação de aprovação, embeddings | `OPENAI_API_KEY` |
| **Evolution API** (WhatsApp) | `adapters/evolution.ts` | `sendText`, `sendListMessage` | instância `numeropvmarcos`; números de Mari, Marcos e grupo financeiro em `config.ts` |
| **publica.cnpj.ws** | `adapters/public-apis.ts` | validação e enriquecimento de CNPJ | pública |
| **Guru / Kiwify / TMB** | webhooks de entrada + `TMB_BEARER_TOKEN` | ingestão de vendas | tokens |
| **ClickUp** | `adapters/clickup.ts` (132 l.) | `getTask`, listar Tarefas da Lista, `createComment`, `getCommentReplies`, `addTaskTag`, `updateTaskDueDate`, `setStatus` | `CLICKUP_API_TOKEN` |

---

## 7. Frontend — as telas

Hub `/financeiro` (`FinanceiroShell` com trocador de empresa `EmpresaSwitcher`: Tria, FINQ/Konq · Marcos Paulo, EXO Loteamento, EXO Participações, Oliveira Participações):

| Rota | Tela | Fonte de dados |
|---|---|---|
| `/financeiro` | Dashboard (métricas + últimos runs) | `GET /financeiro/solicitacoes` → `buildDashboardStats` |
| `/financeiro/automacoes`, `/:id` | Runs e detalhe com timeline | `GET /automation/runs`, `/runs/:id`; ações approve/review/retry/cancel |
| `/financeiro/aprovacoes` | Pendentes de aprovação | derivado de solicitações |
| `/financeiro/problemas` | Runs com erro / ação recomendada | `buildProblemRows` |
| `/financeiro/solicitacoes` | Tabela de solicitações, toggle Aprovado, popup de detalhe | `PATCH /financeiro/solicitacoes/:id/aprovado` |
| `/financeiro/contas-pagar`, `/contas-receber` | `ContasModule` — **só solicitações aprovadas**, filtradas por `tipo` | `listSolicitacoesPagamentos(empresa)` |
| `/financeiro/plano-contas` | CRUD + import (oculto do menu) | `GET/POST/DELETE /plano-contas` |
| `/financeiro/notas-fiscais`, `/produtos` | Listagem/edição direta no Supabase | `.from("transacoes")`, `.from("produtos_cadastrados_emissao_notas")` |
| `/financeiro/upload` ("Extratos do Marcos") | Upload de extrato | `POST /webhook/receber-whatsapp-doc/:origem` |
| `/financeiro/workflows`, `/notificacoes`, `/integracoes` | Catálogo de workflows, webhooks, integrações (parcialmente ocultos) | `GET /workflows*` |

A UI é dark, shadcn, tokens próprios (`design-system.html` em `Arquivos_base`). **Não porta** para a plataforma — a plataforma tem sistema de design próprio e a Lista já é a tela. O que a UI do financeiro-tria informa é **quais leituras** o Financeiro precisa (dashboard, problemas, aprovações pendentes, timeline por solicitação).

---

## 8. Operação

- **Deploy do backend:** `ops/deploy/setup-vps.sh` (Node 20, PM2, nginx, cert) + `deploy.sh` (`git pull`, `npm ci`, `pm2 reload`). Logs em `ops/logs/`. `max_memory_restart 512M`.
- **Deploy do frontend:** Vercel/Lovable, `npm run build`.
- **Cron:** interno ao processo (tick por minuto). Sem fila, sem retry persistente: se o processo cair no minuto errado, o dia é pulado (há `fix-stuck-runs.ts` para consertar à mão).
- **Migrations:** `supabase db push`. Tabelas antigas nunca são dropadas ("backup/rollback").
- **Scripts de apoio:** `emitir-nota-teste.ts`, `probe-faturamento.ts`, `verify-omie.ts`, `verify-os.ts`, `clickup-webhooks.ps1`.

---

## 9. Estado do repositório e pontos de atenção

| Achado | Onde | Por que importa para a migração |
|---|---|---|
| **89 arquivos modificados sem commit** — 49 em `src/components/ui`, configs de build, `package.json` | `git status` | Provável regeneração do shadcn/Lovable. Antes de portar qualquer coisa do frontend, decidir se isso entra ou se descarta |
| `automation/.env` com credenciais reais existe no diretório | `automation/` | Confirmar que está no `.gitignore` antes de qualquer cópia do repositório |
| **Credenciais Omie hardcoded como default** | `tenants/marcos-paulo/config.ts` (`appKey: "4815466851195"`, `appSecret: "7b8f…"`) | Estão no histórico do git. Rotacionar no Omie antes de migrar; na plataforma, credencial só em cofre |
| Credenciais Omie **gravadas por linha** em `solicitacoes_pagamentos` e `transacoes` | Supabase | Não copiar essas colunas. Na plataforma a credencial pertence à Integração da Empresa |
| RESUMO da IA como fonte canônica, parseado por regex | `parseAiSummary`, `launchOmie` | Frágil por desenho. Na plataforma os campos são estruturados e o RESUMO é **saída**, não entrada |
| Três clones do serviço de pagamento (Tria, MP, FO) | `tenants/*/payment-automation-service.ts` | Não portar três vezes. O que difere está em `config.ts` + `payment-rules.ts` de cada um |
| Documentação desatualizada sobre o que ainda é n8n | `docs/sistema-financeiro.md` §6, §9, §10.5 | Usar o código como fonte, não o documento |
| `docs/changelog.md` tem uma entrada (2026-05-11) | — | O histórico real está só no `git log` |
| Aprovadores, revisores e "Financeiro" são IDs de usuário do ClickUp | 38 `CLICKUP_*` | Precisam de uma tabela de-para ClickUp → Membro da plataforma |
| Lista "Contas a receber" tem variável de ambiente e nada de código | `CLICKUP_LIST_CONTAS_RECEBER_ID` | Coerente com `docs/07-processos/contas-a-receber.md`: a Lista está dormente desde out/2025 |

---

## 10. O que fica, o que muda, o que morre

Segundo o [plano v2](03-plano-de-migracao.md): o backend continua onde está e como está. A tabela abaixo é de **impacto no `automation/`**, não de mudança de repositório.

### Fica intacto — a maior parte

`adapters/omie.ts` e as 6 contas · `adapters/ai.ts` com os prompts de Gemini e OpenAI · `evolution.ts` · `public-apis.ts` · `env.ts` · `supabase.ts` · `payment-rules.ts` (prazo 5/15/25, CPF/CNPJ, roteamento por centro e valor, parsers de Pix e boleto) e o seu teste · `payment-automation-service.ts` nos 3 tenants · `invoice-emission/` inteiro · `plano-contas-routes.ts` e a Edge Function de embeddings · `workflows/catalog.ts` e `workflow-store.ts` · as tabelas do schema `public` · `automation/.env` · o deploy PM2.

### Muda — três pontos, só

| O quê | Como |
|---|---|
| `adapters/clickup.ts` | Substituído por `adapters/plataforma.ts`: os mesmos 7 métodos, agora chamando `apps/api` por HTTP. O arquivo antigo fica no repositório, desligado por variável de ambiente |
| `clickup-payment-mapper.ts` (×3) | Vira `plataforma-payment-mapper.ts`: ~400 linhas de parsing do ClickUp viram ~50 de leitura tipada. **Apaga código** |
| Entrada do pipeline | O webhook `task-created` do ClickUp dá lugar a `POST /webhooks/plataforma/solicitacao-criada`, disparado pelo `apps/api` quando a Tarefa nasce |

### Morre

`scripts/clickup-webhooks.ps1` · `AuthContext` (senha no bundle do front) e a RLS `anon_read` · as 23 telas do front atual, substituídas pelo CRM N1 · `payment_requests` (desenhada, nunca usada) · as 13 tabelas vetoriais por empresa e as 7 views `_v`, quando a `conciliador_contas` unificada assumir.

### Fica como referência

Os JSONs do n8n em `Arquivos_base/` — são a origem documentada das regras · `solicitacoes_pagamentos` continua sendo a fonte de verdade do pipeline; o que muda é que `TaskID` passa a apontar para a Tarefa da plataforma (§2.3 do plano).
