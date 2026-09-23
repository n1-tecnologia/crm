# Phase 4: As outras telas do financeiro-tria - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

As oito leituras que o Financeiro tem hoje no painel `financeiro-tria.vercel.app`
— Notas fiscais, Produtos, Plano de contas, Extratos do Marcos, Workflows,
Dashboard, Problemas e Aprovações pendentes — passam a existir dentro do CRM N1,
no sistema de design dele, chegando por um caminho **autenticado** que substitui
o `anon_read` e o `AuthContext` de hoje. Nenhuma regra de negócio muda: é
releitura visual (DEC-16 / D-22). Ao fim da fase, `financeiro-tria.vercel.app`
pode sair do ar sem ninguém sentir falta.

Inclui mudanças coordenadas no repositório irmão `financeiro-tria`, limitadas a
**uma superfície HTTP nova de leitura** (`/v1/leituras/*`) e ao re-homing das
duas funções de derivação que hoje moram no front que vai morrer. Não inclui
modelar `transacoes`, `produtos` ou o plano de contas na ontologia (DEC-16
proíbe), não inclui Contas a receber, nem os tenants Marcos Paulo e Family
Office — Phase 5.

</domain>

<decisions>
## Implementation Decisions

### O caminho autenticado (OQ-SYN-01 — a pergunta que não estava em documento nenhum)

- **D4-01 — O navegador nunca fala com o `automation/`.** As leituras vão
  `apps/web` → `apps/api` → `automation/`. O JWT do Supabase autentica o Membro
  na borda do `apps/api` (o hook que já existe desde 01-02); do `apps/api` para
  o `automation/` vai uma credencial de serviço `Authorization: Bearer`, que
  nunca chega ao bundle. É o mesmo desenho de D-15 e o **espelho exato** da
  ponte de 03-11 (`apps/api/src/automacoes/invocar-agente.ts`), que já chama
  `automation/` por HTTP com `AbortSignal.timeout`, classificação
  transitório/permanente e `sanitizarErro()`.

  Alternativa recusada: o navegador falar direto com o `automation/` com o JWT
  do usuário. Obrigaria o Express a validar JWT do Supabase (dependência nova
  num serviço que CON-05 manda não mexer), abriria CORS do `automation/` para a
  origem do web, e quebraria a invariante de que `apps/web` só conhece um
  backend.

- **D4-02 — Credencial própria, só de leitura.** `PLATAFORMA_LEITURA_TOKEN`,
  separada de `PLATAFORMA_LANCAMENTO_TOKEN` (03-07/03-11). D-15 exige escopo
  mínimo: o token que lê o Dashboard não pode ser o token que lança no Omie.
  Rotação independente; um vazamento do token de leitura não gasta dinheiro.

- **D4-03 — Superfície nova, autenticada desde o nascimento: `/v1/leituras/*`.**
  As rotas de hoje (`GET /automation/runs`, `/financeiro/solicitacoes`,
  `/plano-contas`, `/workflows`) continuam **intocadas e públicas** durante a
  fase, porque o painel do Vercel ainda está no ar e derrubá-lo antes da hora é
  a única forma de esta fase causar dano. Elas só são removidas no plano de
  corte (D4-16), junto com o `anon_read`. Mesma disciplina de superfície nova
  que 03-07 usou: reusa a *disciplina* de `webhooks-plataforma.ts`
  (autenticação em tempo constante, envelope de erro sanitizado), não importa o
  módulo do contrato v1 — os sete métodos daquele contrato são o sentido
  oposto.

- **D4-04 — `apps/api` não lê o schema `public`, nunca.** Não é preferência de
  estilo: desde a Fase 0 o schema `plataforma` vive **em projeto Supabase
  próprio**, e D-23 move a plataforma para `sa-east-1`. São dois bancos
  distintos — o `apps/api` fisicamente não alcança `public`. Toda leitura do
  legado entra por HTTP no `automation/`, que é o dono daquele schema.

### O que atravessa a fronteira (e o que jamais atravessa)

- **D4-05 — Toda leitura é projetada, nunca repassada.** O
  `GET /financeiro/solicitacoes` de hoje devolve a linha inteira de
  `solicitacoes_pagamentos` — **incluindo `app_key` e `app_secret`**. Somada ao
  `anon_read`, essa é a pior consequência do desenho atual. Cada rota de
  `/v1/leituras/*` declara um DTO explícito com allowlist de campos; credencial
  por linha, chave Pix e documento completo não entram no DTO, e um teste prova
  a ausência por nome de campo (mesma disciplina de sanitização de
  T-3-04/03-11).

