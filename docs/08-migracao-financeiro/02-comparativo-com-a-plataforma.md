# Comparativo — o que a plataforma já tem, o que bate, o que falta

Lado a lado entre o financeiro-tria ([inventário](01-inventario-financeiro-tria.md)) e o que existe hoje em `crm-n1`. "Bate" quer dizer que os dois sistemas concordam sobre o mesmo fato do processo real; "não bate" é divergência a resolver; "falta" é o que só um dos lados tem.

---

## 1. O que a plataforma já tem de Financeiro

| Peça | Onde | Tamanho | O que contém |
|---|---|---|---|
| Especificação do processo Contas a pagar | `docs/07-processos/contas-a-pagar.md` | 302 l. | Lida da Lista real `901107637383` em 2026-09-13: 8 Status, 24 Campos, 8 Tags, 4 papéis, fluxo D-30 → D+1, recorrência, Automações A1–A9, Agente de lançamento, permissões, RN-CP-01…07, INV-CP-01, 7 pendências |
| Especificação do processo Contas a receber | `docs/07-processos/contas-a-receber.md` | 254 l. | Lida da Lista real `901107648977` em 2026-09-14 (240 Tarefas): 6 Status, Vínculo com cliente, séries entrada + N parcelas, cobrança e escalonamento, R1–R7, RN-CR-01…07, INV-CR-01/02 |
| Constantes e código do processo | `packages/dominio/src/operations/financeiro.ts` | 469 l. | `CP` e `CR` (ids de Lista, Campos, Status), `CONTA_POR_TAG`, `CATEGORIA_OMIE`, `erpMissingFields`, `buildResumoDePagamento`, `runLancamentoAgent` (Execução de Agente completa, Omie **simulado**), `contaSemResumo`, `createReceivableSeries`, `parcelaDuplicada` |
| Configuração do processo como dados da ontologia | `seed-financeiro.ts`, `seed-contas-a-receber.ts` | 677 + 359 l. | Espaço "Gestão" › Pasta "Financeiro" › Listas; Tipo "Conta"; Conjuntos de Status com requisitos de saída/entrada; Definições de Campo (herdadas do Espaço, da Pasta, da Lista); Tags; Membros e Papéis; Agente + Coleção de Conhecimento; Automações; Regra de Recorrência; Tarefas fictícias reproduzindo os casos reais |
| Testes | `contas-a-receber.test.ts` + trechos de `operations.test.ts` | 161 l. | Série de parcelas, RN-CR-07, desfazer meia série |
| Tela | `apps/web/src/features/estrutura/financeiro/` | 1.038 + 350 + 170 l. | `contas-view.tsx` (lente financeira sobre a Lista: indicadores, grupos a pagar/vencidas/aguardando/programadas/pagas, ações em lote), `conta-drawer.tsx`, `serie-dialog.tsx` |
| Entidades da ontologia que o Financeiro usa | `packages/dominio/src/types/` | — | `Integration` (do Espaço de Trabalho, com `exposedTools`), `Automation` (gatilhos por evento e agenda; ações `invocarAgente`, `solicitarAprovacao`, `aguardar`, `notificar`), `RecurrenceRule` (com `businessDays: "anterior"`), `AgentExecution` (passos, custo, cadeia), `Grant`, `ActivityRecord`, `Link` |

Tudo isso roda **em memória**: sem banco, sem autenticação, sem chamada externa. É o que o PRD pediu e é o que a separação `apps/api` existe para resolver.

---

## 2. A descoberta estrutural: dois processos, não um

```text
   financeiro-tria automatiza ──────────────┐
                                            ▼
  ┌─────────────────────────────┐   aprovada   ┌─────────────────────────────┐
  │ SOLICITAÇÃO DE PAGAMENTO    │ ───────────► │ CONTA A PAGAR               │
  │ Lista 901109104938          │              │ Lista 901107637383          │
  │ pedido → prazo → documento  │              │ cobrar NF → lançar → remessa│
  │ → aprovador → IA → RAG      │              │ → autorização → pago        │
  │ → RESUMO → Omie             │              │ → recorrência mensal        │
  └─────────────────────────────┘              └─────────────────────────────┘
                                                             ▲
                     a plataforma modela ────────────────────┘
```

