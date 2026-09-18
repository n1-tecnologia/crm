# Phase 2: Solicitação de pagamento — o front substitui o ClickUp - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Toda Solicitação de pagamento nova nasce no CRM N1, numa Lista própria, pelo Formulário público ou pela criação direta de um Membro; o aprovador decide dentro do CRM N1; Comentários e Registros de Atividade formam a timeline; e o pipeline existente do `automation/` troca o ClickUp pelo `apps/api` sem mudar as regras de validação, classificação contábil ou lançamento no Omie. A fase também importa as 1.110 linhas históricas como Tarefas fechadas e executa a transição operacional que permite desligar os webhooks e arquivar a Lista de Solicitações no ClickUp.

Inclui mudanças coordenadas neste monorepo e no repositório irmão `financeiro-tria`, limitadas ao contrato HTTP, ao adapter, ao mapper e ao novo webhook da plataforma. Não inclui o motor genérico de Automações, a operação completa de Contas a pagar, as telas que nunca viveram no ClickUp, nem a mudança dos outros tenants — Phases 3–5.

</domain>

<decisions>
## Implementation Decisions

### Entrada da Solicitação
- **D-01:** A Solicitação vive numa Lista própria, `Solicitações de pagamento`, ao lado de `Contas a pagar`. O Conjunto de Status oficial é exatamente o atual da Lista real: `para fazer`, `em aprovação`, `não aprovado`, `aprovado`. A recomendação antiga de remover `aprovado` e a enumeração preliminar `recebida → ... → convertida` estão sobrepostas pela spec real de 2026-09-17. Não criar `em revisão` nem `convertida` nesta fase.
- **D-02:** O caminho principal de entrada é o Formulário público por segredo (`/f/<segredo>`), sem login, usando `submitForm`; Membros também podem criar diretamente na Lista pela UI normal. Os dois caminhos produzem a mesma Tarefa e disparam o mesmo evento, sem fluxo paralelo de negócio.
- **D-03:** O envio anônimo age como Ator `sistema` com proveniência `form`; o dono do Formulário fornece o contexto de permissão e propriedade da Tarefa, mas não aparece como se tivesse preenchido o pedido. Nome e WhatsApp do solicitante permanecem nos Campos próprios. O Registro de Atividade precisa distinguir explicitamente `sistema/Formulário` do dono humano.
- **D-04:** Nota fiscal, boleto e comprovantes entram no Supabase Storage do projeto da plataforma, em bucket privado. O navegador usa upload autorizado; o `automation/` recebe URL assinada curta pelo contrato de `getTask`; nenhuma URL pública permanente ou chave de storage cruza a fronteira.
- **D-05:** Depois do envio público, mostrar apenas confirmação e identificador legível da Solicitação. Não criar acompanhamento público nesta fase.

### Aprovação e roteamento
- **D-06:** A ação `solicitarAprovacao` cria uma Solicitação de Aprovação ligada diretamente à Tarefa e ao passo do processo. `ApprovalRequest` deixa de exigir uma `AgentExecution`; `executionId` passa a ser opcional ou substituído por uma origem discriminada. Aprovações de Agente continuam funcionando sem mudança de comportamento.
- **D-07:** O aprovador é resolvido por configuração de Automação da Lista usando Centro de Custo e Valor, com o corte atual de R$ 5.000. A regra não fica hardcoded na tela nem duplicada no `automation/`; o Financeiro pode alterar a configuração sem deploy.
- **D-08:** A fila `/ia/aprovacoes` e o card da Tarefa são os dois pontos de decisão. A plataforma também publica o comentário de roteamento com Menção no tópico, preservando o lugar onde o fallback por comentário opera.
- **D-09:** Aprovar ou rejeitar escreve no mesmo tópico uma resposta canônica (`✅ Aprovado por ...` ou `❌ Reprovado por ...`), com Ator igual ao Membro que decidiu, registra a atividade e então muda o Status. Clique e comentário convergem no mesmo fato de negócio; repetição da mesma decisão é idempotente.
- **D-10:** O classificador de comentário fica ativo como fallback durante 90 dias corridos a partir do go-live de produção, com métrica `aprovações por comentário / total`. A data final é calculada e registrada no deploy. Depois de 90 dias, desligar se a métrica confirmar que o fallback não é necessário.
- **D-11:** Não há lembrete automático nem expiração da aprovação nesta fase, pois isso não existe no processo observado. Pendências permanecem visíveis na fila até decisão ou cancelamento explícito; não usar o timeout atual de Execução de Agente para cancelar uma aprovação financeira.
- **D-12:** Divergência de documento/anexo bloqueia o roteamento. A única exceção é o Fluxo Manual acionado explicitamente pelo Financeiro, com motivo obrigatório e Registro de Atividade — nunca uma tolerância silenciosa do Agente.
- **D-13:** `Revisor do RESUMO` é configuração de papel/processo da Lista, não uma lista de ids hardcoded no `automation/`. Maryane e Liliane são as ocupantes iniciais quando suas identidades estiverem resolvidas; a ausência temporária da identidade de Liliane não impede o restante do go-live.
- **D-14:** Nesta fase a Solicitação termina em `aprovado` com o RESUMO publicado e continua sendo a unidade que o `automation/` processa. A criação estruturada da Conta a pagar e o preenchimento do Vínculo Solicitação → Conta pertencem à Fase 3; não antecipar essa conversão nem inventar um Status `convertida` agora.

