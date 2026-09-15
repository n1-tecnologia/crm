# Restrições — intel sintetizada (SPECs)

Gerado por `/gsd-ingest-docs` (sintetizador) em 2026-09-15. Fontes: os três SPECs do manifesto. Tipos: `api-contract` | `schema` | `nfr` | `protocol`.
Onde um ADR sobrepõe uma restrição, a entrada diz e aponta para `decisions.md`. Os itens de §12 dos dois processos **não** estão aqui: são questões abertas (`context.md`).

---

## A. `docs/08-migracao-financeiro/03-plano-de-migracao.md` (SPEC, precedence 1)

### CON-01 — Contrato do adapter: 7 métodos, sobre HTTP, contra `apps/api`
- tipo: api-contract · escopo: `financeiro-tria/automation/adapters/plataforma.ts` ↔ `apps/api`
- O `adapters/plataforma.ts` implementa **os mesmos 7 métodos** de `clickup.ts`, e é a única costura entre os dois sistemas (o serviço de 1.928 linhas nunca chama a API do ClickUp diretamente):

  | Método | Usos no serviço Tria | Papel |
  |---|---|---|
  | `getTask` | 6 | o formulário — o que a pessoa preencheu |
  | `createComment` | 9 | a conversa — menção ao aprovador, RESUMO, erro com ação recomendada |
  | `getCommentReplies` | 2 | a decisão do aprovador voltando |
  | `updateTaskStatus` | 5 | o progresso visível |
  | `updateTaskDueDate`, `addTaskTag` | 2 | escrita de volta do que foi derivado |
  | `listPaymentRequestTasks` | 1 | sincronização em lote |

- Todo método já degrada sozinho quando não há token (`if (!this.token) return …`); o novo adapter deve degradar sem API do mesmo jeito (ver CON-06).
- `clickup.ts` fica no repositório, desligado por variável de ambiente.
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §1, §2.1, Fase 2; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §6 (linha ClickUp), §10 Muda

### CON-02 — `POST /operacoes/:nome`: uma rota HTTP por operação do domínio; `store.ts` troca `run(op)` local por `POST`
- tipo: api-contract · escopo: `apps/api` (transporte) + `apps/web/src/dados/store.ts`
- "Uma rota por operação (16 módulos em `packages/dominio/src/operations`); `store.ts` troca `run(op)` local por `POST /operacoes/:nome`." O ADR repete: "Uma rota por operação do domínio (16 módulos), com `store.ts` trocando `run()` local por `POST`."
- Verificado no código (2026-09-15): `packages/dominio/src/operations/` tem 16 módulos (`activity, agent-builder, ai, automations, chat-folders, collaboration, configuration, contacts, conversations, deals, financeiro, members, planning, scale, structure, tasks`); `apps/api/src/rotas/` "nasce vazia"; `apps/api/src/index.ts` exporta `{}`; `store.ts` ainda faz `data: buildProductSeed()` e roda a operação localmente. **Pendente.**
- Regra do backend (`apps/api/src/index.ts`): "nada aqui reimplementa regra de negócio. As regras moram em `@n1/dominio` ... O backend acrescenta o que o domínio não tem — persistência, autenticação, transporte — e nada além."
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 1; `docs/08-migracao-financeiro/04-spike-persistencia.md` §O que vem agora na Fase 1

### CON-03 — `POST /webhooks/plataforma/solicitacao-criada`: o `apps/api` dispara quando a Tarefa de Solicitação nasce
- tipo: api-contract · escopo: entrada do pipeline do `automation/`
- "O pipeline hoje começa no webhook `task-created`. Passa a começar num `POST /webhooks/plataforma/solicitacao-criada` que o `apps/api` dispara quando a Tarefa nasce."
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §10 Muda