- **A plataforma não tem a Solicitação.** `contas-a-pagar.md §6.1` diz que "contas novas são criadas pelo Financeiro à mão" — o intake com validação, roteamento e aprovação acontece antes, noutra Lista, e não foi lido.
- **O financeiro-tria não tem a Conta depois do lançamento.** Depois de `lançado omie` o serviço termina o run. Remessa, autorização, pagamento em lote (61 Tarefas fechadas no mesmo segundo) e a recorrência são feitos por pessoas no ClickUp.
- **Os dois se encontram no RESUMO DE PAGAMENTO e no lançamento no Omie.** É por isso que o cabeçalho `📋 RESUMO DE PAGAMENTO` aparece idêntico em `buildResumoDePagamento` e em `payment-automation-service.ts`: a plataforma leu o resultado do que o financeiro-tria produz.

Consequência para o plano: a migração não é "trocar o backend do financeiro-tria". É **unir dois processos** que hoje vivem em Listas diferentes do ClickUp, sendo que a plataforma já tem um e o `automation/` já tem a lógica do outro.

---

## 3. Matriz: bate / não bate / falta

### 3.1 Status

| Status no ClickUp | financeiro-tria | Plataforma (`CP.status`) | Situação |
|---|---|---|---|
| `para pagar` | `CLICKUP_STATUS_PARA_PAGAR` (só referência) | `st_cp_para_pagar`, categoria `não iniciado` | **Bate** |
| `aprovado` / `não aprovado` | escreve ao classificar a aprovação | `st_cp_aprovado` (`concluído`, "nunca observado em uso"); `negado` | **Não bate**: no financeiro-tria `aprovado` é o fim da Solicitação; na plataforma é um Status da Conta que ninguém usa. É o mesmo nome para duas coisas — o sinal mais claro de que são Listas diferentes |
| `em lançamento omie` | gatilho do Fluxo 7 | `st_cp_em_lancamento` | **Bate** |
| `lançado omie` | escreve ao terminar | `st_cp_lancado` | **Bate** |
| `em remessa bancária`, `em autorização bancária`, `pago` | não existem | existem, com requisitos de entrada | **Falta no financeiro-tria** (por desenho) |
| `em revisão` | só Family Office | — | Falta na plataforma; decidir se entra |

### 3.2 Campos

Os nomes que o mapper do financeiro-tria procura e os que a plataforma definiu vêm da **mesma Lista** e batem um a um: Centro de Custo, BU, Empresa, Categoria de pagamento, Pessoa, Fornecedor (CPF/CNPJ), CNPJ, CPF, Nome do fornecedor, Anexo, Data de Emissão, Valor, Forma de pagamento (Chave Pix / Boleto / QRCode Pix), Chave pix, Código de barras, Pix copia e cola, Boleto, QR Code, Integração manual, Nome do solicitante, WhatsApp.

| Divergência | Detalhe | Resolução proposta |
|---|---|---|
| `Data Vencimento` (campo) vs Data de vencimento nativa | O mapper lê o campo primeiro e cai para `due_date`; a plataforma decidiu **só o nativo** (§12) | Manter a decisão da plataforma; o import copia o campo para o nativo |
| `Link de pagamento` (cartão) | O mapper trata `Cartão` como forma; a plataforma tem três formas | Acrescentar `Cartão` + `Link de pagamento` — aparece no código real |
| `02-Empresas` (Family Office) | Seleciona a conta Omie | A plataforma já tem o Campo `Empresa` (C★) com 11 opções; falta a ligação Empresa → Integração |
| `Whatsapp do Solicitante` | O financeiro-tria notifica por WhatsApp | A plataforma tem o campo (Z); falta a Ação de notificar por Canal |
| Prefixo de ordem (`A-`, `01-`) | O mapper remove; a plataforma preserva como ordem de exibição | Bate na intenção |

### 3.3 Papéis e pessoas

