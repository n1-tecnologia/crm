# Plano — CRM N1 como front único, backend financeiro intacto

**Versão 2 (2026-09-15).** Substitui a v1, que presumia reescrever o `automation/` dentro de `apps/api`. A decisão do dono do projeto é outra e é melhor: **o backend do financeiro-tria continua como está** — mesmo código, mesmo banco, mesmas variáveis de ambiente, mesmo deploy. O que muda é o **front**: o CRM N1 passa a ser a interface, substituindo o ClickUp **e** o painel atual do financeiro-tria.

Depende do [inventário](01-inventario-financeiro-tria.md) e do [comparativo](02-comparativo-com-a-plataforma.md), que continuam valendo.

---

## 1. A descoberta que torna isso viável

O acoplamento do pipeline com o ClickUp é uma **costura de 7 métodos num arquivo de 132 linhas**. As 1.928 linhas de `payment-automation-service.ts` (× 3 tenants) nunca chamam a API do ClickUp: tudo passa por `clickUpAdapter`. E todo método já degrada sozinho quando não há token (`if (!this.token) return …`).

| Método | Usos no serviço Tria | O papel que o ClickUp exerce |
|---|---|---|
| `getTask` | 6 | o **formulário** — o que a pessoa preencheu |
| `createComment` | 9 | a **conversa** — menção ao aprovador, RESUMO, erro com ação recomendada |
| `getCommentReplies` | 2 | a **decisão do aprovador** voltando |
| `updateTaskStatus` | 5 | o **progresso** visível |
| `updateTaskDueDate`, `addTaskTag` | 2 | escrita de volta do que foi derivado |
| `listPaymentRequestTasks` | 1 | sincronização em lote |

Trocar esse arquivo por um adapter que fala com o CRM N1 mantém **validação, roteamento de aprovador, IA, RAG e Omie sem uma linha alterada**. É o plano inteiro em uma frase.

---

## 2. Arquitetura-alvo

```text
          ┌──────────────────────────────────────────────┐
          │  crm-n1 — o front único                       │
          │  apps/web  ──►  @n1/dominio  (a ontologia)     │
          └───────┬───────────────────────┬───────────────┘
                  │ operações do domínio   │ leitura das ferramentas
                  ▼                        │ financeiras
          ┌───────────────┐                │
          │  apps/api     │                │
          │  schema       │                │
          │  plataforma   │                │
          └───────┬───────┘                │
                  │                        │
   ┌──────────────▼────────────────────────▼──────────────┐
   │  Supabase  qewznpnmaqhqfyhncdnx                       │
   │   schema public      ← legado financeiro (INTOCADO)   │
   │   schema plataforma  ← novo: o que era do ClickUp     │
   └──────────────▲────────────────────────▲──────────────┘
                  │ service role            │
          ┌───────┴────────────────────────┴──────────────┐
          │  financeiro-tria/automation  (VPS, PM2, :4100) │
          │  pipeline, regras, IA, RAG  →  INTACTOS         │
          │  adapters/clickup.ts  →  adapters/plataforma.ts │
          └───────────────┬────────────────────────────────┘
                          └── Omie · Gemini · OpenAI · Evolution · cnpj.ws
```

**Dois backends, dois schemas, um banco.** Cada um dono do seu:

| | `apps/api` | `automation/` |
|---|---|---|
| Schema | `plataforma` (novo) | `public` (legado, intocado) |
| Dono de | Tarefa, Status, Campo, Comentário, Tag, Membro, Concessão, Registro de Atividade — a ontologia | Solicitações, RAG, espelhos do Omie, emissão de NF |
| Repositório | `crm-n1` | `financeiro-tria` (fica onde está; mover depois é decisão adiada) |
| Deploy | a definir na Fase 1 | VPS + PM2 atuais, sem tocar |

### 2.1 Como os dois se encontram