### CON-04 — Conjunto de Status da Lista "Solicitações de pagamento"
- tipo: protocol · escopo: Fase 2
- `recebida → em validação → aguardando aprovação → aprovada / não aprovada / em revisão → convertida`; Campos = os que o mapper já lê (ver CON-CP-03 e `01-inventario` §4.3).
- A decisão do aprovador vira Solicitação de Aprovação (B80): "um clique, não um texto classificado por IA". Classificador de comentário como fallback por 90 dias (D8, recomendação).
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2, §7 D8

### CON-05 — Portões permanentes de verificação
- tipo: nfr · escopo: todo o programa
- "**Sempre:** `npm run check` verde; os testes do domínio são os mesmos antes e depois do banco; o `automation/` roda com o mesmo `git log` da Fase 0, fora o adapter."
- Refinado por DEC-09 (ADR): os testes de persistência pulam sem `DATABASE_URL`; a prova de equivalência hidratado ≡ seed substitui "rodar os 214 contra o banco".
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §8; `docs/08-migracao-financeiro/04-spike-persistencia.md` §Como foi provado

### CON-06 — `apps/api` fora do ar não pode derrubar o pipeline: o adapter enfileira e repete
- tipo: nfr · escopo: `adapters/plataforma.ts`
- "O adapter degradava sem token; o novo degrada sem API — enfileira e repete, em vez de falhar o run."
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §5

### CON-07 — Idempotência do lançamento no Omie durante a transição
- tipo: protocol · escopo: Fase 2/3, dois sistemas escrevendo no Omie
- "`codigo_lancamento_integracao` determinístico e igual nos dois caminhos; `ConsultarContaPagar` antes de incluir — já existe."
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §5; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §3 etapa 7

### CON-08 — `solicitacoes_pagamentos.TaskID` aponta para a Tarefa da plataforma; nova coluna `origem`
- tipo: schema · escopo: schema `public` do financeiro (a única alteração admitida nele)
- Ver DEC-17. Importação de `solicitacoes_pagamentos`: "Histórico vira Tarefas fechadas; `comentario` vira o Comentário do RESUMO; **credenciais descartadas**."
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §2.3, Fase 2

### CON-09 — A importação do ClickUp preserva `date_created`, `date_closed` e o histórico de status como Registros de Atividade com a data original
- tipo: nfr · escopo: Fase 0 (exportação) e Fase 3 (importação)
- "Perder o 'tempo em status' na importação → Importar o histórico como Registros de Atividade com a data original." Exportação com "Tarefas, Campos, Comentários, **histórico de status**, anexos, com paginação. É o insumo da importação e a prova de paridade depois."
- Listas: `901109104938` (Solicitação), `901107637383` (Contas a pagar), `901107648977` (Contas a receber).
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 0, Fase 3, §5

### CON-10 — Credenciais Omie só na Integração; nunca por linha; rotacionar as do Marcos Paulo
- tipo: nfr · escopo: segurança
- "Rotacionar na Fase 0; nas telas novas, credencial só na Integração." As de `tenants/marcos-paulo/config.ts` "estão no histórico do git". `solicitacoes_pagamentos` e `transacoes` gravam `app_key`/`app_secret` por linha — não copiar essas colunas.
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 0, §5; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §9

### CON-11 — De-para de 6 IDs de usuário do ClickUp → Membros
- tipo: schema · escopo: Fase 0
- Elifas `81591229`, Fabíola `81581798`, Thiago `81581826`, Iallas `81582295`, Financeiro `81581816`, revisor FO `81581802`. (O inventário lista 38 variáveis `CLICKUP_*`; o Agente atual é o usuário "ADM Tria Company" `87328595`.)
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 0; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §4.1, §9