| Papel | financeiro-tria | Plataforma | Situação |
|---|---|---|---|
| Financeiro | usuário ClickUp `81581816` ("Contas a Pagar") | `mem_maryane` | **Bate** (mesma pessoa, Maryane) |
| Aprovador/pagador da Conta | — | `mem_marcos_paulo`; `mem_walter` para Konq | Só na plataforma |
| Aprovador da Solicitação ("estrategista") | Elifas, Fabíola, Thiago, Iallas por centro de custo e valor | não existe | **Falta na plataforma** — quatro Membros e uma regra de roteamento |
| Revisores do RESUMO | `81581816`, `81581814`; FO `81581802` | Financeiro (Comentário atribuído) | Parcial |
| Agente de lançamento | OpenAI Assistant + código | `agt_lancamento` com Coleção de Conhecimento | **Bate** no papel; a plataforma simula o Omie |
| Pessoa da conta (prestador) | não modelado (o fornecedor é texto) | Campo `Pessoa` + Convidado com `ver` só as suas | Só na plataforma |

### 3.4 De-para para o ERP

| Mapa | financeiro-tria | Plataforma | Situação |
|---|---|---|---|
| Centro de custo → Conta de pagamento | `CONTA_PAGAMENTO_POR_CENTRO_CUSTO` (6 entradas) + match por nome em `ListarContasCorrentes` | `CONTA_POR_TAG` (8 tags) + fallback pelo centro | **Parcial**: a plataforma prioriza a Tag, o financeiro-tria o centro; os dois concordam nos casos observados |
| Categoria → código do plano de contas | RAG por embedding em `conciliador_contas_*`, threshold 0,3, código extraído de `metadata`/regex | `CATEGORIA_OMIE`: tabela fixa de 24 categorias com **códigos inventados** para o protótipo | **Não bate** — a plataforma admite em `§12`: "precisa ser exportada do Omie". O `automation/` já chama `ListarCategorias` e valida o código contra o plano real (commit `fd8090b`) |
| CNPJ da Empresa pagadora (cobrança da nota) | não usa | `CNPJ_POR_EMPRESA` fictício | Buscar de `omie_clientes` ou cadastrar na Empresa do CRM |
| Departamento Omie | match por centro de custo em `ListarDepartamentos` | — | Falta na plataforma |

### 3.5 Regras de negócio

| Regra | financeiro-tria | Plataforma |
|---|---|---|
| Centro de Custo obrigatório | mapper falha sem ele | RN-CP-01 — **bate** |
| Dado de pagamento coerente com a forma | `parsePaymentMethod` + Omie exige | RN-CP-02 como requisito de saída — **bate** |
| Fornecedor CPF ⇒ CPF; CNPJ ⇒ CNPJ | `detectDocumentType`, `isValidCpf`, cnpj.ws | RN-CP-03 — bate; a plataforma **não valida dígito nem consulta CNPJ** (falta) |
| Prazo: pedido ≥ N dias úteis antes do vencimento padrão (5/15/25) | `evaluateRequestDeadline` | não existe — **falta** (é regra da Solicitação) |
| Aprovação por valor (R$ 5.000) | `APPROVAL_ROUTES` | não existe — **falta** |
| Auditoria de anexo (valor declarado vs. nota) | Gemini | não existe — **falta** |
| Uma Tag `conta *` por Tarefa | `computeTaskTag` escreve uma | RN-CP-07 — bate |
| Resumo antes de `lançado omie` | implícito | INV-CP-01 — só na plataforma |
| Idempotência do lançamento | `codigo_lancamento_integracao` + `ConsultarContaPagar` | `runLancamentoAgent` não repete se já há RESUMO — bate na intenção |
| Recorrência ao pagar, dia útil anterior | não existe | `RecurrenceRule.businessDays: "anterior"` — só na plataforma |
| Pagamento em lote | não existe | seleção múltipla na Lista — só na plataforma |

### 3.6 Automação, IA e integração