### Fronteira com `automation/`
- **D-15:** O `apps/api` roda na mesma VPS do `automation/`, como processo separado atrás do nginx existente. A exposição pública aceita somente as rotas necessárias; comunicação serviço-a-serviço usa TLS e credencial própria, rotacionável e com escopo mínimo, separada de JWT de usuário e de credenciais do Supabase.
- **D-16:** Antes do adapter, escrever um contrato HTTP v1 canônico para os sete métodos (`getTask`, `createComment`, `getCommentReplies`, `updateTaskStatus`, `updateTaskDueDate`, `addTaskTag`, `listPaymentRequestTasks`). O contrato usa DTOs da plataforma, não formas do ClickUp, inclui autenticação, códigos de erro, paginação e idempotência, e é validado por testes de contrato nos dois repositórios para impedir deriva.
- **D-17:** `adapters/plataforma.ts` implementa a mesma interface consumida por `PaymentAutomationService`; `plataforma-payment-mapper.ts` lê os DTOs tipados. As regras de prazo, documento, anexo, roteamento, categoria e Omie permanecem no serviço atual. Nada acessa o schema `plataforma` por SQL e nenhum JOIN cruza os dois Supabases.
- **D-18:** O evento `solicitacao-criada` usa um outbox persistente mínimo no `apps/api`: gravação da Tarefa e do evento é atômica; entrega ao novo `POST /webhooks/plataforma/solicitacao-criada` tem idempotency key, retry com backoff e estado auditável. Essa é a semente técnica do motor da Fase 3, mas nesta fase suporta apenas os eventos necessários ao pipeline — sem executor genérico de Automação.
- **D-19:** Se o `automation/` estiver indisponível, o envio do Formulário continua confirmado depois da persistência e o outbox repete a entrega. Se o `apps/api` estiver indisponível durante uma chamada do `automation/`, o adapter mantém fila persistente por Tarefa, preserva ordem das mutações e repete; o run não é perdido nem convertido em sucesso falso.
- **D-20:** Operações de escrita do adapter aceitam chave de idempotência. Replays não duplicam Comentários, decisões, Tags ou transições. Falha permanente vai para estado visível de intervenção, com payload sanitizado e opção de replay; segredo, CPF/CNPJ completo e conteúdo de anexo não entram em log.
- **D-21:** `clickup.ts` permanece no `financeiro-tria`, selecionável por variável de ambiente para rollback controlado, mas fica desligado após o corte. Não mover o `automation/` para o monorepo nesta fase; D12 é reavaliada somente depois do contrato estabilizar.
- **D-22:** A divisão DEC-16 está confirmada: somente o que substitui o ClickUp usa a ontologia. As telas de Notas fiscais, Produtos, Plano de contas, Extratos, Workflows, Dashboard, Problemas e Aprovações operacionais continuam reservadas à Fase 4, lendo uma API autenticada do `automation/`. Nesta fase se define o padrão de autenticação desse caminho, sem portar as telas.
- **D-23:** Antes do go-live, hospedar a persistência da plataforma na região brasileira do Supabase quando disponível para o projeto; como a base ainda é pequena, a migração regional deve preceder o corte. Se a região não estiver disponível no plano contratado, o pesquisador deve documentar a alternativa e medir a latência VPS ↔ banco antes de congelar a topologia.