- **D4-06 — Dashboard, Problemas e Aprovações pendentes são servidos
  computados.** `buildDashboardStats` e `buildProblemRows` moram hoje no front
  do Vercel (`src/features/financeiro/data/solicitacoesPagamentos.ts`), que
  morre nesta fase. Elas são re-homed como funções puras com teste no
  `automation/`, e as rotas devolvem linhas prontas.

  O motivo é D4-05, não elegância: derivar no navegador exigiria mandar as
  1.110 linhas inteiras para o cliente — exatamente o que não pode atravessar.
  `realIntegrations` (o array com `lastRun: "tempo real"` e `latency: "-"`
  escritos à mão) **não é portado**: é ficção de protótipo, e a tela de
  Integrações não está nas oito de TELA-01.

- **D4-07 — Leitura primeiro; escrita só onde não existe equivalente na
  plataforma.** São portadas como escrita: o CRUD e o import do Plano de contas
  (`POST`/`DELETE /plano-contas`), a edição de alíquota em Produtos, o upload de
  Extratos, os dois gatilhos de emissão de NF (D4-12) e, das ações de run,
  apenas `retry-step` e `cancel` — recuperação operacional sem equivalente na
  ontologia.

  **Não** são portadas: `PATCH /financeiro/solicitacoes/:id/aprovado` e as ações
  `approve`/`review` de run. Aprovar é decisão da plataforma desde a Fase 2
  (D-06/D-09); um segundo botão de aprovar, sobre outra tabela, é a divergência
  que a migração inteira existe para eliminar.

### As telas, uma a uma

- **D4-08 — Um `/financeiro` de primeiro nível no shell do CRM N1**, com as oito
  leituras como sub-rotas, espelhando os caminhos de hoje
  (`/financeiro/notas-fiscais`, `/produtos`, `/plano-contas`, `/extratos`,
  `/workflows`, `/problemas`, `/aprovacoes-pendentes`, e o Dashboard na raiz).
  A memória muscular do Financeiro é ativo, não detalhe. Não vai debaixo de
  `ferramentas/` — quem opera o produto hoje é o Financeiro.

- **D4-09 — `Empresa` é um filtro, não um trocador de tenant.** O
  `EmpresaSwitcher` de hoje troca o contexto global das seis empresas. Aqui a
  Empresa vira parâmetro de consulta (`?empresa=`) e um controle de filtro no
  design do CRM N1. Modelar Empresa como Integração (CAND-01) é TEN-01, Phase 5:
  antecipar aqui transformaria um port de leitura numa mudança de modelo.

- **D4-10 — Plano de contas é a tela mais importante das oito, e não é CRUD.**
  *(Corrigido em 2026-09-23 depois da pesquisa: a versão anterior desta decisão
  dizia que a tela lê `planos_de_contas`, a tabela vazia. Está errado, e o erro
  vinha do texto de TELA-01, que herdou uma leitura velha do inventário §5.4.)*

  `plano-contas-routes.ts` lê e escreve `conciliador_contas` — a tabela
  **unificada**, 276 linhas — filtrando por `metadata @> {empresa, tipo}`.
  `planos_de_contas` (0 linhas) é tabela morta e esta tela não a toca.

  E é a **mesma** tabela que o Agente consulta: `matchCategory`
  (`automation/src/adapters/supabase.ts:307-332`) recebe o nome legado
  (`conciliador_contas_pagar_tria`), traduz para o filtro `{empresa, tipo}` e
  chama `match_conciliador_contas` sobre `conciliador_contas`. Ou seja: **um
  import feito nesta tela muda o que o Agente classifica no próximo
  lançamento.** Isso é o oposto de uma tela decorativa, e sobe o custo de errar
  a permissão. Nada de aviso na tela dizendo "não é isto que o Agente lê" — era
  o que a versão anterior mandava escrever, e seria mentira.

  A superfície é **lista + import em lote + apagar por id**, não CRUD: o código
  diz, em comentário, "sem edição nem criação avulsa (decisão do produto)".
  Portar como CRUD seria inventar regra, que DEC-16 proíbe. O `empresa`/`tipo`
  chega por allowlist fixa (6 empresas × `pagar`/`receber`); a tela nunca manda
  valor livre.