### CON-12 — Critérios de pronto por fase
- tipo: protocol · escopo: roadmap
- Fase 1: "um Membro real cria uma Conta pela tela, ela está no Postgres, e `npm run check` segue verde nos três workspaces com os mesmos 214 testes rodando também contra o banco" (parte final refinada por DEC-09). ClickUp e `automation/`: intocados.
- Fase 2: "por duas semanas, toda solicitação nova nasce no CRM N1, percorre o pipeline sem webhook do ClickUp, e o Omie recebe o mesmo `IncluirContaPagar` — conferido por `ConsultarContaPagar` nos dois caminhos." Webhooks Tria desligados; Lista de Solicitação arquivada.
- Fase 3: "o Financeiro opera uma semana sem abrir o ClickUp." Lista arquivada.
- Fase 4: "`financeiro-tria.vercel.app` pode sair do ar."
- Fase 5: depende de D7.
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §3, §8

### CON-13 — Tipos compartilhados entre os dois repositórios não podem derivar
- tipo: nfr · escopo: contrato `apps/api` ↔ `automation/`
- "Tipos divergindo entre os dois repositórios → Você adiou a unificação; um pacote de tipos compartilhado ou revisão a cada mudança de contrato evita a deriva."
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §5

### CON-14 — Estimativas e riscos por peça (para o roadmapper dimensionar)
- tipo: nfr · escopo: planejamento
- Total 11–14 semanas de uma pessoa. Fase 0: 1 sem; Fase 1: 3–4; Fase 2: 3–4; Fase 3: 2; Fase 4: 2–3; Fase 5: 2–3.
- Peças **G**: Persistência + Unidade de Trabalho (risco médio — cache e concorrência por Espaço de Trabalho; **já entregue**, ver DEC-01..07) e Motor de Automações (evento + agenda; risco **alto** — "infraestrutura genérica; o Financeiro é o primeiro cliente"). Peças M: Autenticação (baixo; **entregue**), `apps/api` servindo operações (baixo, mecânico), Formulário + aprovação + timeline (médio), Importação ClickUp (médio), Telas portadas (baixo). Peças P: adapter, mapper, Contas a pagar (P–M).
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §3, §4

### CON-15 — Tabelas do schema `plataforma` (SOBREPOSTA pelo ADR)
- tipo: schema · escopo: Fase 1
- O SPEC pedia "Uma [tabela] por entidade que o Financeiro toca ... Colunas tipadas para o que se filtra, `jsonb` para objetos de valor". **Vale DEC-02**: tabela genérica `plataforma.registros` + colunas geradas para o que se filtra (Tarefa primeiro — o que a tela de Contas a pagar filtra). Registrado em `INGEST-CONFLICTS.md` INFO-02.
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 1; `docs/08-migracao-financeiro/04-spike-persistencia.md` §O que ficou de pé

---

## B. `docs/07-processos/contas-a-pagar.md` (SPEC, precedence 2)

Lido da Lista real do ClickUp (`9011731314` / `901107637383`) em 2026-09-13: 200 Tarefas, histórico de 8. Já **implementado em memória** no protótipo (`seed-financeiro.ts` 677 l., `operations/financeiro.ts` 469 l., `contas-view.tsx` 1.038 l.) — ver `02-comparativo` §1. As restrições abaixo valem para a versão persistida.

### CON-CP-01 — Estrutura e funcionalidades da Lista
- tipo: schema
- Espaço "Gestão" › Pasta "Financeiro" › Lista "Contas a pagar" (única Lista do processo) › Tarefas do Tipo **`Conta`** (ClickUp `custom_item_id: 1012`). O Tipo existe "para a plataforma apresentar a Tarefa como conta (valor e vencimento em destaque) e para a IA saber que 'Tarefa' aqui significa 'obrigação financeira'".
- Não habilitar Subtarefas, Checklists nem Dependências (contagens zero em todas as Tarefas lidas).
- Observadores padrão: Financeiro, Aprovador, a Pessoa da conta e o Agente.
- source: `docs/07-processos/contas-a-pagar.md` §2