| Conceito | financeiro-tria | Plataforma (ontologia) | Situação |
|---|---|---|---|
| Gatilho por evento (Tarefa criada, Comentário, Status mudou, Campo mudou) | webhook ClickUp | `AutomationTrigger.kind: evento` com `eventType` | **Bate** — cada webhook é um Gatilho |
| Gatilho por horário | `setInterval` no processo | `AutomationTrigger.schedule` | Bate |
| Aprovação humana no fluxo | thread de comentário + OpenAI classifica | `AutomationAction.controlKind: solicitarAprovacao` + Solicitação de Aprovação (B80) | **Bate melhor na plataforma** — a aprovação é entidade, não texto a classificar |
| Chamada a sistema externo | adapter direto | `Integration` do Espaço de Trabalho expõe Ferramentas de classe `externa` | Bate; a plataforma exige que a Ferramenta passe pela Integração |
| Multi-tenant / multi-empresa | 3 tenants por path + 6 empresas por credencial | 1 Espaço de Trabalho; `Empresa` é Campo; Integração é do Espaço de Trabalho | **Decisão**: uma Integração Omie **por Empresa** (6), selecionada pelo Campo `Empresa` |
| Run / step / event | `automation_runs/steps/events` | Execução de Automação com Passos; Execução de Agente com `steps` e `cost` | Bate — a ontologia já tem o equivalente com identidade e permissão |
| RAG de categorias | pgvector no Supabase | Coleção de Conhecimento + Fonte + Referência de Conhecimento | Bate no conceito; a implementação (pgvector) pode ser a mesma |
| Memória do que a IA decidiu | `ThreadID` do Assistant | Memória do Agente (Itens por Execução) | Parcial |

### 3.7 Contas a receber

| | financeiro-tria | Plataforma |
|---|---|---|
| Modelo | só o espelho `contas_a_receber` do Omie (18 colunas `text`) e 6 tabelas vetoriais de categoria de receita | Lista completa, 6 Status, série entrada + parcelas, Vínculo com Contato do CRM, situação de cobrança, R1–R7 |
| Origem dos dados | Omie | ClickUp — **dormente desde out/2025** |
| O que falta | tudo de processo | a resposta a "onde o recebimento é controlado hoje?" (§12) |

Os dois lados apontam para o mesmo lugar: se o recebimento migrou para o Omie, a Lista da plataforma vira espelho de leitura da Integração, e `contas_a_receber` do Supabase é o protótipo desse espelho.

---

## 4. O que só o financeiro-tria tem e a plataforma vai precisar

1. **Solicitação de pagamento** — o processo inteiro (§2).
2. **Emissão de notas fiscais** — `transacoes`, produtos, ingestão Guru/Kiwify/TMB, 7 dias, emissão de pedido e OS no Omie. Nada na plataforma; o mais próximo é o "Saque de plataforma" de Contas a receber.
3. **Plano de contas** com embeddings e import.
4. **Espelhos do Omie** (`omie_clientes`, `contas_pagar`, `contas_a_receber`).
5. **Extratos por WhatsApp** e relatório diário (Marcos Paulo).
6. **Validação de CPF/CNPJ** e enriquecimento por API pública.
7. **Leitura de anexos por IA** (Gemini).
8. **Multi-empresa com 6 contas Omie.**

## 5. O que só a plataforma tem e o financeiro-tria vai ganhar

1. Ciclo de vida da Conta depois do lançamento (remessa, autorização, pago, lote).
2. Recorrência mensal com ajuste de dia útil.
3. Permissões por papel — a Pessoa da conta vê só as suas Tarefas (hoje vê chave Pix de todo mundo).
4. Registro de Atividade e Execuções como entidades auditáveis com permissão.
5. Contas a receber como processo, ligado ao Contato do CRM.
6. Aprovação como entidade (Solicitação de Aprovação), não como comentário classificado por IA.
7. Tela financeira sobre a Lista (`contas-view.tsx`) sem sistema paralelo.

## 6. Sobre o Go High Level

Nenhum dos dois repositórios menciona GHL, HighLevel ou `ghl` — zero ocorrências em `src/`, `automation/`, `docs/`, `Arquivos_base/`. O que o GHL faz hoje (funis, mensageria, contatos, automações de marketing) corresponde ao **CRM** da plataforma (`ontologia/03-crm/`), não ao Financeiro. Não entra neste plano; precisa de um inventário próprio, feito a partir da conta GHL e não do código.