O novo `adapters/plataforma.ts` implementa **os mesmos 7 métodos** do `clickup.ts`, chamando `apps/api` por HTTP — **não** escrevendo no schema `plataforma` por SQL direto.

O motivo é a razão de existir da ontologia: publicar um Comentário gera Registro de Atividade; mudar Status verifica Requisito de saída e permissão. SQL direto pularia as duas coisas e corromperia as invariantes que `docs/07-processos/contas-a-pagar.md` especifica (RN-CP-02, RN-CP-04, INV-CP-01). Um `POST /operacoes/addTaskComment` respeita tudo isso de graça.

### 2.2 O mapper encolhe em vez de crescer

`clickup-payment-mapper.ts` tem ~400 linhas para lidar com as esquisitices do ClickUp: procurar dropdown por `type_config.options`, extrair `url_w_query` de anexo, achar campos embutidos no texto da descrição com 30 rótulos conhecidos. Contra uma Tarefa tipada da plataforma isso vira cerca de 50 linhas de leitura de `fieldValues`. **A troca apaga código, não acrescenta.**

### 2.3 A identidade da solicitação

`solicitacoes_pagamentos.TaskID` guarda hoje o id da Tarefa no ClickUp. Passa a guardar o id da Tarefa na plataforma — a coluna mantém o significado ("o id no sistema que é dono da tarefa"), só aponta para outro lugar. As linhas históricas continuam com ids do ClickUp; acrescentar `origem` (`clickup` | `plataforma`) resolve a ambiguidade sem migrar nada.

### 2.4 Nem toda tela precisa da ontologia

Você escolheu a ontologia como modelo, e ela vale para **o que substitui o ClickUp**: Solicitações, Contas a pagar, Contas a receber — onde Lista, Status, Campo, Comentário, Tag e permissão por papel são justamente o que o ClickUp entrega.

As demais telas do financeiro-tria **nunca viveram no ClickUp**: Notas fiscais, Produtos, Plano de contas, Extratos, Workflows. São ferramentas que leem a API do `automation/` direto. Forçá-las na ontologia seria traduzir por traduzir. Elas são portadas como tela — mesma leitura, visual do CRM N1.

Se essa divisão não for a que você quer, é o ponto a corrigir antes da Fase 2.

---

## 3. Fases

Estimativas para uma pessoa focada.

### Fase 0 — Preparação · 1 semana