### CON-CP-02 — Conjunto de Status (8, nesta ordem) e transições permitidas
- tipo: schema + protocol
- `para pagar` (não iniciado, inicial) → `em lançamento omie` (em andamento) → `lançado omie` (em andamento) → `em remessa bancária` (em andamento) → `em autorização bancária` (em andamento) → `aprovado` (concluído — nunca observado em uso, ver OQ-CP-01) / `negado` (concluído) / `pago` (**fechado**, único terminal; dispara recorrência).
- Transições observadas: caminho completo; `em autorização bancária → negado → lançado omie`; pulo do ERP `para pagar → em autorização bancária → pago` (contas pequenas/urgentes); entrada direta em `lançado omie` (recorrente já lançada).
- "**Não** modelar `negado` como terminal: a plataforma deve permitir voltar de `negado` para `lançado omie` (ou `para pagar`) sem apagar o histórico."
- source: `docs/07-processos/contas-a-pagar.md` §3

### CON-CP-03 — 24 Definições de Campo Personalizado (prefixo de letra = ordem de exibição, não rótulo; ★ = herdado do Espaço "Gestão")
- tipo: schema
- Classificação: A★ Centro de Custo (seleção única, **único obrigatório**; 16 opções: Marcos Paulo, Renato Cariani, Igor Alves, Kaka Diniz, PLX Apoio, TRIA, Anthony Miranda, Tria Tech, IVL, Roberth Resende, Presidência, USI, Konq, Auton Health, Kops, Inevitaveis) · B★ BU (seleção única, 13 opções) · C★ Empresa (seleção única, 11 opções: Tria Company, Oliveira Participações, EXO Loteamento, EXO Participações, Loovi, PLX digital, IVL, USI, Konq Intermediações, O2, Inevitaveis) · D Categoria de pagamento (seleção única, 24 opções) · Y★ Produto (seleção múltipla, 63 opções; **não usado** nesta Lista).
- Fornecedor: E Pessoa (pessoa — Membro ou Convidado, único) · F Fornecedor (CPF | CNPJ) · G CNPJ (texto) · H CPF (texto) · I Nome do fornecedor (texto) · X Nome do solicitante (texto) · Z WhatsApp (telefone).
- Documento e datas: J Anexo (arquivo — a NFS-e) · K Data de Emissão (data) · L Data Vencimento (data — duplica a nativa, ver OQ-CP-02) · T Valor (moeda BRL, 2 casas).
- Pagamento: M Forma de pagamento (Chave Pix | Boleto | QRCode Pix — determina qual campo abaixo é exigido) · N Chave pix (texto) · O Código de barras (texto) · P Pix copia e cola (texto) · R Boleto (arquivo) · S QR Code (arquivo).
- Controle: U★ Integração manual (seleção única: Manual — "marcado quando o lançamento no ERP **não** deve ser feito pelo Agente") · W★ Equipe (moeda USD; vazio — não replicar, ver OQ-CP-03).
- Atributos nativos em uso: Nome, Descrição, Data de vencimento, Prioridade (só `normal` ou vazia), Responsável (um), Observadores, Tags.
- source: `docs/07-processos/contas-a-pagar.md` §4

### CON-CP-04 — Tags `conta <origem>` (8), do Espaço de Trabalho, restritas a Tarefas
- tipo: schema
- `conta tria` · `conta konq` · `conta kops` · `conta roberth` · `conta auton` · `conta tf tria` · `conta arkline` · `conta inevitaveis`. Uma por Tarefa; indica de qual conta bancária/empresa sai o dinheiro; é o eixo principal de filtro do Financeiro.
- source: `docs/07-processos/contas-a-pagar.md` §5

### CON-CP-05 — Recorrência: cópia ao entrar em `pago`, com dia útil anterior
- tipo: protocol
- "quando uma conta vai para `pago`, uma cópia para o mês seguinte é criada imediatamente" (evidência: 4 segundos entre fechamento e criação). A cópia mantém Nome, Descrição, Tag, Prioridade, Campos de classificação/fornecedor/pagamento e Valor; **não** copia Anexo nem Data de Emissão; vencimento = mesmo dia do mês seguinte ajustado para o **dia útil anterior**; Responsável volta ao Financeiro; status `para pagar`.
- Na ontologia: Regra de Recorrência da Tarefa (B6) com gatilho "ao entrar em status `fechado`". Contas avulsas não têm Regra.
- source: `docs/07-processos/contas-a-pagar.md` §7

