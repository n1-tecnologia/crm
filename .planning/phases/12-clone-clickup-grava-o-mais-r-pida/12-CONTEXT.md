# Phase 12: Clone ClickUp: gravação mais rápida - Context

**Gathered:** 2026-10-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Medir quanto leva uma gravação e cortar o custo onde ele está. Hoje toda gravação (de um nome de Lista a um Status de Tarefa) hidrata o Espaço de Trabalho inteiro, roda a operação, disputa uma única revisão por Espaço e só então a tela mostra a mudança. São as subtarefas **2.2.1–2.2.5 e 2.2.10** da Sessão 2 (parte C) de `docs/09-planejamento/TAREFAS-POR-SESSAO.md`, pelo **caminho B** da 2.2.2 (ficar em `plataforma.registros`).

Duas camadas, domínio intacto (esta fase não muda **o que a coisa é**, só como se guarda e como a tela reage):

1. **Backend (`apps/api`)** — `executar()` ganha a medição por etapa (2.2.1) e passa a **travar o Espaço no começo** (2.2.3); um comando mede os quatro gestos em produção; `rotas/operacoes.ts` registra a medição no log.
2. **Interface (`apps/web`)** — `store.ts` e `transporte.ts`: várias chamadas de um gesto sem re-hidratar (2.2.4); a mudança aparece na hora, com fila de envio (2.2.5).

**Fora do escopo (decidido nesta discussão):**
- **Caminho A** (tabelas próprias de Espaço, Pasta e Lista, 2.2.6–2.2.9): descartado. Só acelera gravar contêiner, que é raro. Se a medição mostrar gesto de contêiner lento por outro motivo, vira item novo, não o A.
- **Caminho C** (tabelas para a Estrutura inteira, 8 a 10 dias): fora daqui. Se `hidratar` passar de 300 ms na mediana, é registrado como fase própria no ROADMAP (D-06).
- **Empurrão de mudanças entre telas abertas** (trocar a pergunta a cada 5 s por tempo real): é da **3.8** ("Tempo real"). O texto da 2.2.5 diz "3.4"; o número certo no documento é 3.8.
- **Medir o tempo do clique até a tela** no navegador: fora; a prova da 2.2.5 é o teste do store (D-02).