- **D4-10b — O import aceita CSV; `.xlsx` só passa por portão de legitimidade.**
  A rota recebe `rows: PlanoInput[]` em JSON — quem interpreta a planilha é o
  cliente. Fazer isso com `.xlsx` exigiria o pacote `xlsx` (SheetJS), que tem
  **CVE-2023-30533** (prototype pollution) sem correção publicada no registro do
  npm; a orientação do próprio projeto é instalar de fora do npm. Nesta fase o
  import é CSV, que não custa dependência nenhuma. Se o Financeiro precisar de
  `.xlsx`, entra como tarefa `[BLOCKING] checkpoint:human-verify` antes de
  qualquer `npm install`, no mesmo molde dos portões T-1-SC (fastify) e T-02-SC
  (playwright) — não como decisão silenciosa do executor.

- **D4-11 — Aprovações pendentes nasce como vista legada, e é assim que é
  rotulada.** Ela deriva de `solicitacoes_pagamentos.Aprovado`, que depois do
  corte da Fase 2 é o que o *pipeline* sabe — a fila viva é `/ia/aprovacoes`
  (D-08). A tela é leitura, não tem botão de decidir, e a rota nova é distinta
  da fila da plataforma. Ela esvazia sozinha com o tempo, e isso é o desenho.

- **D4-12 — D10 está respondida: a emissão manual de NF é um gatilho na tela de
  Notas fiscais, não uma Ação na Tarefa, e o Google Sheets não continua.**
  A recomendação "Ação na Tarefa" do plano §7 pressupunha que a nota fosse uma
  Tarefa; DEC-16/D-22 decidiram que `transacoes` não entra na ontologia, então o
  pressuposto caiu. E o código só sabe emitir **em lote**: existem
  `markSeteDias()` e `emitirNotas()`, expostos como `POST /invoice/run/mark-7days`
  e `POST /invoice/run/emit`; não há emissão por linha. Inventar uma seria mudar
  regra, que DEC-16 proíbe. A tela ganha os dois botões que já existem, com o
  resultado da corrida renderizado, e a linha mostra `controle_emissao` /
  `emissao_nota_produto` / `emissao_nota_servico` para quem quiser conferir.

- **D4-13 — O upload de Extratos sobe pelo `apps/api`.** `POST /financeiro/extratos`
  recebe o arquivo, valida MIME e tamanho no servidor e repassa ao
  `POST /webhook/receber-whatsapp-doc/:origem` com a credencial de serviço —
  mesma regra de D4-01, o navegador não fala com o `automation/`. Atenção
  operacional: `MP_RECEBIMENTO_SOURCE` hoje espera a origem
  `planilhas.triacompany.com.br`; a origem do proxy precisa entrar na
  allowlist, ou o upload é recusado em produção e não em teste.

### Permissão, frescor e falha

- **D4-14 — Quem alcança a Pasta "Financeiro" vê `/financeiro`.** A autorização
  reusa a regra de alcance que já existe no domínio (`memberReachesContainer`),
  aplicada na rota do `apps/api`: sem alcance, 403, e o item some da navegação.
  Nenhum sistema de permissão novo nasce aqui — PAG-06 já provou (03-05) que a
  visibilidade derivada é o caminho, e Concessão escrita à mão é o antipadrão.

- **D4-15 — Sem Realtime e sem cache nesta fase.** O painel de hoje assina
  Realtime em `automation_runs`/`automation_events` via `anon`; esse canal morre
  com o `anon_read`. As tabelas têm 9 e 10 linhas: não há o que empurrar ao
  vivo. Recarregar sob demanda, com botão de atualizar e revalidação ao focar a
  aba. Cache server-side fica de fora até haver latência medida que o
  justifique — inventar cache antes da medição é dívida com juros.
  Indisponibilidade do `automation/` é estado visível na tela ("o backend
  financeiro não respondeu"), nunca lista vazia fingindo que não há dados.

### O corte

- **D4-16 — O painel só sai do ar depois de uma semana de uso real**, e a ordem
  é: (1) as oito leituras em uso pelo Financeiro dentro do CRM N1; (2) confirmar
  com quem opera; (3) `financeiro-tria.vercel.app` **pausado**, não deletado, por
  30 dias, com o domínio respondendo; (4) remover a policy `anon_read` das
  tabelas (`solicitacoes_pagamentos`, `financas_mp`, `automation_workflows*`, as
  `conciliador_*`), o `AuthContext` e as rotas públicas legadas do `automation/`;
  (5) `npm run check` verde nos três workspaces. Rollback é despausar o Vercel —
  possível até a etapa 4, e é por isso que a remoção do `anon_read` é a última.

### Claude's Discretion

- Forma exata das rotas de `/v1/leituras/*`, nomes dos DTOs e divisão em
  arquivos, desde que a allowlist de campos seja explícita e testada.
- Divisão dos planos e ondas, e como coordenar commits entre os dois
  repositórios sem tocar o worktree sujo do `financeiro-tria`.
- Layout fino de cada uma das oito telas, reusando `apps/web/src/design/` e os
  padrões de `features/`.
- Política de timeout, retry e como a falha do `automation/` é renderizada.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo e decisões travadas
- `.planning/ROADMAP.md` — Phase 4, os 4 critérios de sucesso e a nota "antes de
  planejar" (os 89 arquivos não commitados do front do financeiro-tria são
  **referência de leitura**, nada dali é portado como código).