### CON-CP-06 — Automações A1–A9 (escopo: Lista "Contas a pagar")
- tipo: protocol
- A1 entra em `pago` ∧ tem Regra de Recorrência → criar nova ocorrência (§7).
- A2 entra em `pago` → gravar data de fechamento; remover o Financeiro de Responsável.
- A3 entra em `em autorização bancária` → Responsável: Financeiro → Aprovador.
- A4 sai de `em autorização bancária` para `negado` → notificar Financeiro; Responsável volta ao Financeiro.
- A5 vencimento − 5 dias ∧ `para pagar` ∧ Anexo vazio ∧ Pessoa preenchida → Comentar com Menção à Pessoa pedindo a nota (texto de §6.2, com o CNPJ da Empresa).
- A6 vencimento − 2 dias ∧ `para pagar` ∧ Anexo vazio → repetir cobrança.
- A7 vencimento − 1 dia (noite) ∧ `para pagar` ∧ Integração manual vazio ∧ Valor preenchido → invocar o Agente de lançamento.
- A8 Agente concluiu com sucesso → mover para `lançado omie`.
- A9 Tarefa criada → adicionar Observadores: Financeiro, Aprovador, Pessoa (se preenchida).
- "A5 e A6 são hoje feitas à mão pelo Financeiro. Automatizá-las é a única mudança de comportamento proposta neste documento."
- source: `docs/07-processos/contas-a-pagar.md` §8

### CON-CP-07 — Agente de lançamento (substitui o usuário "ADM Tria Company")
- tipo: protocol
- Papel: Convidado com `ver`, `comentar` e `editar` (só status) na Lista. Invocado por A7; sem Gatilho próprio. Entrada: Nome, Descrição, Tag, Centro de Custo, Empresa, Categoria de pagamento, Fornecedor (CPF/CNPJ), Forma de pagamento + campo correspondente, Valor, Data de vencimento. Conhecimento: de-para (Centro de Custo, Tag) → Conta de pagamento; Categoria → Categoria Omie + Código do plano de contas — **precisa ser extraído para uma Coleção de Conhecimento antes da migração** (OQ-CP-04). Ferramentas: `criar comentário`, `alterar status`, Integração Omie (lançar conta a pagar). Saída: o Comentário no formato de CON-CP-08, atribuído ao Financeiro e resolvido; depois a mudança de status. Se faltar campo obrigatório para o ERP: comenta o que falta, **não** muda status, deixa o Comentário aberto atribuído ao Financeiro. Autonomia: age sem aprovação para comentar/mover; o lançamento no ERP "deve exigir Ensaio na primeira semana e Política de aprovação depois, decisão de produto".
- source: `docs/07-processos/contas-a-pagar.md` §9

### CON-CP-08 — Formato exato do Comentário "RESUMO DE PAGAMENTO"
- tipo: api-contract (é o ponto de encontro dos dois sistemas — cabeçalho idêntico em `buildResumoDePagamento` e em `payment-automation-service.ts`)
  ```text
  📋 RESUMO DE PAGAMENTO
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  O que pagar:    <Nome>
  Centro de custo: <Centro de Custo>
  Conta pagamento: <conta bancária do ERP, inferida de Centro de Custo + Tag>
  Categoria:      <categoria no vocabulário do ERP>
  Código:         <código do plano de contas, ex. 2.04.08>

  📅 Vencimento:        dd/mm/aaaa
  📅 Previsão pagto:    dd/mm/aaaa
  💰 Valor:             R$ 0,00

  💳 Forma de pagamento:
    • Tipo: <forma>: <dado>

  📝 Observações: <regra usada para inferir — justificativa auditável>

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  O que é e como será utilizado. Caso hajam parcelas, especifique aqui:
  <Descrição>
  ```