### Histórico e operação em paralelo
- **D-24:** A fonte das 1.110 Solicitações históricas é `public.solicitacoes_pagamentos` no Supabase do `financeiro-tria`, não as 19 Tarefas retidas na Lista do ClickUp. Cada linha vira uma Tarefa fechada em `aprovado` ou `não aprovado` conforme o dado demonstrável; `comentario` vira Comentário do RESUMO; datas e autoria conhecidas viram Registros de Atividade com data original.
- **D-25:** A importação é reexecutável e idempotente por `(origem=clickup, TaskID legado)`, com dry-run, manifesto de contagens e relatório de rejeições. Nunca copiar `app_key`, `app_secret`, bancos vetoriais ou qualquer credencial por linha. Valor ausente ou ambíguo fica registrado como lacuna de importação; não inventar dado.
- **D-26:** Anexos preservados na exportação da Fase 0 são enviados ao bucket privado e ligados às Tarefas históricas quando o vínculo com o `TaskID` for inequívoco. Ausência de arquivo não aborta o lote: gera aviso reconciliável. Nomes e metadados sensíveis não entram no manifesto versionado.
- **D-27:** O ensaio de duas semanas usa coortes por origem: uma Solicitação pertence ao caminho ClickUp ou ao caminho plataforma, nunca aos dois ao mesmo tempo. Comparar os `IncluirContaPagar` por `ConsultarContaPagar` e `codigo_lancamento_integracao` determinístico; não fazer double-write da mesma obrigação no Omie.
- **D-28:** O corte final ocorre somente com contagens reconciliadas, zero falha não tratada, paridade do Omie e aprovação do roteiro operacional. Então novos pedidos ficam exclusivos no CRM N1, os webhooks Tria do ClickUp são desligados e a Lista é arquivada. Para rollback, reabrir temporariamente a entrada no ClickUp apenas para pedidos novos; Tarefas já originadas na plataforma continuam nela e são reprocessadas pela fila, sem sincronização reversa.

### Claude's Discretion
- Forma exata dos endpoints v1 e nomes dos DTOs, desde que os sete métodos e seus contratos permaneçam explícitos e testados.
- Tecnologia e tabelas internas do outbox/fila, política precisa de backoff e limite antes de intervenção manual.
- TTL exato das URLs assinadas, limites de tamanho/MIME e estratégia de upload, respeitando bucket privado e validação server-side.
- Layout fino do Formulário, da fila de Aprovações e da timeline, reutilizando o sistema visual existente.
- Divisão dos planos e ondas de execução, inclusive como coordenar commits entre os dois repositórios sem misturar o worktree já sujo do `financeiro-tria`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo e decisões travadas
- `.planning/ROADMAP.md` — Phase 2, critérios de sucesso e decisões pré-planejamento; o CONTEXT resolve D9, OQ-PLAN-01, OQ-SYN-02 e D11.
- `.planning/PROJECT.md` — DEC-11..17 e constraints: fronteira entre plataforma e `automation/`, dois Supabases, HTTP obrigatório, `TaskID` + `origem`.
- `.planning/REQUIREMENTS.md` — SOL-01..09 e constraints CON-01..13. Onde o texto preliminar conflita com a spec real, prevalecem `docs/07-processos/solicitacao-de-pagamento.md` e este CONTEXT.
- `.planning/phases/00-prepara-o/00-CONTEXT.md` — decisões da exportação, Lista própria, fallback por 90 dias e de-para de usuários.
- `.planning/phases/01-o-crm-n1-ganha-persist-ncia-e-login/01-CONTEXT.md` — contratos de persistência/API, autenticação e bootstrap que esta fase estende.