- `.planning/REQUIREMENTS.md` — TELA-01 e as constraints CON-01..13; CON-05 é o
  portão permanente.
- `.planning/PROJECT.md` — D-DEC-16 (a divisão ontologia × telas portadas) e
  OQ-SYN-01, a pergunta que esta fase responde.
- `.planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/02-CONTEXT.md`
  — D-15 (credencial de serviço, escopo mínimo, "o mesmo caminho serve às
  leituras autenticadas da Fase 4"), D-17, D-20, D-22 e D-23 (região).
- `.planning/phases/03-contas-a-pagar/03-CONTEXT.md` — D3-01 (só TRIA), D3-02
  (o de-para real é o RAG, não `planos_de_contas`).

### Processo e migração
- `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §5 (modelo de
  dados, credenciais por linha), §5.7 (volume real: `planos_de_contas` = 0,
  observabilidade = 9 runs), §6 (integrações), §7 (**as telas, rota por rota, com
  a fonte de dados de cada uma**), §9 (os 89 arquivos, o `AuthContext`), §10
  (o que morre).
- `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` §4 e §5 — o
  que só o financeiro-tria tem e o que a plataforma ganha.
- `docs/08-migracao-financeiro/03-plano-de-migracao.md` §2.4 (a regra que decide
  o que é ontologia e o que é tela portada), §3 Fase 4, §7 D10.
- `docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md` — o
  formato de contrato escrito para uma superfície plataforma → `automation/`;
  `/v1/leituras/*` segue o mesmo molde.

### Código deste monorepo
- `apps/api/src/automacoes/invocar-agente.ts` — **o molde do cliente HTTP**:
  Bearer, `AbortSignal.timeout`, transitório × permanente, `sanitizarErro()`
  importada de `persistencia/outbox-worker`.
- `apps/api/src/app.ts` e `apps/api/src/rotas/` — borda HTTP, hook de
  autenticação por JWT e registro de rotas; as leituras entram aqui **fora** de
  `POST /operacoes/:nome` e fora da Unidade de Trabalho.
- `apps/api/src/contratos/v1.ts` e `erros.ts` — schemas zod e envelope de erro
  sanitizado do contrato v1.
- `apps/web/src/design/` — `components.tsx`, `basicos.tsx`, `tela.tsx`,
  `esqueletos.tsx`, `icone.tsx` e os tokens; `npm run verificar:tokens` é portão.
- `apps/web/src/features/shell/navegacao.ts` e `rotas.ts` — onde `/financeiro`
  entra na navegação, com teste de rotas já existente.
- `apps/web/src/dados/store.ts` — a API pública do store (`useData`,
  `useSession`, `useRun`) **não muda**: as leituras do Financeiro não são estado
  do domínio e não entram no `DataState`.

### Código do repositório `financeiro-tria` (só o necessário)
- `automation/src/http/routes.ts` — `GET /automation/runs`, `/runs/:id`, as
  ações de run e `GET /financeiro/solicitacoes` (hoje devolvendo a linha inteira,
  com credenciais).
- `automation/src/http/workflow-routes.ts` — catálogo e runs de workflow.
- `automation/src/http/plano-contas-routes.ts` — GET/POST/DELETE e o import.
- `automation/src/http/bank-statement-webhooks.ts` — o upload de extrato e o
  `rawBody`.
- `automation/src/http/contas-a-pagar-routes.ts` — **a disciplina a copiar**:
  autenticação em tempo constante, `extrairBearer`, `credenciaisIguais`,
  `MENSAGENS_FIXAS`, `.strict()` nos schemas.
- `automation/src/tenants/tria/invoice-emission/invoice-emission-service.ts` —
  `markSeteDias()` (l. 199) e `emitirNotas()` (l. 802): a prova de que a emissão
  é em lote.
- `src/features/financeiro/data/solicitacoesPagamentos.ts` — `buildDashboardStats`
  (l. 110) e `buildProblemRows` (l. 137), as duas funções a re-homear. **Leitura
  de referência; o resto do `src/` do Vercel não é portado.**
- `supabase/migrations/*anon_read*.sql` e `20260511130000_rls_solicitacoes_pagamentos.sql`
  — as policies que o corte remove.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- A ponte de 03-11 já resolveu, em produção, todos os problemas difíceis de
  chamar o `automation/` a partir do `apps/api`: autenticação, timeout,
  classificação de erro, saneamento de log. As leituras copiam o formato, com
  um cliente próprio (são GETs sem idempotência, não mutações).
- `contas-a-pagar-routes.ts` (03-07) é a receita pronta de uma superfície nova
  autenticada no Express do `automation/`, com o comentário de cabeçalho
  explicando por que ela não importa o módulo do contrato v1.
- O design system do `apps/web` (`src/design/`) tem tabela, esqueleto de
  carregamento, ícones e tokens verificados por script — as oito telas são
  composição, não CSS novo.
- `apps/web/src/features/shell/rotas.ts` já tem teste de rotas; `/financeiro`
  entra por lá e o teste cobre a navegação de graça.

### Established Patterns
- `apps/web` conhece **um** backend. Qualquer segunda origem no navegador é
  regressão de arquitetura, não atalho.
- Erro de fronteira é sanitizado e fixo; `pg.message`, stack e eco do corpo
  nunca voltam ao cliente (T-3-14).
- Scripts e testes que dependem de rede pulam sem variável de ambiente; nada de
  teste que só passa com a VPS no ar.
- O domínio é puro: nenhuma chamada de rede entra em `packages/dominio`. Esta
  fase não deveria tocar o domínio de forma alguma — se um plano precisar, é
  sinal de que algo foi modelado como ontologia sem querer.

### Integration Points
- `apps/web` (Server Component ou route handler) → `GET /financeiro/*` no
  `apps/api` (JWT do Membro) → `GET /v1/leituras/*` no `automation/` (Bearer de
  serviço) → Supabase `public`.
- Upload: `apps/web` → `POST /financeiro/extratos` no `apps/api` → webhook de
  extrato do `automation/`.
- Navegação: `features/shell/navegacao.ts` ganha a seção Financeiro, visível
  conforme D4-14.

</code_context>

<specifics>
## Specific Ideas

- O Financeiro deve reconhecer as telas. Mesmos nomes, mesma ordem de colunas,
  mesmas contagens — mudou o visual e o caminho dos dados, não o que se lê.
- A tela tem que saber dizer "não consegui falar com o backend financeiro". O
  painel de hoje, quando o Supabase recusa, mostra lista vazia; isso já custou
  confiança e não se repete.
- O worktree do `financeiro-tria` tem 89 arquivos modificados sem relação com
  isto. Cada plano lista explicitamente os arquivos que toca e nunca limpa,
  formata ou commita o resto.

</specifics>

<deferred>
## Deferred Ideas

- Modelar `transacoes`, `produtos` ou plano de contas na ontologia — DEC-16
  decidiu que não, e reabrir isso é projeto próprio, não fase.
- Tela de Integrações e de Notificações (as duas parcialmente ocultas hoje) —
  fora das oito de TELA-01.
- Editor de RAG / `conciliador_contas` pela tela — capacidade nova.
- Substituir as 13 tabelas vetoriais por empresa e as 7 views `_v` pela
  `conciliador_contas` unificada — limpeza do legado, sem dono nesta fase.
- Descartar as cinco tabelas de observabilidade (`automation_runs/steps/events`,
  `approval_tasks`, `automation_workflows`) que o inventário §5.7 mostra
  praticamente sem uso — decisão de legado, não de tela.
- Realtime e cache das leituras — reavaliar com latência medida depois do corte.
- Empresa como Integração com credencial própria (CAND-01) — Phase 5, TEN-01.

</deferred>

---

*Phase: 4-As outras telas do financeiro-tria*
*Context gathered: 2026-09-23*