- Publicado pelo Agente, atribuído ao Financeiro e já resolvido; ~1 minuto depois o status vai para `lançado omie`. Na plataforma o RESUMO é **saída**, não entrada (o `automation/` hoje o reparseia por regex — `01-inventario` §9).
- source: `docs/07-processos/contas-a-pagar.md` §6.3; `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` §2

### CON-CP-09 — Permissões por Papel na Lista "Contas a pagar"
- tipo: nfr (segurança/LGPD)
- Financeiro: `ver, criar, editar, comentar, excluir, administrar`. Aprovador: `ver`, `editar` (status e Responsável), `comentar`. Pessoa da conta: Convidado — `ver` **só as Tarefas em que é o valor do campo Pessoa**, `comentar`, `editar` restrito a Anexo e Data de Emissão. Agente: Convidado conforme CON-CP-07. Demais Membros: **sem acesso** (dados bancários e CPF de terceiros).
- "Hoje no ClickUp a Pessoa da conta é Membro pleno e vê a Lista inteira — inclusive chaves Pix e valores dos colegas. A restrição acima é a que o processo precisa, não a que ele tem." (Risco listado em 03-plano §5: Fase 3 aplica.)
- source: `docs/07-processos/contas-a-pagar.md` §10; `docs/08-migracao-financeiro/03-plano-de-migracao.md` §5

### CON-CP-10 — Regras RN-CP-01..07 e invariante INV-CP-01
- tipo: protocol
- RN-CP-01 Centro de Custo obrigatório na criação.
- RN-CP-02 Sair de `para pagar` exige Valor, Data de vencimento, Forma de pagamento e o dado de pagamento coerente (Chave pix / Código de barras + Boleto / Pix copia e cola + QR Code) — Requisito de saída do status.
- RN-CP-03 Fornecedor = CPF exige CPF; = CNPJ exige CNPJ.
- RN-CP-04 Entrar em `em autorização bancária` troca o Responsável para o Aprovador (A3). Entrar em `pago` só é permitido ao Aprovador.
- RN-CP-05 `pago` é o único `fechado`; `aprovado` e `negado` são `concluído` e não disparam recorrência.
- RN-CP-06 Uma ocorrência por fechamento; reabrir e fechar não duplica.
- RN-CP-07 Exatamente uma Tag `conta *` por Tarefa.
- INV-CP-01 Toda Tarefa em `lançado omie` ou posterior tem um Comentário "Resumo de pagamento" ou `Integração manual = Manual`.
- source: `docs/07-processos/contas-a-pagar.md` §11