### Processo e migração
- `docs/07-processos/solicitacao-de-pagamento.md` — fonte canônica do processo real, quatro Status, 25 Campos, fluxos, permissões, regras e lacunas L-01/L-03/L-07/L-09/L-11 resolvidas neste CONTEXT.
- `docs/07-processos/contas-a-pagar.md` §6.3 — formato exato do RESUMO DE PAGAMENTO, contrato entre os sistemas.
- `docs/08-migracao-financeiro/03-plano-de-migracao.md` §2–§3 — arquitetura-alvo, entregáveis da Fase 2, corte e fronteira de responsabilidades.
- `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §3–§5 — pipeline existente, sete métodos, schema legado, volume de 1.110 linhas e riscos de credenciais.
- `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` — tradução ClickUp → ontologia e divergências conhecidas.
- `apps/api/exportacoes/MANIFESTO.md` — prova sanitizada da exportação ClickUp usada pela spec e pelos anexos históricos.

### Código deste monorepo
- `packages/dominio/src/operations/scale.ts` — `createForm`, `formBySecret`, `submitForm`; base do envio público e ponto de correção do Ator/proveniência.
- `packages/dominio/src/types/ai.ts` e `packages/dominio/src/operations/ai.ts` — `ApprovalRequest` hoje amarrada à `AgentExecution` e `decideApproval`; precisam aceitar aprovação de processo sem quebrar aprovações de Agente.
- `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx` — fila e decisão existentes a reutilizar.
- `apps/web/src/features/estrutura/forms-editor.tsx` e `apps/web/src/dados/publico-provider.tsx` — editor/rota pública já existentes; o provider em memória é dívida explícita desta fase.
- `apps/api/src/rotas/operacoes.ts` e `apps/api/src/persistencia/unidade-de-trabalho.ts` — borda HTTP e transação onde evento/outbox precisa nascer sem duplicar regra do domínio.
- `apps/api/src/importacao/clickup/` — exportador, manifesto e de-para que a importação histórica reaproveita.

### Código do repositório `financeiro-tria` (somente os arquivos necessários)
- `../financeiro-tria/automation/src/adapters/clickup.ts` — interface real dos sete métodos que `plataforma.ts` deve substituir.
- `../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts` — consumidor do adapter e pipeline que deve manter comportamento.
- `../financeiro-tria/automation/src/tenants/tria/clickup-payment-mapper.ts` — parser a substituir pelo mapper tipado.
- `../financeiro-tria/automation/src/tenants/tria/payment-rules.ts` — regras que permanecem no `automation/`.
- `../financeiro-tria/automation/src/http/routes.ts` — webhooks atuais e ponto do novo endpoint da plataforma.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `submitForm` já cria Tarefa, valida Campos obrigatórios e marca `provenance.kind = "form"`; falta expô-lo pela API persistente e corrigir o Ator para não atribuir o envio anônimo ao dono.
- `ApprovalRequest`, `decideApproval` e `/ia/aprovacoes` já entregam a maior parte da experiência de clique; a principal mudança é separar aprovação de processo de `AgentExecution` e refletir a decisão na Tarefa/tópico.
- `POST /operacoes/:nome`, a Unidade de Trabalho e schemas Zod já formam a borda autenticada para os sete métodos da plataforma.
- O exportador ClickUp já tem paginação, retomada, download de anexos, sanitização e manifesto; são padrões diretos para o importador histórico.
- `ClickUpAdapter` concentra os sete métodos em um único arquivo de 132 linhas; manter a interface reduz o raio de mudança no serviço.

### Established Patterns
- Domínio puro: operações mutam `DataState`, devolvem `OperationResult`, registram Atividade e não conhecem HTTP, banco ou storage.
- Estado persiste por Espaço via UoW com revisão otimista e diff; evento de saída precisa participar da mesma confirmação sem executar I/O externo dentro da transação.
- Autenticação humana usa JWT Supabase e resolve Membro pelo `sub`; integração de serviço precisa de identidade distinta e auditável.
- Scripts/importadores são idempotentes e testes externos pulam sem variáveis de ambiente; dados financeiros e anexos ficam fora do git.

### Integration Points
- Formulário público: rota `/f/[segredo]` → transporte público persistente → operação `submitForm` → UoW → outbox.
- Aprovação: Tarefa/Automação → `ApprovalRequest` → `/ia/aprovacoes` ou card → `decideApproval` → Comentário + Status + evento para o pipeline.
- Adapter: `PaymentAutomationService` continua chamando a mesma abstração, selecionada por env entre `clickup.ts` e `plataforma.ts`.
- Histórico: Supabase do financeiro → importador do `apps/api` → operações/UoW da plataforma + Storage, nunca INSERT direto em `plataforma.registros`.

</code_context>

<specifics>
## Specific Ideas

- O formulário deve parecer a substituição direta do Formulário do ClickUp: link simples, sem conta, confirmação com o número da Solicitação.
- O tópico de roteamento continua sendo o ponto humano comum entre clique e fallback; a mudança de interface não apaga a conversa.
- A transição prioriza prova de paridade e replay seguro: uma obrigação nunca deve ser lançada duas vezes para “testar os dois caminhos”.
- O worktree do `financeiro-tria` já tem muitas mudanças não relacionadas; os planos precisam limitar explicitamente cada arquivo tocado e nunca limpar ou reformatar o restante.

</specifics>

<deferred>
## Deferred Ideas

- Motor genérico de Automações, agenda, ações genéricas e Execuções auditáveis — Fase 3; esta fase entrega somente outbox/eventos mínimos.
- Criação automática da Conta a pagar e Vínculo estruturado a partir da Solicitação — Fase 3; nesta fase a Solicitação aprovada continua sendo processada pelo pipeline atual.
- Lembretes e escalonamento de aprovação — sem evidência no processo atual; avaliar como capacidade futura a partir de dados reais.
- Portar as telas que nunca viveram no ClickUp e remover `anon_read` do painel — Fase 4.
- Mover `automation/` para o monorepo — reavaliar após a Fase 2, com o contrato estabilizado.

</deferred>

---

*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Context gathered: 2026-09-18*