**Independência das Fases 10 e 11:** a Fase 10 já está em produção (`010` aplicada, PR #1 publicado em 29/10), então a ordem entre A e a `010` deixou de importar. A Fase 11 não toca `executar()` nem o store.

</domain>

<decisions>
## Implementation Decisions

### Como medir (2.2.1, 2.2.10)

- **D-01:** **Um comando repete os gestos.** Um script em `apps/api` (`npm run ... -w @n1/api`, nome a critério do planejador) roda **a partir da VPS** contra a API real e repete **10 vezes cada** os quatro gestos: criar Lista, renomear Lista, enviar à lixeira um Espaço com Listas e mudar o Status de uma Tarefa. Imprime a tabela (mediana e pior caso por etapa). **O mesmo comando serve para o "depois" (2.2.10)**, para a comparação ser justa. Descartados: o dono clicar 40 vezes (cada clique sai diferente); só homologação (o número não é o de produção).
- **D-02:** **A medição registra as etapas do servidor e o tempo total do pedido.** Etapas: `hidratar` (inclusive a projeção dos Canais, que também roda por tentativa), a operação, a trava da revisão, `gravar`, número de tentativas e de linhas lidas (2.2.1 item 1), **mais o recorte por Membro da Fase 9 como etapa própria** (`visibilidadePara` + `recortarDiferenca` + `recortarValor`, em `rotas/operacoes.ts`, que roda depois de `executar()`). O tempo total do pedido é medido pelo comando, de ponta a ponta; a diferença entre o total e as etapas mostra o que sobra fora (rede, serialização). **Não** se mede o tempo do clique até a tela no navegador: a prova do "mostrar na hora" fica no teste do store (D-13).
- **D-03:** **A medição fica no código, sempre ligada, no log do servidor.** Cada gravação escreve em `request.log.info` o nome da operação e o tempo de cada etapa. **Não vai na resposta HTTP.** Atenção do scout: `rotas/operacoes.ts` devolve `{ ...resultado, diferenca, ... }` (~linha 386–391): um campo `medicao` em `ResultadoTransacao` **vazaria para o corpo** se ninguém o tirar. O planejador garante, com teste, que `medicao` não aparece na resposta. Descartados: ligar por variável de ambiente (ligar worker na VPS exige drop-in do systemd, ver [[deploy-da-api-e-manual-na-vm]]); remover ao fechar a fase (a próxima medição, por exemplo antes de decidir a sessão C, começaria do zero).
- **D-04:** **O comando grava num Espaço de teste dentro do `ws_n1`**, para `hidratar` ter o tamanho real do banco (o comentário de `repositorio.ts` cita "cerca de 900 registros e 475 KB", de antes do Financeiro e do CRM). Ele cria o Espaço, a Lista e a Tarefa de teste, roda os gestos e manda tudo para a lixeira no fim. **Rastro aceito pelo dono:** linhas de Atividade e o Espaço de teste na lixeira em produção. O planejador desenha como o comando se autentica na API (há `persistencia/credenciais-de-servico.ts` e a credencial do `automation/`) sem guardar segredo em arquivo. Descartados: Espaço de Trabalho só para medir (nasce quase vazio, `hidratar` sai rápido demais); homologação (outro banco e outra rede).
- **D-05 (tamanho do banco, 2.2.1 item 4):** a consulta `select colecao, count(*), pg_size_pretty(sum(pg_column_size(dados))::bigint) from plataforma.registros where workspace_id = '<id>' group by colecao …` roda em produção e o total entra na tabela. **O conector do Supabase do claude.ai ainda lista só `rede-social` e `dev_igor_rede_social`** (não a organização "N1"; ver [[supabase-projeto-n1-crm]]), então a consulta não roda por ele: entra no comando de medição (que já tem `DATABASE_URL` na VPS) ou como passo do dono.

### Regra para escolher o caminho (2.2.2)

- **D-06 (planejamento):** **O plano já nasce com o B e uma parada depois da medição.** Ordem: medir (2.2.1) → **parada `[BLOCKING]` com a tabela "antes" na mão do dono** → 2.2.3, 2.2.4, 2.2.5 → medir de novo (2.2.10). O B vale mesmo com `hidratar` rápido, porque a trava, a re-hidratação repetida e a espera da tela existem de qualquer jeito. Descartado: planejar só a medição agora (dois ciclos de planejar e executar para uma fase de cerca de 2 dias). — **Reversibility:** reversible — a parada deixa o dono mudar de rota com os números.
- **D-07 (limite do C):** **Se `hidratar` passar de 300 ms na mediana, registrar a sessão C no ROADMAP como fase própria e seguir com o B nesta fase.** O B ainda corta o custo da repetição e a espera da tela. O dono vê o número na parada e pode mudar de ideia. Descartados: parar e decidir (a fase fica esperando conversa); trazer o C para cá (8 a 10 dias, mexe na maior parte do domínio).
- **D-08 (meta):** **O dono fixa a meta na parada, vendo o "antes"**, e ela fica registrada **na seção "Meta (fixada na parada)" ao fim deste arquivo, antes de o B começar**. Motivo: hoje não há número com sentido, a distância VPS↔banco em `us-west-2` (decisão da 02-15: permanecer em us-west-2) pode ser a maior parte do tempo. O dono pode dizer um número por gesto ou que o ganho que o B der basta. O "depois" é comparado a essa meta.

### Duas pessoas gravando juntas (2.2.3, 2.2.4)

- **D-09 (2.2.3, trava no começo):** Logo depois de `inicioDaTransacao()`, `select revisao from plataforma.workspaces where workspace_id = $1 for update`, e só então `hidratar`. O `update … revisao = revisao + 1` deixa de conferir a revisão (a linha já está travada). **Uma tentativa só, sem repetir:** tentar de novo só repetiria a mesma espera. A espera pela vez tem o prazo de hoje (`lock_timeout` = Q/3 = **10 s** com Q = 30 s); passou disso, o `55P03` vira conflito (**409**, mensagem "Outra alteração entrou antes desta. Tente de novo.") e a tela re-hidrata, como no conflito de hoje. Hoje a pessoa podia ficar cerca de 30 s parada (3 tentativas); aqui no máximo ~10 s, e a conexão volta ao pool mais cedo (o pool tem 10). O planejador **confere os chamadores que passam `tentativas`** e decide o que o parâmetro vira. Atualizar "Os prazos do servidor e a trava esgotada" em `apps/api/src/persistencia/CONTEXT.md`. Descartados: manter 3 tentativas; esperar ~3 s.
- **D-10 (quem trava):** **Todas as gravações travam no começo, menos as importações longas.** Tela (`POST /operacoes`), agendador, ponte do Financeiro e formulários públicos travam (gravações de frações de segundo). **As importações manuais, que rodam minutos com `DATABASE_QUERY_TIMEOUT_MS=0`** (`importar-contas-a-pagar`, `importar-contas-a-receber`, `financeiro/importar`, e o que o planejador achar de igual natureza em `bootstrap/`), **ficam como hoje** (revisão otimista), para não segurar o `ws_n1` inteiro durante a importação: com a trava no começo, cada gravação dos outros esperaria 10 s e daria erro. Isso exige que `executar()` suporte os dois regimes (por opção do chamador); o planejador desenha e mapeia os ~30 chamadores de `executar(`. — **Reversibility:** costly — o desenho do `executar()` com dois regimes é contrato interno de ~30 chamadores.
- **D-11 (2.2.4, várias chamadas num gesto):** como no documento: `gravar` (`transporte.ts`) passa a devolver **a lista de respostas, uma por chamada**, parando na primeira que não for `diferenca`; `enviar` (`store.ts`) aplica as diferenças **em ordem**, cada uma só se a `revisaoAnterior` dela for a revisão atual do store; se uma não encaixar, aí sim re-hidrata. Caso conhecido: `(shell)/page.tsx` (cria a Sessão de Chat e manda a mensagem). A ação em lote de Status não entra (é uma operação só).
- **D-12 (o recarregamento de quem grava depois fica):** Quando outra pessoa grava no meio, a tela de quem gravou depois **continua recarregando o Espaço** (`GET /estado`): ela não tem a mudança da outra pessoa e não aplica a sua por segurança (`revisaoAnterior` não bate). Reduzir isso exigiria histórico de revisões no servidor ou aplicar diferença com buraco de ordem: capacidade nova. **Resolve na 3.8 (tempo real).** Esta fase só garante que a medição de `GET /estado` apareça na tabela. — **Reversibility:** reversible — é não fazer algo.

### Mostrar a mudança na hora (2.2.5)

- **D-13 (modelo e escopo):** O store guarda **dois estados**: `confirmado` (o que o servidor já devolveu) e `data` (o que a tela mostra). Uma operação aceita localmente vira o novo `data` na hora. Quando a diferença volta, aplica-se em `confirmado` e **refazem-se por cima as chamadas ainda pendentes**, pelo registro `OPERACOES` (`@n1/dominio/operations/registro`), para obter o novo `data`. **Vale para todos os gestos que usam `run()`** (141 usos de `useRun()` no scout) **com uma lista de exceções**: operação cujo resultado local difira do do servidor por algo que só o servidor tem volta a esperar. O planejador monta a lista a partir de um levantamento (Automação que roda no servidor, ponte do Agente, ids consumidos por outra gravação) e a deixa explícita no código com o motivo de cada uma. Descartados: só Estrutura e Tarefa (telas com dois comportamentos); só os quatro gestos medidos (vira piloto). A prova é o teste do `store.test.ts` com transporte lento (o "pronto quando" da 2.2.5): depois de `run(createList)`, `data.lists` já tem a Lista antes de o transporte responder; se o transporte devolver `ok: false`, a Lista some e `lastResult.error` traz a mensagem.
- **D-14 (recusa):** **Se o servidor recusa, a mudança some sozinha e aparece o erro** pelo mesmo canal de hoje (`lastResult`), com a mensagem do servidor: `data` volta a ser `confirmado` mais as pendentes. Sem botão "Tentar de novo": os 141 gestos não têm lugar para esse estado. Consequência aceita: quem estava digitando em cima do item perde o que não foi confirmado. Se uma pendente que depende da recusada falhar ao ser refeita por cima, ela também some, com o erro.
- **D-15 (item criado):** **Registro criado localmente aparece, mas só abre depois de confirmado.** A Lista nova aparece na árvore (`StructureTree`, `features/shell/app-shell.tsx`) com visual de "salvando" e **sem link** até o servidor devolver o id verdadeiro (a cópia local gera um id que pode não ser o do servidor, porque a ponte do Agente e outras gravações consomem ids), então vira normal. Vale para qualquer registro que a operação cria. Nunca leva a uma página de id que não existe. O diálogo de criação continua esperando o id do servidor para navegar (`runConfirmado`, 9 usos). Dica de derivação, sem estado novo guardado: "pendente" é o id que está em `data` e ainda não em `confirmado`.
- **D-16 (fila):** **Os pedidos de um mesmo store saem um de cada vez, na ordem do clique.** O segundo só sai quando o primeiro foi respondido; as respostas voltam em ordem e a revisão encaixa sem recarregar tudo. A tela já mostra os dois. Se o primeiro é recusado, o segundo é refeito por cima do `confirmado` (D-14). Hoje os pedidos saem em paralelo, com a mesma `revisao`, e uma resposta fora de ordem faz a tela recarregar tudo, justamente o caso que a fase quer evitar. `verificarRevisao` continua sem perguntar enquanto houver `pendentes`.

### Requisitos derivados (proposta; registrar em `REQUIREMENTS.md` ao planejar)

O ROADMAP deixou "Requirements: TBD (definidos no discuss)". Prefixo `GRV`, sem uso anterior em `REQUIREMENTS.md`:

| ID | Cobre | Critério |
|---|---|---|
| GRV-01 | 2.2.1, D-01..D-05 | Cada gravação escreve no log o nome da operação e o tempo de `hidratar`, operação, trava, `gravar`, recorte, tentativas e linhas lidas; `medicao` **não aparece** no corpo de `POST /operacoes` (teste); o comando repete os quatro gestos 10 vezes e imprime mediana e pior caso por etapa, mais o tempo total do pedido; a tabela "antes" e o tamanho real de `plataforma.registros` estão em `12-PROVAS.md` |
| GRV-02 | 2.2.2, D-06..D-08 | A parada `[BLOCKING]` aconteceu com a tabela na mão do dono; a meta está registrada na seção "Meta" deste arquivo; se `hidratar` passou de 300 ms na mediana, a sessão C está no ROADMAP |
| GRV-03 | 2.2.3, D-09, D-10 | Teste em `unidade-de-trabalho-trava.test.ts`: duas `executar()` simultâneas no mesmo Espaço gravam com uma tentativa cada e `hidratar` roda exatamente 2 vezes (pula sem `DATABASE_URL`); a trava esgotada (`55P03`) vira 409 sem repetir; as importações longas seguem no regime otimista; `CONTEXT.md` da persistência atualizado |
| GRV-04 | 2.2.4, D-11 | Teste em `store.test.ts` com transporte falso: um `run` com duas chamadas aplica as duas diferenças e **não** chama `hidratar` |
| GRV-05 | 2.2.5, D-13..D-16 | Teste em `store.test.ts` com transporte lento: `data.lists` já tem a Lista antes de o transporte responder; com `ok: false` ela some e `lastResult.error` traz a mensagem; dois `run` seguidos saem um de cada vez, em ordem; o item criado aparece sem link até confirmado; a lista de exceções está no código com o motivo de cada uma |
| GRV-06 | 2.2.10, D-01 | A tabela de `12-PROVAS.md` tem as colunas "antes" e "depois" preenchidas, com o mesmo comando, e o "depois" comparado à meta de D-08 |

### Claude's Discretion

- Nome do comando e do módulo (`medir-gravacao.cli.ts` ou similar), formato exato da linha de log (campos e unidade, em ms), e como o comando se autentica na API sem guardar segredo em arquivo.
- Forma interna da trava no começo em `executar()` e do regime otimista das importações (D-10); o que `tentativas` vira.
- A **lista de exceções** do "mostrar na hora" (D-13): critério e conteúdo, a partir do levantamento dos 141 usos de `run()`.
- Como a árvore e as outras telas sinalizam o "salvando" (visual discreto, sem texto novo longo) e como derivam o "pendente" de `data` × `confirmado` (D-15).
- **Aviso ao fechar a aba com gravações pendentes** (`beforeunload` quando `pendentes > 0`): o dono não discutiu e não rejeitou. Recomendação: incluir, é barato e fecha o furo de a mudança mostrada na hora se perder em silêncio. O planejador decide e registra.
- Custo do `structuredClone` extra de `confirmado` (hoje a cópia custa sub-ms para ~475 KB): conferir na medição se o dobro de estado pesa na tela.
- Quantos planos e em que ondas. Ordem obrigatória: instrumentação e comando → publicar na VPS → **medir "antes"** → **parada** → trava (`unidade-de-trabalho.ts`) → `gravar`/`enviar` (2.2.4) → `confirmado`/`data` e fila (2.2.5, sobre o mesmo `store.ts`, nunca em paralelo com a 2.2.4) → medir "depois". 2.2.4 e 2.2.5 mexem no mesmo `enviar`: ondas sequenciais.

### Ações do dono (não são código; entram como checkpoints do plano)

- **Publicar a versão com a medição na VPS** antes do "antes" (`apps/api/deploy/publicar.sh`, manual, só quando o dono mandar; ver [[deploy-da-api-e-manual-na-vm]]). Publicar de novo com a trava e o store para medir o "depois". Hoje o `deploy-api` do GitHub falha por `VPS_HOST` vazio; a via real é a manual.
- **Parada depois do "antes" (D-06..D-08):** olhar a tabela, dizer a meta, confirmar que o B segue ou mandar replanejar.
- **Tamanho do banco (D-05):** se o comando não puder rodar a consulta, o dono roda no `psql` da VPS.
- Os rastros do Espaço de teste na lixeira de produção (D-04) são aceitos; se o dono quiser esvaziá-los depois, é decisão dele.

### Meta (fixada na parada)

_A preencher pelo dono depois da medição "antes" (D-08), antes de a 2.2.3 começar._

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo da fase (fonte principal)
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` linhas ~503–585 (tarefa 2.2, subtarefas 2.2.1–2.2.10) — "Hoje / O que fazer / Pronto quando" de cada uma e as três saídas (A, B, C) da 2.2.2. **Os números de linha de código citados ali deslocaram com as Fases 9 e 10: procurar de novo antes de planejar.** Esta fase cobre 2.2.1–2.2.5 e 2.2.10; 2.2.6–2.2.9 (caminho A) ficam de fora (D).
- `.planning/ROADMAP.md` § Phase 12 — escopo e os três caminhos
- `.planning/phases/10-clone-clickup-cont-ineres-espa-o-pasta-e-lista/10-CONTEXT.md` D-21 — relação com a Fase 10 (agora resolvida: a `010` já foi aplicada)

### Camadas e regras
- `CONTEXT.md` (raiz) — mapa das camadas; esta fase é `apps/api` + `apps/web`, sem tocar o domínio
- `AGENTS.md` e `apps/web/AGENTS.md` — Next.js desta versão tem breaking changes: ler `node_modules/next/dist/docs/` antes de codar páginas
- `apps/api/src/persistencia/CONTEXT.md` — Unidade de Trabalho, "Os prazos do servidor e a trava esgotada (06-13)" (precisa ser atualizada pela 2.2.3), regra das migrações (esta fase não tem migração)
- `apps/api/src/rotas/CONTEXT.md` — a rota de operações e o recorte de `GET /estado`
- `.planning/phases/06-conferencia-do-resumo-e-anexos/06-13-SUMMARY.md` — diagnóstico H4: por que `statement_timeout` e `lock_timeout` ficam abaixo do `query_timeout`; `55P03` é conflito, não exceção
- `.planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-CONTEXT.md` — recorte da resposta de `POST /operacoes` por Membro (SEG-01), que vira etapa própria da medição (D-02)
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` § 3.8 "Tempo real" — onde o empurrão entre telas abertas será resolvido (D-12)

### Código a mudar (confirmado no scout de 2026-10-30)
- `apps/api/src/persistencia/unidade-de-trabalho.ts` (225 linhas: `executar()` com o laço de 3 tentativas, `inicioDaTransacao()`, `55P03`, `ResultadoTransacao`), `repositorio.ts` (`hidratar` e `gravar`; comentário "cerca de 900 registros e 475 KB"), `canais-projetados.ts` (a projeção entra por tentativa), `conexao.ts` (pool de 10, `query_timeout`)
- `apps/api/src/rotas/operacoes.ts` (chamada de `executar()` e `SERVICOS` ~linhas 306–350; o recorte e a resposta ~384–393), `rotas/estado.ts`
- Chamadores de `executar(` a classificar em D-10: `automacoes/scheduler-worker.ts`, `automacoes/invocar-agente.ts`, `rotas/{classificacoes,anexos-da-tarefa,integracao-solicitacoes,estado,formularios-publicos}.ts`, `servicos/{idempotencia,convidar-membro}.ts`, `bootstrap/*.ts`, `importacao/clickup/*.ts`, `importacao/financeiro/*.ts`, `autenticacao/criar-usuario.cli.ts`
- `apps/web/src/dados/store.ts` (395 linhas: `enviar` ~123, `rodarNaCopia` ~202, `verificarRevisao`, `AcompanhanteDaRevisao` ~312), `dados/transporte.ts` (236 linhas: `gravar` ~154 com o laço de chamadas), `dados/store.test.ts`, `dados/transporte.test.ts`
- `apps/web/src/features/shell/app-shell.tsx` (`StructureTree`, para o "salvando" da D-15), `features/estrutura/create-container-dialog.tsx` (`runConfirmado`), `apps/web/src/app/(shell)/page.tsx` (o caso das duas chamadas)
- Testes: `apps/api/src/persistencia/unidade-de-trabalho-trava.test.ts`, `unidade-de-trabalho.test.ts`, `persistencia.test.ts`

### Banco
- `apps/api/migracoes/001-plataforma.sql` — `plataforma.registros` e `plataforma.workspaces` (a coluna `revisao`). Sem migração nesta fase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `inicioDaTransacao()` e `limitesDoPool()`: já derivam `lock_timeout` = Q/3 e `statement_timeout` = 80 % de Q; a trava no começo herda os mesmos prazos.
- `unidade-de-trabalho-trava.test.ts`: molde com pool, repositório e outbox falsos (sem banco) para provar o `55P03` na nova trava; `unidade-de-trabalho.test.ts` e `persistencia.test.ts` para o caso concorrente contra Postgres real (pulam sem `DATABASE_URL`).
- `apps/api/src/observabilidade/` (`log.ts`, `metricas.ts`, `reconciliacao.cli.ts`): o padrão de módulo e de comando `npm run` (`reconciliar`, `automacoes:previa`) para o comando de medição.
- `gravarChamadas` e o registro `OPERACOES` (`@n1/dominio/operations/registro`): já capturam as chamadas de um `run`; servem para refazer as pendentes por cima de `confirmado`.
- `runConfirmado` (9 usos): já separa "resultado local" de "resultado do servidor"; o diálogo de criação continua nele.
- `verificarRevisao` / `INTERVALO_DA_REVISAO_MS` (5 s): já se cala enquanto `pendentes > 0`; segue assim.

### Established Patterns
- `executar()` devolve conflito como **valor** (`{ ok: false, conflito: true }`, 409 na rota); a recusa do domínio é resposta legítima (rollback limpo). A trava no começo mantém isso.
- Os prazos do servidor ficam abaixo do `query_timeout` do cliente, e `55P03` fora da revisão sobe como exceção; dentro da trava da revisão é conflito.
- O servidor **ignora** o campo `revisao` do corpo (`BODY` em `operacoes.ts`): quem decide aplicar ou re-hidratar é o cliente, por `revisaoAnterior` (D-06 da Fase 1).
- O store aplica a diferença **em lugar** (`aplicarDiferenca`, sem trocar a referência das coleções) e re-hidrata quando a `revisaoAnterior` não bate; a revisão só cresce.
- Teste de persistência pula sem `DATABASE_URL` (`temBanco ? describe : describe.skip`, D-DEC-09).

### Integration Points
- **O spread de `resultado` em `operacoes.ts`** (~linha 386) é o ponto onde `medicao` poderia vazar para o corpo da resposta (D-03).
- `rotas/operacoes.ts` roda o recorte **depois** de `executar()`; a etapa "recorte" da medição nasce na rota, não na Unidade de Trabalho.
- `executar()` tem ~30 chamadores com necessidades diferentes (tela, agendador, ponte, formulário público, importação longa): D-10 mexe no contrato de todos.
- 2.2.4 e 2.2.5 mexem no mesmo `enviar` de `store.ts`: ondas sequenciais.
- O estado "pendente" de D-15 cruza o store e a árvore (`app-shell.tsx`); `data` já é lido por ~22 arquivos de tela, por isso `data` continua sendo o que a tela mostra e `confirmado` é novo e interno ao store.

</code_context>

<specifics>
## Specific Ideas

- O dono quer **números antes de opinião**: a decisão vem da tabela, e a meta de "rápido o bastante" é dele, dita vendo o "antes".
- "Criar uma Lista aparece na árvore antes da resposta do servidor": o gesto de referência do "pronto" da 2.2.
- O dono aceita deixar rastro de teste em produção (Espaço de teste na lixeira do `ws_n1`) em troca de um número honesto.
- O dono prefere que o erro apareça claro (a mudança some, o erro fica) a ganhar um estado "não salvo" novo em cada tela.

</specifics>

<deferred>
## Deferred Ideas

- **Caminho A** (tabelas próprias de Espaço, Pasta e Lista, 2.2.6–2.2.9, 4 a 5 dias): descartado. Só vira assunto se a medição mostrar que gesto de contêiner é lento por motivo que as tabelas resolvam.
- **Sessão C** (tabelas para a Estrutura inteira, 8 a 10 dias): vira fase própria **se** `hidratar` passar de 300 ms na mediana (D-07).
- **Aplicar a diferença na tela mesmo com a revisão à frente** (histórico de revisões no servidor): capacidade nova, junto da **3.8 (tempo real)**.
- **Medir o clique até a tela no navegador** (marca no `apps/web`): descartado nesta fase; a prova do "mostrar na hora" é o teste do store.
- **Botão "Tentar de novo" em mudança recusada** (item "não salvo"): descartado; exigiria um estado novo em cada tela.
- **Itens da 2.7** sobre gravação: nenhum trazido pelo dono.

### Reviewed Todos (not folded)
None — nenhum todo casou com esta fase.

</deferred>

---

*Phase: 12-clone-clickup-grava-o-mais-r-pida*
*Context gathered: 2026-10-30*