### CON-CP-11 — Mudança de status em lote
- tipo: nfr
- "em 2026-09-08 11:58:06, 61 Tarefas com vencimento 2026-09-04 foram fechadas no mesmo segundo. A plataforma precisa de **seleção múltipla + mudança de status em lote** na Lista." (Cada fechamento dispara A1 — 61 recorrências num segundo — relevante para DEC-06, escritas serializadas por Espaço.)
- source: `docs/07-processos/contas-a-pagar.md` §6.5; `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 3

### CON-CP-12 — Migração de dados: paginação e preservação de tempos
- tipo: nfr
- "mais de 200 Tarefas ativas + histórico; a migração precisa de paginação e de manter `date_created`, `date_closed` e o histórico de status (o 'tempo em status' é usado como métrica: 29-31 dias em `para pagar` é o ciclo normal)."
- source: `docs/07-processos/contas-a-pagar.md` §12 (último item — é restrição, não pergunta)

---

## C. `docs/07-processos/contas-a-receber.md` (SPEC, precedence 2)

Lido da Lista real (`901107648977`) em 2026-09-14: 240 Tarefas. **A Lista está dormente desde out/2025** (OQ-CR-01 / D7). O processo descrito é o que funcionou entre jan e out/2025. Implementado em memória no protótipo (`seed-contas-a-receber.ts` 359 l., `createReceivableSeries`, `parcelaDuplicada`, `contas-a-receber.test.ts`) com as leituras conservadoras de CAND-05.

### CON-CR-01 — Estrutura, Vínculo com o cliente e soma por cliente
- tipo: schema
- Mesma Pasta "Financeiro"; Lista "Contas a receber"; Tarefas do Tipo `Conta` (mesmo `1012`). Relação com o cliente = **Vínculo** tipado Tarefa → Cliente. No ClickUp o cliente é uma Tarefa do Tipo "Cliente" (1015) na Lista "Gestão de clientes" (`901109161381`, Espaço CRM `90112771405`), com rollup de soma do Valor; na plataforma "deve ser Empresa ou Contato do CRM, decisão em §12" (OQ-CR-02). "A soma por cliente é um Painel de contexto sobre o registro do cliente, não um campo."
- Cadeia contrato → cliente → parcelas (cliente tem Vínculo com "Gestão contratual", status `em vigor`).
- source: `docs/07-processos/contas-a-receber.md` §2

### CON-CR-02 — Conjunto de Status (6) e transições
- tipo: schema + protocol
- `para receber` (não iniciado, inicial) · `disponível para saque` (em andamento; **0 usos**) · `pendente` (em andamento) · `estornado` (concluído; **0 usos**) · `descartado` (concluído; 47) · `recebido` (fechado; 191).
- Transições: `para receber → recebido`; `para receber → pendente → recebido | descartado`; `para receber → descartado` (cancelamento em lote); `recebido → pendente → descartado` (reversão — "o Conjunto precisa permitir reabrir um `fechado`").
- source: `docs/07-processos/contas-a-receber.md` §3, §7.5

### CON-CR-03 — Definições de Campo (8 + 1 relacionamento)
- tipo: schema
- Compartilhadas com Contas a pagar (mesmos IDs): A Centro de Custo (**obrigatório**), B BU, C Empresa, Y Produto (**usado aqui**, ex. "Master Private"), T Valor (BRL), U Integração manual (vazio), W Equipe (vazio). Exclusiva: **Data de pagamento** (data em que o dinheiro entrou). Relacionamento: Gestão de Clientes (→ `901109161381`).
- Nativos em uso: Nome (padrão em CON-CR-04), Data de vencimento, **Data de início** (data do contrato), Prioridade (`high` em dois saques urgentes), Responsável, Descrição (log de cobrança), Anexos (prints), Tags.
- source: `docs/07-processos/contas-a-receber.md` §4

### CON-CR-04 — Nomenclatura e criação em lote na assinatura
- tipo: protocol
- Nomes: `Entrada – <Cliente>` · `<N>ª Parcela – <Cliente>` · `Saque <Plataforma>`. Criação em lote na assinatura: entrada + N parcelas mensais, Valor, Centro de Custo, Empresa, Produto, Vínculo, Responsável Financeiro, Data de início = contrato. Backfill de jan/2025: `date_closed` não é a data do recebimento — **Data de pagamento** é.
- source: `docs/07-processos/contas-a-receber.md` §5

### CON-CR-05 — Tags de cobrança → Campo "Situação de cobrança"
- tipo: schema
- `em cobrança` (20; sempre com `pendente` ou `recebido` atrasado) · `inadimplência` (37; sempre com `descartado`) · `conta tria` (2; convenção nova que não se espalhou — OQ-CR-07). "Na plataforma cabem melhor como um Campo 'Situação de cobrança' (em dia / em cobrança / inadimplente) do que como Tags, porque são mutuamente exclusivos e têm ordem. Se ficarem como Tags, a regra RN-CR-05 impede as duas juntas."
- source: `docs/07-processos/contas-a-receber.md` §6, §9

### CON-CR-06 — Automações R1–R7 (escopo: Lista "Contas a receber"; nenhuma existe hoje)
- tipo: protocol
- R1 Contrato entra em `em vigor` (Lista Gestão contratual) ∧ tem valor, entrada e nº de parcelas → criar a série (1 "Entrada" + N "Nª Parcela", Valor, vencimento mensal, Vínculo, Responsável Financeiro, `para receber`). **Fallback sancionado pelo SPEC:** "se a plataforma não tiver Gestão contratual no primeiro momento, R1 vira um formulário 'criar série de parcelas' na própria Lista" (é o que o protótipo fez — CAND-05).
- R2 vencimento + 1 dia ∧ `para receber` → `pendente`; Tag `em cobrança`; notificar Financeiro.
- R3 entra em `recebido` ∧ Data de pagamento vazia → preencher = hoje.
- R4 `pendente` há 30 dias → Comentário com Menção ao Responsável do cliente no CRM (Comercial). (prazo a confirmar — OQ-CR-05)
- R5 `pendente` há 60 dias → Comentário atribuído à Diretoria. (idem)
- R6 entra em `descartado` com Tag `inadimplência` → remover `em cobrança`; marcar o cliente no CRM como inadimplente (campo "Situação" do cliente, a criar).
- R7 1º dia útil do mês → criar "Saque <Plataforma>" em `para receber` (por Regra de Recorrência, não por Automação).
- source: `docs/07-processos/contas-a-receber.md` §8

### CON-CR-07 — Campos a acrescentar (sem eles "o processo não é consultável, só legível")
- tipo: schema
- Número da parcela / Total (inteiro/inteiro) · Tipo de recebimento (Entrada | Parcela | Saque de plataforma | Avulso) · Forma de recebimento (Pix | Boleto | Cartão | Plataforma) · Situação de cobrança (em dia | em cobrança | inadimplente) · Contrato (Vínculo → Gestão contratual).
- source: `docs/07-processos/contas-a-receber.md` §9

### CON-CR-08 — Permissões por Papel na Lista "Contas a receber"
- tipo: nfr (LGPD)
- Financeiro: `ver, criar, editar, comentar, excluir, administrar`. Comercial (Responsável do cliente no CRM): `ver` **as Tarefas dos seus clientes**, `comentar` — derivado do Vínculo. Diretoria: `ver`, `comentar`, `editar` (status). Cliente: sem acesso.
- source: `docs/07-processos/contas-a-receber.md` §10

### CON-CR-09 — Regras RN-CR-01..07 e invariantes INV-CR-01/02
- tipo: protocol
- RN-CR-01 Centro de Custo obrigatório. RN-CR-02 Toda Tarefa Entrada/Parcela tem Vínculo com exatamente um cliente. RN-CR-03 Entrar em `recebido` exige Valor > 0 e Data de pagamento (R3 preenche se faltar); exceção Saques (Valor `0` hoje — OQ-CR-04). RN-CR-04 `pendente` só a partir de `para receber` ou `recebido`; `descartado` a partir de qualquer status não fechado. RN-CR-05 `em cobrança` e `inadimplência` mutuamente exclusivas; `inadimplência` só com `descartado`. RN-CR-06 Nunca Subtarefa nesta Lista (desabilitar). RN-CR-07 (Cliente, Tipo de recebimento, Número da parcela) é único — hoje há duplicatas.
- INV-CR-01 Soma de Valor das `recebido` de um contrato ≤ valor do contrato. INV-CR-02 Data de pagamento ≥ Data de início.
- source: `docs/07-processos/contas-a-receber.md` §11

### CON-CR-10 — Migração: Data de pagamento sobre `date_closed`
- tipo: nfr
- "A migração deve levar Data de pagamento quando existir e `date_closed` só como fallback." (nas Tarefas de 2025 divergem por horas/dias; no backfill, por meses)
- source: `docs/07-processos/contas-a-receber.md` §12 (penúltimo item — é restrição de importação, não pergunta)