| Entregável | Por quê |
|---|---|
| Schema `plataforma` criado no Supabase, vazio | Onde o novo vai morar, sem tocar nas 26 tabelas do `public` |
| Exportação completa das Listas ClickUp `901109104938` (Solicitação), `901107637383` (Contas a pagar), `901107648977` (Contas a receber) | Tarefas, Campos, Comentários, **histórico de status**, anexos, com paginação. É o insumo da importação e a prova de paridade depois |
| `docs/07-processos/solicitacao-de-pagamento.md` | **A lacuna mais séria do levantamento.** Contas a pagar e a receber têm spec lida da Lista real; a Solicitação não tem. Reconstruí o processo pelo código, que mostra o que está automatizado, não o que as pessoas fazem |
| De-para: 6 IDs de usuário do ClickUp → Membros | Elifas `81591229`, Fabíola `81581798`, Thiago `81581826`, Iallas `81582295`, Financeiro `81581816`, revisor FO `81581802` |
| ~~Rotação das credenciais Omie do Marcos Paulo~~ | **Retirada em 2026-09-16 por decisão do dono (D-13, risco aceito): as credenciais atuais continuam em uso.** Estão no histórico do git (`tenants/marcos-paulo/config.ts`) e por linha nas tabelas do legado; CON-10 vale para o que a plataforma cria. |
| ~~Contagem de linhas das tabelas legadas~~ | **Feito.** Ver [inventário §5.7](01-inventario-financeiro-tria.md#57-volume-real). De quebra: a observabilidade (`automation_runs` e companhia) tem 9 linhas para 1.110 solicitações — pode ser descartada em vez de migrada, e `planos_de_contas` está vazia |

### Fase 1 — O CRM N1 ganha persistência e login · 3–4 semanas

Inevitável: um front que substitui o ClickUp precisa guardar Tarefa, e hoje o CRM N1 é **memória pura** (`buildProductSeed()` a cada carregamento).

| Entregável | Detalhe |
|---|---|
| Tabelas do schema `plataforma` | Uma por entidade que o Financeiro toca: Espaço de Trabalho, Membro, Papel, Espaço, Pasta, Lista, Tipo de Tarefa, Conjunto/Definição de Status, Definição/Valor de Campo, Tag, Tarefa, Comentário, Vínculo, Concessão, Registro de Atividade. Colunas tipadas para o que se filtra, `jsonb` para objetos de valor |
| Repositórios + Unidade de Trabalho | Carrega o `DataState` do Espaço de Trabalho, roda a operação **pura** do domínio como hoje, grava o diff com `revision` otimista. Preserva `packages/dominio` inteiro e os 214 testes |
| Supabase Auth | `/entrar` deixa de escolher Membro e passa a autenticar; Membro resolvido pelo Espaço de Trabalho |
| `apps/api` servindo o domínio | Uma rota por operação (16 módulos em `packages/dominio/src/operations`); `store.ts` troca `run(op)` local por `POST /operacoes/:nome` |
| Bootstrap | `seed-financeiro.ts` vira script de criação do Espaço "Gestão" › Pasta "Financeiro" › Listas, Campos, Status, Tags, Papéis — sem as Tarefas fictícias |

**Pronto quando:** um Membro real cria uma Conta pela tela, ela está no Postgres, e `npm run check` segue verde nos três workspaces com os mesmos 214 testes rodando também contra o banco.

**ClickUp e `automation/`:** intocados.

### Fase 2 — Solicitação de pagamento: o front substitui o ClickUp · 3–4 semanas

O coração. Aqui o `automation/` deixa de falar com o ClickUp.

| Entregável | Onde |
|---|---|
| Lista "Solicitações de pagamento" na ontologia | Status `recebida → em validação → aguardando aprovação → aprovada / não aprovada / em revisão → convertida`; Campos que o mapper já lê |
| **Formulário** de solicitação | Substitui o formulário de Tarefa do ClickUp — é por onde o pedido entra |
| **Tela de aprovação** | Substitui responder no thread do comentário. A decisão vira Solicitação de Aprovação (B80): um clique, não um texto classificado por IA |
| **Timeline da solicitação** | Comentários + Registros de Atividade — substitui a aba de comentários do ClickUp |
| `adapters/plataforma.ts` no `automation/` | Os 7 métodos, agora contra `apps/api`. `clickup.ts` fica no repositório, desligado por env |
| `plataforma-payment-mapper.ts` | Substitui os ~400 l. de parsing por ~50 l. de leitura tipada |
| Endpoint de entrada | O pipeline hoje começa no webhook `task-created`. Passa a começar num `POST /webhooks/plataforma/solicitacao-criada` que o `apps/api` dispara quando a Tarefa nasce |
| Classificador de comentário como fallback | Quem responder por comentário em vez de clicar continua atendido, por 90 dias |
| Importação de `solicitacoes_pagamentos` | Histórico vira Tarefas fechadas; `comentario` vira o Comentário do RESUMO; **credenciais descartadas** |

**Pronto quando:** por duas semanas, toda solicitação nova nasce no CRM N1, percorre o pipeline sem webhook do ClickUp, e o Omie recebe o mesmo `IncluirContaPagar` — conferido por `ConsultarContaPagar` nos dois caminhos.

**ClickUp:** webhooks Tria desligados; Lista de Solicitação arquivada.

### Fase 3 — Contas a pagar · 2 semanas

A parte mais barata, porque a tela **já existe**: `contas-view.tsx` (1.038 l.), `conta-drawer.tsx`, `serie-dialog.tsx`, `operations/financeiro.ts` (469 l.) e o seed com o processo inteiro.

| Entregável | Detalhe |
|---|---|
| Importação da Lista `901107637383` | Com `date_created`, `date_closed` e histórico de status — "tempo em `para pagar`" é métrica do Financeiro |
| Automações A1–A9 no motor | Recorrência ao pagar com dia útil anterior (A1), troca de Responsável (A3/A4), cobrança de nota D-5/D-2 (A5/A6), invocação do Agente D-1 (A7/A8), Observadores (A9) |
| Agente de lançamento ligado ao Omie real | `runLancamentoAgent` hoje simula. A ferramenta passa a chamar o `automation/`, que já sabe lançar |
| De-para de categorias real | `CATEGORIA_OMIE` tem códigos **inventados** para o protótipo. Substituir pelo plano real (`ListarCategorias`) ou pelo RAG que o `automation/` já usa |
| Pagamento em lote | Seleção múltipla + mudança de Status — 61 Tarefas foram fechadas no mesmo segundo no histórico |

**Pronto quando:** o Financeiro opera uma semana sem abrir o ClickUp. **ClickUp:** Lista arquivada.

### Fase 4 — As outras telas do financeiro-tria · 2–3 semanas

Portadas como tela, lendo a API do `automation/` direto (§2.4): Notas fiscais (`transacoes`), Produtos, Plano de contas (CRUD + import), Extratos do Marcos, Workflows, Dashboard, Problemas, Aprovações pendentes. Nenhuma regra muda — é releitura visual no sistema de design do CRM N1.

**Pronto quando:** `financeiro-tria.vercel.app` pode sair do ar.

### Fase 5 — Contas a receber e os outros tenants · 2–3 semanas

Depende de **D7**: onde o recebimento é controlado hoje? A Lista está dormente desde out/2025. Se migrou para o Omie, a Lista da plataforma vira espelho de leitura; se não, `createReceivableSeries` já existe e R2–R7 viram Automações.

Marcos Paulo e Family Office: as Empresas viram opções do Campo `Empresa`, e as regras de cada `config.ts` viram configuração por Empresa — sem clonar serviço.

---

## 4. Complexidade

| Peça | Reuso | Tamanho | Risco |
|---|---|---|---|
| Persistência + Unidade de Trabalho | domínio pronto | **G** | médio — cache e concorrência por Espaço de Trabalho |
| Autenticação | — | M | baixo |
| `apps/api` servindo as operações | operações prontas | M | baixo — mecânico, 16 módulos |
| Motor de Automações (evento + agenda) | conceito da ontologia | **G** | alto — infraestrutura genérica; o Financeiro é o primeiro cliente |
| Formulário + aprovação + timeline | — | M | médio — é o que substitui o ClickUp de fato |
| `adapters/plataforma.ts` | interface pronta (7 métodos) | **P** | baixo |
| `plataforma-payment-mapper.ts` | apaga código | **P** | baixo |
| Importação ClickUp → Tarefas | exportação da Fase 0 | M | médio — histórico e anexos |
| Contas a pagar | tela e operações prontas | P–M | baixo |
| Telas financeiras portadas | leitura pronta | M | baixo |
| Pipeline, regras, IA, RAG, Omie | **100%** | — | — |

**Total: 11–14 semanas**, contra 16–21 da v1. A diferença inteira é não reescrever o pipeline.

Os dois **G** continuam sendo persistência e o motor de Automações — não são custo do Financeiro, são o custo de o CRM N1 deixar de ser protótipo. Pagos uma vez, servem CRM, Estrutura e todo o resto.

---

## 5. Riscos

| Risco | Tratamento |
|---|---|
| **A Solicitação não tem especificação** | Fase 0 escreve, lendo a Lista real. Sem isso a Fase 2 vai descobrir regra por regra, em produção |
| Dois sistemas escrevendo no Omie na transição | `codigo_lancamento_integracao` determinístico e igual nos dois caminhos; `ConsultarContaPagar` antes de incluir — já existe |
| `apps/api` fora do ar derruba o pipeline | O adapter degradava sem token; o novo degrada sem API — enfileira e repete, em vez de falhar o run |
| Perder o "tempo em status" na importação | Importar o histórico como Registros de Atividade com a data original |
| De-para de categorias fictício na plataforma | Fase 3 usa o plano real; RAG com validação contra ele, e `REVISAR` abaixo do threshold |
| ~~Volume desconhecido~~ | **Fechado em 2026-09-15.** Medido: maior tabela 9.510 linhas (`omie_clientes`), solicitações 1.110, vendas 1.987. Nada pressiona importação nem hidratação — ver [inventário §5.7](01-inventario-financeiro-tria.md#57-volume-real) |
| Credenciais Omie no histórico do git e por linha em duas tabelas | Rotacionar na Fase 0; nas telas novas, credencial só na Integração |
| A Pessoa da conta vê chave Pix de todos hoje | Fase 3 aplica a permissão de `contas-a-pagar.md §10` |
| Tipos divergindo entre os dois repositórios | Você adiou a unificação; um pacote de tipos compartilhado ou revisão a cada mudança de contrato evita a deriva |

---

## 6. O que não muda (e é o ponto)

Continuam **exatamente como estão**: o pipeline de 7 etapas nos 3 tenants · `payment-rules.ts` (prazo 5/15/25, CPF/CNPJ, roteamento por centro e valor, parsers de Pix e boleto) · `omie.ts` e as 6 contas · `ai.ts` (Gemini, OpenAI, embeddings) e os prompts · o RAG e as tabelas `conciliador_*` · emissão de NF com ingestão Guru/Kiwify/TMB, 7 dias e cron · extratos e WhatsApp · plano de contas e a Edge Function · o schema `public` inteiro · `automation/.env` · o deploy PM2 na VPS.

**Muda um arquivo** (`adapters/clickup.ts` → `adapters/plataforma.ts`), **encolhe outro** (o mapper) e **nasce um endpoint** de entrada.

---

## 7. Decisões ainda abertas

| # | Decisão | Recomendação |
|---|---|---|
| D6 | Solicitação: Lista própria com Vínculo à Conta, ou Status iniciais na própria Lista de Contas | Lista própria — tem aprovador e prazo próprios, e nem toda Conta nasce de Solicitação (as recorrentes não) |
| D7 | Onde o recebimento é controlado hoje | Perguntar ao Financeiro — aberto desde `contas-a-receber.md §12` |
| D8 | Aprovação: só por clique ou manter o classificador de comentário | As duas; classificador como fallback por 90 dias, depois medir |
| D9 | Status `aprovado` da Lista de Contas (configurado, nunca usado) | Remover ao criar a Lista de Solicitações — o nome passa a ser dela |
| D10 | Emissão manual de NF: ação na Tarefa ou manter Google Sheets | Ação na Tarefa |
| D11 | Onde `apps/api` roda | A mesma VPS, ao lado do `automation/`, na nginx que já existe |
| D12 | Quando mover o `automation/` para o monorepo | Adiado por decisão sua. Reavaliar ao fim da Fase 2, quando o contrato entre os dois estiver estável |

---

## 8. Como saber que deu certo

- **Fase 2:** um solicitante cria o pedido no CRM N1 e o aprovador decide sem abrir o ClickUp; o Omie não percebe a troca.
- **Fase 3:** o Financeiro passa uma semana sem abrir o ClickUp.
- **Fase 4:** o painel do financeiro-tria sai do ar e ninguém sente falta.
- **Sempre:** `npm run check` verde; os testes do domínio são os mesmos antes e depois do banco; o `automation/` roda com o mesmo `git log` da Fase 0, fora o adapter.
