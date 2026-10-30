# Phase 12: Clone ClickUp: gravação mais rápida - Research

**Researched:** 2026-10-30
**Domain:** Persistência transacional (`apps/api`: Unidade de Trabalho, lock por Espaço, medição) e store otimista da interface (`apps/web`: `store.ts`, `transporte.ts`). Pesquisa **interna** (leitura de código); nenhuma biblioteca nova.
**Confidence:** HIGH para o mapa do código, a mecânica do lock no Postgres (confirmada em documentação e em experimento local) e a lista de chamadores; MEDIUM para o desenho do comando de medição (há uma tensão D-01 × D-03, ver Open Questions) e para a lista de exceções de D-13 (critério firme, conteúdo a conferir).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Como medir (2.2.1, 2.2.10)**

- **D-01:** **Um comando repete os gestos.** Um script em `apps/api` (`npm run ... -w @n1/api`, nome a critério do planejador) roda **a partir da VPS** contra a API real e repete **10 vezes cada** os quatro gestos: criar Lista, renomear Lista, enviar à lixeira um Espaço com Listas e mudar o Status de uma Tarefa. Imprime a tabela (mediana e pior caso por etapa). **O mesmo comando serve para o "depois" (2.2.10)**, para a comparação ser justa. Descartados: o dono clicar 40 vezes (cada clique sai diferente); só homologação (o número não é o de produção).
- **D-02:** **A medição registra as etapas do servidor e o tempo total do pedido.** Etapas: `hidratar` (inclusive a projeção dos Canais, que também roda por tentativa), a operação, a trava da revisão, `gravar`, número de tentativas e de linhas lidas (2.2.1 item 1), **mais o recorte por Membro da Fase 9 como etapa própria** (`visibilidadePara` + `recortarDiferenca` + `recortarValor`, em `rotas/operacoes.ts`, que roda depois de `executar()`). O tempo total do pedido é medido pelo comando, de ponta a ponta; a diferença entre o total e as etapas mostra o que sobra fora (rede, serialização). **Não** se mede o tempo do clique até a tela no navegador: a prova do "mostrar na hora" fica no teste do store (D-13).
- **D-03:** **A medição fica no código, sempre ligada, no log do servidor.** Cada gravação escreve em `request.log.info` o nome da operação e o tempo de cada etapa. **Não vai na resposta HTTP.** Atenção do scout: `rotas/operacoes.ts` devolve `{ ...resultado, diferenca, ... }` (~linha 386–391): um campo `medicao` em `ResultadoTransacao` **vazaria para o corpo** se ninguém o tirar. O planejador garante, com teste, que `medicao` não aparece na resposta. Descartados: ligar por variável de ambiente (ligar worker na VPS exige drop-in do systemd, ver [[deploy-da-api-e-manual-na-vm]]); remover ao fechar a fase (a próxima medição, por exemplo antes de decidir a sessão C, começaria do zero).
- **D-04:** **O comando grava num Espaço de teste dentro do `ws_n1`**, para `hidratar` ter o tamanho real do banco (o comentário de `repositorio.ts` cita "cerca de 900 registros e 475 KB", de antes do Financeiro e do CRM). Ele cria o Espaço, a Lista e a Tarefa de teste, roda os gestos e manda tudo para a lixeira no fim. **Rastro aceito pelo dono:** linhas de Atividade e o Espaço de teste na lixeira em produção. O planejador desenha como o comando se autentica na API (há `persistencia/credenciais-de-servico.ts` e a credencial do `automation/`) sem guardar segredo em arquivo. Descartados: Espaço de Trabalho só para medir (nasce quase vazio, `hidratar` sai rápido demais); homologação (outro banco e outra rede).
- **D-05 (tamanho do banco, 2.2.1 item 4):** a consulta `select colecao, count(*), pg_size_pretty(sum(pg_column_size(dados))::bigint) from plataforma.registros where workspace_id = '<id>' group by colecao …` roda em produção e o total entra na tabela. **O conector do Supabase do claude.ai ainda lista só `rede-social` e `dev_igor_rede_social`** (não a organização "N1"; ver [[supabase-projeto-n1-crm]]), então a consulta não roda por ele: entra no comando de medição (que já tem `DATABASE_URL` na VPS) ou como passo do dono.

**Regra para escolher o caminho (2.2.2)**

- **D-06 (planejamento):** **O plano já nasce com o B e uma parada depois da medição.** Ordem: medir (2.2.1) → **parada `[BLOCKING]` com a tabela "antes" na mão do dono** → 2.2.3, 2.2.4, 2.2.5 → medir de novo (2.2.10). O B vale mesmo com `hidratar` rápido, porque a trava, a re-hidratação repetida e a espera da tela existem de qualquer jeito. Descartado: planejar só a medição agora (dois ciclos de planejar e executar para uma fase de cerca de 2 dias). — **Reversibility:** reversible — a parada deixa o dono mudar de rota com os números.
- **D-07 (limite do C):** **Se `hidratar` passar de 300 ms na mediana, registrar a sessão C no ROADMAP como fase própria e seguir com o B nesta fase.** O B ainda corta o custo da repetição e a espera da tela. O dono vê o número na parada e pode mudar de ideia. Descartados: parar e decidir (a fase fica esperando conversa); trazer o C para cá (8 a 10 dias, mexe na maior parte do domínio).
- **D-08 (meta):** **O dono fixa a meta na parada, vendo o "antes"**, e ela fica registrada **na seção "Meta (fixada na parada)" ao fim deste arquivo, antes de o B começar**. Motivo: hoje não há número com sentido, a distância VPS↔banco em `us-west-2` (decisão da 02-15: permanecer em us-west-2) pode ser a maior parte do tempo. O dono pode dizer um número por gesto ou que o ganho que o B der basta. O "depois" é comparado a essa meta.

**Duas pessoas gravando juntas (2.2.3, 2.2.4)**

- **D-09 (2.2.3, trava no começo):** Logo depois de `inicioDaTransacao()`, `select revisao from plataforma.workspaces where workspace_id = $1 for update`, e só então `hidratar`. O `update … revisao = revisao + 1` deixa de conferir a revisão (a linha já está travada). **Uma tentativa só, sem repetir:** tentar de novo só repetiria a mesma espera. A espera pela vez tem o prazo de hoje (`lock_timeout` = Q/3 = **10 s** com Q = 30 s); passou disso, o `55P03` vira conflito (**409**, mensagem "Outra alteração entrou antes desta. Tente de novo.") e a tela re-hidrata, como no conflito de hoje. Hoje a pessoa podia ficar cerca de 30 s parada (3 tentativas); aqui no máximo ~10 s, e a conexão volta ao pool mais cedo (o pool tem 10). O planejador **confere os chamadores que passam `tentativas`** e decide o que o parâmetro vira. Atualizar "Os prazos do servidor e a trava esgotada" em `apps/api/src/persistencia/CONTEXT.md`. Descartados: manter 3 tentativas; esperar ~3 s.
- **D-10 (quem trava):** **Todas as gravações travam no começo, menos as importações longas.** Tela (`POST /operacoes`), agendador, ponte do Financeiro e formulários públicos travam (gravações de frações de segundo). **As importações manuais, que rodam minutos com `DATABASE_QUERY_TIMEOUT_MS=0`** (`importar-contas-a-pagar`, `importar-contas-a-receber`, `financeiro/importar`, e o que o planejador achar de igual natureza em `bootstrap/`), **ficam como hoje** (revisão otimista), para não segurar o `ws_n1` inteiro durante a importação: com a trava no começo, cada gravação dos outros esperaria 10 s e daria erro. Isso exige que `executar()` suporte os dois regimes (por opção do chamador); o planejador desenha e mapeia os ~30 chamadores de `executar(`. — **Reversibility:** costly — o desenho do `executar()` com dois regimes é contrato interno de ~30 chamadores.
- **D-11 (2.2.4, várias chamadas num gesto):** como no documento: `gravar` (`transporte.ts`) passa a devolver **a lista de respostas, uma por chamada**, parando na primeira que não for `diferenca`; `enviar` (`store.ts`) aplica as diferenças **em ordem**, cada uma só se a `revisaoAnterior` dela for a revisão atual do store; se uma não encaixar, aí sim re-hidrata. Caso conhecido: `(shell)/page.tsx` (cria a Sessão de Chat e manda a mensagem). A ação em lote de Status não entra (é uma operação só).
- **D-12 (o recarregamento de quem grava depois fica):** Quando outra pessoa grava no meio, a tela de quem gravou depois **continua recarregando o Espaço** (`GET /estado`): ela não tem a mudança da outra pessoa e não aplica a sua por segurança (`revisaoAnterior` não bate). Reduzir isso exigiria histórico de revisões no servidor ou aplicar diferença com buraco de ordem: capacidade nova. **Resolve na 3.8 (tempo real).** Esta fase só garante que a medição de `GET /estado` apareça na tabela. — **Reversibility:** reversible — é não fazer algo.

**Mostrar a mudança na hora (2.2.5)**

- **D-13 (modelo e escopo):** O store guarda **dois estados**: `confirmado` (o que o servidor já devolveu) e `data` (o que a tela mostra). Uma operação aceita localmente vira o novo `data` na hora. Quando a diferença volta, aplica-se em `confirmado` e **refazem-se por cima as chamadas ainda pendentes**, pelo registro `OPERACOES` (`@n1/dominio/operations/registro`), para obter o novo `data`. **Vale para todos os gestos que usam `run()`** (141 usos de `useRun()` no scout) **com uma lista de exceções**: operação cujo resultado local difira do do servidor por algo que só o servidor tem volta a esperar. O planejador monta a lista a partir de um levantamento (Automação que roda no servidor, ponte do Agente, ids consumidos por outra gravação) e a deixa explícita no código com o motivo de cada uma. Descartados: só Estrutura e Tarefa (telas com dois comportamentos); só os quatro gestos medidos (vira piloto). A prova é o teste do `store.test.ts` com transporte lento (o "pronto quando" da 2.2.5): depois de `run(createList)`, `data.lists` já tem a Lista antes de o transporte responder; se o transporte devolver `ok: false`, a Lista some e `lastResult.error` traz a mensagem.
- **D-14 (recusa):** **Se o servidor recusa, a mudança some sozinha e aparece o erro** pelo mesmo canal de hoje (`lastResult`), com a mensagem do servidor: `data` volta a ser `confirmado` mais as pendentes. Sem botão "Tentar de novo": os 141 gestos não têm lugar para esse estado. Consequência aceita: quem estava digitando em cima do item perde o que não foi confirmado. Se uma pendente que depende da recusada falhar ao ser refeita por cima, ela também some, com o erro.
- **D-15 (item criado):** **Registro criado localmente aparece, mas só abre depois de confirmado.** A Lista nova aparece na árvore (`StructureTree`, `features/shell/app-shell.tsx`) com visual de "salvando" e **sem link** até o servidor devolver o id verdadeiro (a cópia local gera um id que pode não ser o do servidor, porque a ponte do Agente e outras gravações consomem ids), então vira normal. Vale para qualquer registro que a operação cria. Nunca leva a uma página de id que não existe. O diálogo de criação continua esperando o id do servidor para navegar (`runConfirmado`, 9 usos). Dica de derivação, sem estado novo guardado: "pendente" é o id que está em `data` e ainda não em `confirmado`.
- **D-16 (fila):** **Os pedidos de um mesmo store saem um de cada vez, na ordem do clique.** O segundo só sai quando o primeiro foi respondido; as respostas voltam em ordem e a revisão encaixa sem recarregar tudo. A tela já mostra os dois. Se o primeiro é recusado, o segundo é refeito por cima do `confirmado` (D-14). Hoje os pedidos saem em paralelo, com a mesma `revisao`, e uma resposta fora de ordem faz a tela recarregar tudo, justamente o caso que a fase quer evitar. `verificarRevisao` continua sem perguntar enquanto houver `pendentes`.

### Claude's Discretion

- Nome do comando e do módulo (`medir-gravacao.cli.ts` ou similar), formato exato da linha de log (campos e unidade, em ms), e como o comando se autentica na API sem guardar segredo em arquivo.
- Forma interna da trava no começo em `executar()` e do regime otimista das importações (D-10); o que `tentativas` vira.
- A **lista de exceções** do "mostrar na hora" (D-13): critério e conteúdo, a partir do levantamento dos 141 usos de `run()`.
- Como a árvore e as outras telas sinalizam o "salvando" (visual discreto, sem texto novo longo) e como derivam o "pendente" de `data` × `confirmado` (D-15).
- **Aviso ao fechar a aba com gravações pendentes** (`beforeunload` quando `pendentes > 0`): o dono não discutiu e não rejeitou. Recomendação: incluir, é barato e fecha o furo de a mudança mostrada na hora se perder em silêncio. O planejador decide e registra.
- Custo do `structuredClone` extra de `confirmado` (hoje a cópia custa sub-ms para ~475 KB): conferir na medição se o dobro de estado pesa na tela.
- Quantos planos e em que ondas. Ordem obrigatória: instrumentação e comando → publicar na VPS → **medir "antes"** → **parada** → trava (`unidade-de-trabalho.ts`) → `gravar`/`enviar` (2.2.4) → `confirmado`/`data` e fila (2.2.5, sobre o mesmo `store.ts`, nunca em paralelo com a 2.2.4) → medir "depois". 2.2.4 e 2.2.5 mexem no mesmo `enviar`: ondas sequenciais.

### Deferred Ideas (OUT OF SCOPE)

- **Caminho A** (tabelas próprias de Espaço, Pasta e Lista, 2.2.6–2.2.9, 4 a 5 dias): descartado. Só vira assunto se a medição mostrar que gesto de contêiner é lento por motivo que as tabelas resolvam.
- **Sessão C** (tabelas para a Estrutura inteira, 8 a 10 dias): vira fase própria **se** `hidratar` passar de 300 ms na mediana (D-07).
- **Aplicar a diferença na tela mesmo com a revisão à frente** (histórico de revisões no servidor): capacidade nova, junto da **3.8 (tempo real)**.
- **Medir o clique até a tela no navegador** (marca no `apps/web`): descartado nesta fase; a prova do "mostrar na hora" é o teste do store.
- **Botão "Tentar de novo" em mudança recusada** (item "não salvo"): descartado; exigiria um estado novo em cada tela.
- **Itens da 2.7** sobre gravação: nenhum trazido pelo dono.
</user_constraints>

<phase_requirements>
## Phase Requirements

O ROADMAP diz "Requirements: TBD"; `REQUIREMENTS.md` não tem o prefixo `GRV` (conferido: a última seção é "Fase 11 — Clone ClickUp: Tarefa (TAR)", e a tabela de Traceability termina em `TAR-07`). O plano deve registrar `GRV-01..06` em `REQUIREMENTS.md` (nova seção "Fase 12 — Clone ClickUp: gravação mais rápida (GRV)", linhas na Traceability com "Phase 12", e atualizar a contagem de "Coverage") e trocar o "TBD" do ROADMAP.

| ID | Descrição (do 12-CONTEXT) | Research Support |
|----|---------------------------|------------------|
| GRV-01 | Log por gravação com etapas; `medicao` fora do corpo; comando repete 4 gestos ×10; tabela "antes" + tamanho de `plataforma.registros` em `12-PROVAS.md` | Seções "Mapa dos chamadores", "Onde medir cada etapa e onde `medicao` vaza", "O comando de medição"; test map em Validation Architecture |
| GRV-02 | Parada `[BLOCKING]` + meta registrada + sessão C no ROADMAP se `hidratar` > 300 ms | Seção "Parada, meta e expectativa do número" (o corpo do `ws_n1` já passa de 900 registros) |
| GRV-03 | Trava no começo; 2 `executar()` simultâneas → 1 tentativa cada, `hidratar` ×2; `55P03` → 409 sem repetir; importações seguem otimistas; `CONTEXT.md` da persistência | Seções "Mapa dos chamadores", "Desenho dos dois regimes", "Fatos do Postgres"; atenção: o teste de concorrência precisa de arquivo próprio (ver Pitfall 6) |
| GRV-04 | `run` com 2 chamadas aplica 2 diferenças sem `hidratar` | Seção "Store: o que muda" (D-11); contrato de `Transporte.gravar` (Open Question 2) |
| GRV-05 | `data.lists` antes do transporte; recusa some + `lastResult`; fila serial; item criado sem link; exceções no código | Seções "Store: o que muda", "Lista de exceções (D-13)", "O 'salvando' na árvore (D-15)" |
| GRV-06 | Tabela "antes/depois" com o mesmo comando, comparada à meta | Seção "O comando de medição" (o "depois" exige publicar de novo) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Diretivas de `./CLAUDE.md` (que importa `CONTEXT.md` da raiz e `AGENTS.md`) e dos `CONTEXT.md`/memória do projeto que o plano deve respeitar [VERIFIED: leitura de CLAUDE.md, CONTEXT.md e AGENTS.md nesta sessão]:

- **Regra de dependência:** `packages/dominio` não depende de ninguém; `apps/web` e `apps/api` dependem do domínio e **nunca um do outro**. Esta fase não toca o domínio: nada de `@n1/dominio` novo; o que a web precisa da API vai por HTTP. A lista de exceções de D-13 mora em `apps/web` (não no domínio).
- **"Onde uma mudança nasce":** como se guarda e como se serve → `apps/api`; como aparece → `apps/web`. Esta fase é só essas duas.
- **`AGENTS.md` ("This is NOT the Next.js you know"):** ler `node_modules/next/dist/docs/` antes de escrever **página** (o diretório existe: `01-app`, `02-pages`, `03-architecture`, …). A fase só mexe em componentes cliente (`store.ts`, `app-shell.tsx`, `linha-da-arvore.tsx`) e não cria rota nem página; o risco é baixo, mas se o `beforeunload` ou a árvore pedirem um hook de navegação do Next, ler o guia antes.
- **Documentos a atualizar:** `apps/api/src/persistencia/CONTEXT.md` (seção "Os prazos do servidor e a trava esgotada (06-13)" e a linha da tabela de `unidade-de-trabalho.ts`, que hoje diz "revisão otimista (3 tentativas)"); `apps/api/src/observabilidade/CONTEXT.md` (o novo comando); `apps/api/src/rotas/CONTEXT.md` (a linha de medição); `apps/web/CONTEXT.md` (o parágrafo de `store.ts`, que descreve o `data` como "só muda quando o diff volta"); `CONTEXT.md` da raiz só se o "Estado atual" ficar mentindo.
- **Banco nos testes (memória do dono):** nunca contra o `.env` (é produção). Testes de banco rodam num Postgres de Docker local (`crm-n1-pg-12NN`) com `DATABASE_URL` e `DATABASE_URL_MIGRACAO` explícitos; `describeComBanco` (`apps/api/src/testes/banco-crm.ts`) só roda com `localhost`/`127.0.0.1`. Atenção: `persistencia.test.ts` usa `Boolean(process.env.DATABASE_URL)` (não exige local), então **não** servir de molde para o teste de concorrência.
- **Deploy é manual e só quando o dono mandar** (`publicar.sh`, chave `n1_crm_deploy_ci` com passphrase). Nunca ler o `.env`/`api.env` inteiro. Nada rodado contra produção nesta pesquisa.
- **Estilo do repositório:** comentários e mensagens em português, com o id da decisão (`D-09`, `06-13`) no comentário que a justifica; código e identificadores existentes em português (`executar`, `hidratar`, `travada`); novos identificadores seguem isso.
- **Gate de testes:** `npm test` leva 13–17 min e `lote-contas-a-pagar (d)` falha por rede; usar rodadas dirigidas (ver Validation Architecture).

## Summary

**O fluxo de hoje** (verificado lendo `unidade-de-trabalho.ts` inteiro): por tentativa, `executar()` pega uma conexão do pool, abre a transação com os três prazos do servidor, hidrata o Espaço inteiro (1 `select` com `left join`), projeta os Canais da tabela 008 (1 `select` por tentativa; a guarda `to_regclass` só vai ao banco até o primeiro resultado positivo, depois fica em cache de módulo), roda a operação pura, e só **depois** tenta `update … where revisao = $2`. Quem perde a corrida desfaz e recomeça, até 3 vezes (`opcoes.tentativas ?? 3`). **Nenhum chamador de produção passa `tentativas`** (a busca por `tentativas` como argumento de `executar` não acha nada fora do próprio `unidade-de-trabalho.ts`), então o parâmetro pode virar detalhe do regime otimista sem tocar chamador algum.

**O desenho recomendado** para D-09/D-10: `OpcoesExecucao` ganha `regime?: "travado" | "otimista"` (padrão `"travado"`); só os quatro importadores passam `"otimista"`. O corpo de uma tentativa é extraído para uma função; o laço externo roda `1` vez no regime travado e `tentativas ?? 3` no otimista. A trava é uma instrução **separada** de `hidratar` (não pode ser fundida na mesma consulta: em READ COMMITTED o `select` da hidratação enxerga o snapshot do começo da própria instrução, e só uma instrução posterior à trava enxerga o que o escritor anterior confirmou — confirmado na documentação do Postgres e num experimento local descartável, abaixo). A medição entra como **callback** (`opcoes.aoMedir`) e não como campo de `ResultadoTransacao`: o resultado é espalhado em **cinco** pontos de resposta HTTP (3 em `operacoes.ts`, 2 em `anexos-da-tarefa.ts`), e um callback elimina o vazamento por construção; o teste de D-03 continua obrigatório.

**A maior tensão do plano** é de natureza operacional, não de código: D-01 pede o comando "contra a API real" imprimindo mediana e pior caso **por etapa**, e D-03 proíbe a medição na resposta HTTP e a põe só no log do servidor. O comando, rodando como outro processo, não enxerga o log do processo do serviço (o `n1crm` só tem `sudo` para `journalctl … -n 80`). A saída que respeita D-03 e produz a tabela é o comando **subir o próprio Fastify** (`buildApp`) numa porta efêmera de loopback, na VPS, contra o mesmo banco, com o destino do logger capturado e `verificarToken` injetado (sem segredo nenhum). Isso desvia da leitura literal de "API real" (é o mesmo código, o mesmo banco e a mesma rede, mas outro processo), então é **Open Question 1** para o dono confirmar no plano.

**Primary recommendation:** Planejar em 8 planos/ondas sequenciais conforme a ordem obrigatória do CONTEXT: (1) instrumentação (`aoMedir`, log, teste de não-vazamento) sem mudar regime; (2) comando de medição + `CONTEXT.md`; (3) checkpoint do dono: publicar e medir "antes"; (4) parada `[BLOCKING]` e meta; (5) trava + dois regimes + importadores + `CONTEXT.md` da persistência; (6) `gravar`/`enviar` com lista de respostas (2.2.4); (7) `confirmado`/`data`, fila, exceções, "salvando" e `beforeunload` (2.2.5); (8) publicar, medir "depois", `12-PROVAS.md`. A suíte web inteira roda em 13 s e a da API sem banco em 52 s: rodar as duas a cada onda, porque D-13 inverte o comportamento que dezenas de testes de tela assumem.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Medir etapas de `executar()` | API / Backend (`persistencia/unidade-de-trabalho.ts`) | — | Só a Unidade de Trabalho enxerga `hidratar`, trava, `gravar`; D-02 |
| Medir o recorte por Membro | API / Backend (`rotas/operacoes.ts`) | — | Roda depois de `executar()`, na rota (D-02) |
| Registrar a medição | API / Backend (`request.log.info`) | — | D-03: log do servidor, nunca no corpo |
| Comando que repete os gestos | API / Backend (`apps/api`, CLI) | Database / Storage (consulta D-05) | D-01; o tamanho do banco é `select` read-only no mesmo comando |
| Trava do Espaço no começo | Database / Storage (`select … for update`) | API / Backend (`executar`) | O Postgres arbitra; a API só pede a trava e traduz `55P03` em 409 |
| Dois regimes de `executar()` | API / Backend | — | Contrato interno entre `executar` e ~30 chamadores (D-10) |
| Lista de respostas por gesto | Browser / Client (`transporte.ts`) | API / Backend (resposta já traz `revisaoAnterior`) | D-11 é só do cliente; o servidor não muda |
| `confirmado`/`data`, fila, replay | Browser / Client (`store.ts`) | — | Estado de tela; o servidor continua a verdade (D-13) |
| "Salvando" na árvore | Browser / Client (`app-shell.tsx`, `linha-da-arvore.tsx`) | — | Derivado de `data` × `confirmado`, sem estado novo no servidor |
| Aviso ao fechar a aba | Browser / Client | — | `beforeunload` é do navegador |

## Standard Stack

Nenhuma biblioteca nova. Tudo já está nos `package.json`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | ^8.23.0 [VERIFIED: apps/api/package.json] | Cliente Postgres; `PoolClient.query` | Já é o cliente de toda a persistência; o `55P03` chega em `erro.code` (`sqlstateDe`) |
| `fastify` | ^5.12.5 [VERIFIED: apps/api/package.json] | Rota `POST /operacoes/:nome`, `request.log` (pino) | `request.log.info` é o canal de D-03; `buildApp({ logger })` aceita `stream` para o teste e para o comando |
| `vite-node` | ^6.0.0 [VERIFIED: apps/api/package.json] | Executa os `.cli.ts` (`npm run … -w @n1/api`) | Molde dos comandos existentes (`reconciliar`, `automacoes:previa`) |
| `vitest` | ^5.0.0 (api, rodando v5.0.1) [VERIFIED: saída `RUN v5.0.1` nesta sessão] | Testes das duas camadas | Já usado; configs `apps/api/vitest.config.mts` e `apps/web/vitest.config.mts` |
| `zustand` | ^5.0.15 [VERIFIED: apps/web/package.json] | `createStore` do `store.ts` | O store já é zustand; `confirmado`/fila entram dentro do mesmo `createStore` |
| `@n1/dominio` (workspace) | * | `OPERACOES`, `aplicarDiferenca`, `gravarChamadas`, `syncIdSequence`, `ehNomeDeOperacao` | Replay de pendentes e validação do nome da operação |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `performance.now()` (global do Node 24 / navegador) | — (Node local v24.14.0 [VERIFIED: `node --version`]) | Cronometrar etapas | Todas as etapas; monotônico, sem biblioteca |
| `structuredClone` (global) | — | Cópia do estado | Já usado em `rodarNaCopia`; é o custo a vigiar (D-13) |
| Docker `postgres:16` | Docker 29.3.1 local [VERIFIED: `docker --version`] | Postgres descartável para o teste de concorrência | Padrão das Fases 10–11 (`crm-n1-pg-NNNN`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Callback `aoMedir` | Campo `medicao` em `ResultadoTransacao` (o texto da 2.2.1) | O campo é o que o documento descreve, mas vaza por 5 pontos de `send(resultado)`; o callback também cobre conflito e exceção (o campo só existe em sucesso/recusa). Aceitável usar o campo **se** a rota o destruturar logo após `executar()` e o teste de corpo existir |
| Comando com Fastify próprio em loopback | Comando falando HTTP com o serviço em `127.0.0.1:3020` | Ver Open Question 1: o segundo é "mais real", mas não consegue ler as etapas (D-03) nem o log (`journalctl` do `n1crm` só `-n 80`) |
| Mesclar a trava no `begin` (uma ida e volta a menos) | Instrução separada `select … for update` | Fusão é micro-otimização opcional (ver Pitfall 9); começar pela forma literal de D-09 |

**Installation:** nenhuma (`npm install` não é necessário). Sem pacote novo, o `package-legitimacy check` não se aplica.

**Version verification:** versões lidas dos `package.json` e do `RUN v5.0.1` do vitest nesta sessão; nenhuma dependência nova foi proposta, então não há `npm view` a registrar.

## Package Legitimacy Audit

Nenhum pacote externo novo é instalado nesta fase (apenas código em TypeScript sobre dependências já presentes). **Packages removed due to SLOP:** none. **Packages flagged SUS:** none.

## Architecture Patterns

### System Architecture Diagram

```
 ── Caminho de uma gravação de tela (depois da fase) ───────────────────────────────

 clique ─► useRun()/useRunConfirmado()
              │ structuredClone(data) ─► operação pura na cópia (gravarChamadas)
              │      recusa local ──► lastResult (nada sai)
              │      aceita ──► data = cópia (já na tela)  ◄─ D-13
              ▼
        fila serial (1 pedido em voo por store)  ◄─ D-16
              │ transporte.gravar(chamadas) ──► POST /operacoes/:nome (1 por chamada, em ordem)
              ▼                                           │
   ┌────────────────────────────── apps/api ──────────────┴──────────────────────────┐
   │ hook JWT → membro → ehNomeDeOperacao → esquema de args                           │
   │   executar(ws, operacao, { eventos, aoMedir })                                   │
   │     conectar (pool max 10) ─► begin + 3 prazos ─► select … for update  ◄─ D-09 │
   │       (espera ≤ lock_timeout 10 s; 55P03 → 409, 1 tentativa)                     │
   │     ─► hidratar ─► projeção Canais ─► operação pura ─► update revisao+1          │
   │     ─► gravar (upsert/delete do diff) ─► eventos ─► commit        [etapas: aoMedir]
   │   recorte por Membro (visibilidadePara + recortar*)                [etapa: rota]  │
   │   request.log.info({ operacao, medicao })   ◄─ D-03 (nunca no corpo)             │
   └───────────────────────────────────────────┬──────────────────────────────────────┘
              ┌── 200 { ok, value, diferenca, revisao, revisaoAnterior, sequencia }
              ▼ (lista de respostas, uma por chamada ◄─ D-11)
        enviar: para cada resposta, em ordem
           diferenca com revisaoAnterior == revisaoDoServidor → aplicarDiferenca(confirmado)
           não encaixa → rehidratar (confirmado = GET /estado)
           ok:false / falha / conflito → tira a pendente, lastResult = erro  ◄─ D-14
           reconstrói data = replay(pendentes restantes, via OPERACOES) sobre confirmado
              ▼
        árvore: id em data e fora de confirmado → linha "salvando", sem link  ◄─ D-15

 ── Importações longas (otimista) ──
 importar-* ─► executar(ws, lote, { regime: "otimista", semEventosDeSaida, aoConfirmar })
              ─► como hoje: sem trava no começo, update … where revisao = $2, até 3 tentativas
```

### Recommended Project Structure
```
apps/api/src/
├── persistencia/
│   ├── unidade-de-trabalho.ts      # regime, trava, aoMedir, MedicaoDaExecucao (tipo)
│   ├── unidade-de-trabalho-trava.test.ts      # ajustar fakes (ver Pitfall 5)
│   └── unidade-de-trabalho-concorrencia.test.ts  # NOVO, describeComBanco, Postgres local
├── rotas/
│   ├── operacoes.ts                # recorteMs + request.log.info; destrutura medição antes de enviar
│   └── operacoes-medicao.test.ts   # NOVO: corpo sem medicao; linha de log com etapas
├── observabilidade/
│   ├── medicao-da-gravacao.ts      # NOVO: puro — mediana/pior caso, formatação da tabela
│   ├── medicao-da-gravacao.test.ts
│   └── medir-gravacao.cli.ts       # NOVO: o comando (package.json: "gravacao:medir")
apps/web/src/
├── dados/
│   ├── store.ts                    # confirmado/data, fila, replay, beforeunload
│   ├── transporte.ts               # gravar devolve lista de respostas
│   ├── operacoes-que-esperam.ts    # NOVO: lista de exceções D-13, com o motivo de cada
│   └── (store.test.ts, transporte.test.ts, operacoes-que-esperam.test.ts)
└── features/shell/
    ├── app-shell.tsx               # TreeSpace/TreeFolder/TreeList: derivar "salvando"
    └── linha-da-arvore.tsx         # prop `salvando` (aria-busy, visual discreto, sem href)
```

### Mapa dos chamadores de `executar(` (D-09/D-10) — entregável 1

Levantamento por `grep` + leitura dos sítios [VERIFIED: leitura de cada chamada nesta sessão]. **Nenhum chamador de produção passa `tentativas`** (todos usam o padrão 3, via `opcoes.tentativas ?? 3`, `unidade-de-trabalho.ts:121`). `DATABASE_QUERY_TIMEOUT_MS=0` só é a prática das importações manuais (`persistencia/CONTEXT.md:54-57`); o serviço da API sempre roda com Q = 30 s (`TEMPO_DE_CONSULTA_PADRAO_MS = 30_000`, `conexao.ts:74`).

| # | Chamador (file:line) | O que grava | Opções hoje | Roda com Q=0? | Regime proposto |
|---|---|---|---|---|---|
| 1 | `rotas/operacoes.ts:320` | `POST /operacoes/:nome` (tela, `SERVICOS` incluso) | `{ eventos }` | Não (processo da API) | **travado** |
| 2 | `servicos/convidar-membro.ts:45` (via `SERVICOS.inviteMember`, `operacoes.ts:237-249`) | convite | nenhuma | Não | **travado** (nota: `aoMedir` precisa passar por `deps` de `convidarMembro`, ou aceitar essa operação sem medição) |
| 3 | `rotas/anexos-da-tarefa.ts:144` | confirmar anexo (`aoConfirmar: consumirSessao`) | `{ aoConfirmar }` | Não | **travado** |
| 4 | `rotas/integracao-solicitacoes.ts:181` | `executarEscrita` (credencial de serviço, `comIdempotencia` por fora) | `{ eventos }` ou `{}` | Não | **travado** |
| 5 | `rotas/classificacoes.ts:208` | decisão por comentário (classificador) | `{ eventos }` | Não | **travado** |
| 6 | `rotas/formularios-publicos.ts:317` | `submitForm` público | `{ eventos, aoConfirmar }` | Não | **travado** (ver Pitfall 4: `55P03` em `consumirSessao … for update` hoje sobe como 500) |
| 7 | `automacoes/scheduler-worker.ts:708` | `rodarAgenda` por Lista/dia | nenhuma | Não | **travado**; é a mais longa das "curtas" — conferir na medição que não passa de poucos segundos |
| 8 | `automacoes/invocar-agente.ts:1143` (`executarNoBanco`; injetável por `opcoes.executarOperacao`) | ponte do Agente | nenhuma | Não | **travado** (a ponte já trata `conflito` com `TENTATIVAS_TRANSITORIAS`) |
| 9 | `bootstrap/solicitacoes.ts:62`, `configuracao-por-empresa.ts:56`, `contas-a-receber.ts:62,173,313`, `formulario-da-solicitacao.ts:73`, `contas-a-pagar.ts:72` | evolvers de configuração (uma transação curta cada) | nenhuma | Não (não há `DATABASE_QUERY_TIMEOUT_MS` nesses arquivos) | **travado** — "de igual natureza" que D-10 manda procurar em `bootstrap/` **não existe**: nenhum é lote longo |
| 10 | `autenticacao/criar-usuario.cli.ts:58` | convite + ativação | nenhuma | Não | **travado** |
| 11 | `importacao/clickup/importar-contas-a-pagar.ts:218` (opções em `:215`) | lotes de contas (milhares de linhas) | `{ aoConfirmar, semEventosDeSaida: true }` | **Sim**, manual | **otimista** |
| 12 | `importacao/clickup/importar-contas-a-receber.ts:204` (`:201`) | lotes de CR | `{ aoConfirmar, semEventosDeSaida: true }` | Sim, manual | **otimista** |
| 13 | `importacao/financeiro/importar.ts:480` (`:477`) | lotes de solicitações | `{ aoConfirmar, semEventosDeSaida: true }` | Sim, manual | **otimista** |
| 14 | `importacao/clickup/corrigir-data-de-pagamento-cr.ts:240` (`:237`) | **uma** `executar()` corrigindo até 240 Tarefas (tudo-ou-nada) | `{ semEventosDeSaida: true }` | Não documentado; CLI manual | **otimista** (recomendado: é "de igual natureza" — lote histórico manual, também `semEventosDeSaida: true`; o ganho de travar é nenhum e o risco é segurar o `ws_n1`) |

Observações: (a) `semEventosDeSaida: true` marca exatamente as linhas 11–14; **não** use essa opção como substituta do `regime` (acoplaria dois conceitos), mas serve de conferência no teste ("todo chamador com `semEventosDeSaida` passa `regime: 'otimista'`"). (b) `rotas/estado.ts` **não** chama `executar` (faz `hidratar` direto, sem transação, `estado.ts:38`); `invocar-agente.ts:1130` também só hidrata (leitura). (c) Testes que chamam `executar` (e2e, `operacoes.test.ts`, `persistencia/*.test.ts`) passam a ter o regime travado por padrão.

**Valores do código a preservar, lidos nesta sessão (verbatim):**
- `unidade-de-trabalho.ts:110`: `const TRAVA_ESGOTADA = "55P03";`
- `unidade-de-trabalho.ts:121`: `const tentativas = opcoes.tentativas ?? 3;`
- `unidade-de-trabalho.ts:106`: `` return `begin; set local idle_in_transaction_session_timeout = ${prazo}; set local statement_timeout = ${instrucao}; set local lock_timeout = ${trava}`; ``
- `unidade-de-trabalho.ts:174` (e `:179`): `ultimo = { ok: false, conflito: true, error: "Outra alteração entrou antes desta. Tente de novo." };`
- `unidade-de-trabalho.ts:162-163`: `"update plataforma.workspaces set revisao = revisao + 1, atualizado_em = now() where workspace_id = $1 and revisao = $2 returning revisao"`
- `conexao.ts:74`: `export const TEMPO_DE_CONSULTA_PADRAO_MS = 30_000;`; `conexao.ts:99`: `connectionTimeoutMillis: 10_000,`; `conexao.ts:171`: `instancia = criarPool(connectionString, 10);`

### Pattern 1: Dois regimes em `executar()` (D-09/D-10)

**What:** `regime` explícito por chamador; o corpo de uma tentativa é uma função; o laço externo decide quantas vezes.
**When to use:** sempre; o padrão é `"travado"`.
**Example (esqueleto, valores do SQL conforme as citações acima e D-09):**
```typescript
// Fonte: unidade-de-trabalho.ts (leitura) + D-09. `regime` e `aoMedir` são nomes novos propostos.
export interface OpcoesExecucao<T = unknown> {
  /** `travado` (padrão): `select … for update` no começo, UMA tentativa. `otimista`: como até a Fase 11 (importações longas, D-10). */
  readonly regime?: "travado" | "otimista";
  /** Só vale no regime `otimista` (padrão 3). Nenhum chamador de produção a passa hoje. */
  readonly tentativas?: number;
  readonly aoMedir?: (medicao: MedicaoDaExecucao) => void; // chamado em finally: sucesso, recusa, conflito ou exceção
  // …demais opções inalteradas (eventos, semEventosDeSaida, aoConfirmar)
}

// travado, dentro de uma tentativa, logo depois de `cliente.query(inicioDaTransacao())`:
let trancada;
try {
  trancada = await cliente.query<{ revisao: string }>(
    "select revisao from plataforma.workspaces where workspace_id = $1 for update",
    [workspaceId],
  );
} catch (erro) {
  if (sqlstateDe(erro) !== TRAVA_ESGOTADA) throw erro;      // qualquer outro erro sobe e a conexão sai do pool
  await cliente.query("rollback");
  return { ok: false, conflito: true, error: "Outra alteração entrou antes desta. Tente de novo." }; // sem repetir (D-09)
}
if (trancada.rowCount === 0) throw new Error(`Espaço de Trabalho "${workspaceId}" não existe.`); // o mesmo erro de hidratar
const antes = await hidratar(cliente, workspaceId); // só agora: enxerga o que o escritor anterior confirmou
// …operação…; depois o update deixa de conferir a revisão:
//   "update plataforma.workspaces set revisao = revisao + 1, atualizado_em = now() where workspace_id = $1 returning revisao"
```
**`tentativas` vira:** parâmetro do regime otimista (documentar no JSDoc e no `persistencia/CONTEXT.md`); no travado não existe (tipo em união discriminada, ou ignorado com teste). Decisão deixada ao planejador (Claude's Discretion).

### Pattern 2: Medição por callback, sem campo no resultado

**What:** `executar` acumula `performance.now()` por etapa e chama `opcoes.aoMedir?.(m)` em `finally`; a rota guarda a medição numa variável, soma o `recorteMs` e escreve uma única linha de log.
**Campos recomendados** (unidade ms, números; o tipo `MedicaoDaExecucao` mora em `unidade-de-trabalho.ts`):
`conexaoMs` (pool.connect — expõe a espera pelo pool de 10), `travaMs`, `hidratarMs`, `canaisMs`, `operacaoMs`, `atualizaMs`, `gravarMs`, `eventosMs`, `commitMs`, `tentativas`, `linhasLidas`, `linhasGravadas`, `regime`. E, na rota: `recorteMs`, `totalMs` (do começo do handler).
- **`travaMs` precisa significar o mesmo "antes" e "depois"**: = tempo até a revisão estar garantida. Antes (otimista): a duração do `update … where revisao`. Depois (travado): `select … for update` **mais** o `update`. Assim a coluna é comparável; `atualizaMs` isola o `update` no regime novo. Acumular por etapa **somando as tentativas** (é o que a pessoa sente) e reportar `tentativas`.
- **`linhasLidas`:** o `hidratar` real devolve `original` (Map de Maps); as fakes de teste devolvem `{ state, revisao }` sem `original` e `gravar` devolve `{}` — contar com `?.` e valor padrão `0`, senão a suíte de `unidade-de-trabalho*.test.ts` quebra (Pitfall 5). Alternativa: acrescentar `linhas?: number` opcional em `EstadoHidratado`.
- **Medir também `commitMs` e `conexaoMs`:** a diferença entre o total e a soma das etapas (D-02) é o que "sobra fora"; esses dois são ida e volta de rede que, sem eles, apareceriam como "sobra".

**Linha de log (um `request.log.info` por gravação, depois do recorte):**
```typescript
request.log.info({ operacao: nome, regime, medicao: { /* campos acima */ } }, "gravacao medida");
```
`nome` já passou por `ehNomeDeOperacao` (o 404 sai antes, `operacoes.ts:258`), então não há injeção de log; **não** logar `args`, `valor`, nomes de Tarefa/Contato (dado pessoal/financeiro). Os caminhos de 409 e de exceção também devem logar (é onde `tentativas`/`travaMs` altos aparecem).

### Pattern 3: Store com `confirmado`/`data`, copy-on-write

**What:** quando ocioso, `confirmado === data` (mesma referência, zero cópia extra). `run` aceito: `copia = structuredClone(data)` (já existe), a operação roda na cópia, e **`data = copia`**; `confirmado` continua o objeto anterior, que ninguém muta. Ao confirmar: `aplicarDiferenca(confirmado, ordens, diferenca)` em lugar; se sobram pendentes, `data = replay(structuredClone(confirmado), pendentes)`; se não sobra, `data = confirmado`. Custo no caso comum: **um** `structuredClone` por gesto, igual a hoje; o clone extra só existe com pendentes na fila (D-13, "custo do `structuredClone` extra" em Claude's Discretion). Resolve também o teste `(f)` existente (`expect(store.getState().data).toBe(dataAntes)` após falha) sem mudá-lo.
- `ordens` (o `colecao → id → ordem` que `aplicarDiferenca` precisa) pertence ao `confirmado`; o `data` otimista não é alvo de `aplicarDiferenca`.
- No replay, **chamar `syncIdSequence(copia, get().sequenciaDoServidor)`** antes de refazer (é o que `rodarNaCopia` faz hoje, `store.ts:216`), senão os ids refeitos divergem.
- **Pendente guarda** `{ chamadas, resolver (da promessa de `runConfirmado`), otimista: boolean }`. Replay: `OPERACOES[chamada.nome](copia, memberId, ...chamada.args)` [VERIFIED: `OPERACOES` é o `as const satisfies Record<string, (state, actingMemberId, ...args) => OperationResult>` de `registro.ts:421`]. `args` são gravados **por referência** por `instrumentar` (`registro.ts:796-800`); clonar os `args` ao guardar a pendente se algum chamador puder mutá-los depois.
- **Fila (D-16):** `let emVoo: Promise<void> | null`; se ocioso, **disparar `enviar` de forma síncrona** (o teste `(b)` existente afirma `gravarMock toHaveBeenCalledTimes(1)` logo depois de `run()`; um `fila.then(...)` incondicional o quebraria por uma microtarefa — Pitfall 8); se ocupado, encadear. `pendentes` continua contando itens da fila, para `verificarRevisao` não mudar.
- **Recusa/falha/conflito:** tirar a pendente, `lastResult = { ok:false, error, at }`, reconstruir `data`. **`rehidratar` dentro de `enviar`** (revisão não encaixa, conflito): tirar a pendente **antes** de re-hidratar (o servidor já a confirmou; refazê-la duplicaria), `confirmado = r.data`, `data` = replay do que sobra.
- **`"estado"` (transporte em memória, rotas públicas):** a cópia gravada vira `data` **e** `confirmado` (`confirmado = data`).
- **`beforeunload`:** dentro de `AcompanhanteDaRevisao` (já é o componente de ciclo de vida do store), `window.addEventListener("beforeunload", (e) => { if (store.getState().pendentes > 0) { e.preventDefault(); e.returnValue = ""; } })` — só dispara em descarga completa da página (fechar/recarregar aba); navegação do App Router por `Link` não dispara. Extrair a decisão para uma função pura (`deveAvisarAoSair(pendentes)`) torna o teste possível no ambiente `node` do vitest (o jsdom só com `// @vitest-environment jsdom` na primeira linha do arquivo, conforme o comentário do `vitest.config.mts`).

### Lista de exceções de D-13 — critério e candidatos (entregável 4)

**Critério** (a operação **espera o servidor** — não vira `data` na hora — quando o resultado local difere do que o servidor vai gravar **de forma que a pessoa enxergue e aja em cima**):
1. **Valor aleatório ou dependente de contador de módulo gerado na operação** (a cópia e o servidor geram valores diferentes por construção);
2. **Resolução que só o servidor faz antes da transação** (`SERVICOS`);
3. **Ação com efeito de relógio/idempotência do servidor** que o cliente não enxerga por inteiro (corrida com o agendador).
Fora do critério (**ficam otimistas**): ids sequenciais (`nextId`; D-15 cobre com "sem link até confirmar"); timestamps (`now()`); execuções de Automação e Atividade (aparecem na confirmação, substituindo `data`); o disparo da ponte do Agente (`tarefasAfetadasPelaOperacao`, `operacoes.ts:144`, acontece depois do commit e chega pela revisão); recorte por Membro (a cópia já roda sobre o `data` recortado desde antes da fase).

**Candidatos com evidência lida nesta sessão** [VERIFIED: arquivo:linha]:

| Operação | Evidência | Motivo |
|---|---|---|
| `createForm` | `packages/dominio/src/operations/scale.ts:348` `secret: secret(),` ; `scale.ts:46-50` `crypto.getRandomValues(bytes)` | O segredo do link público é aleatório: o local nunca bate com o do servidor |
| `rotateFormSecret` | `scale.ts:419` `form.secret = secret();` | idem |
| `shareTaskPublicly` | `scale.ts:614` `task.publicShare = { secret: secret(), …` | idem |
| `criarGrupo` | `ferramentas/grupos.ts:156` `identificadorExterno: gerarJid(state),` e `:165` `gerarEnderecoDeConvite()`; contador `let sequencia = 0;` em `ferramentas/provedor-simulado.ts:55` | Contador de módulo (`sequencia`) difere entre cliente e servidor |
| `sincronizarGrupo` | `grupos.ts:384` `gerarEnderecoDeConvite()` | idem |
| `regenerarLinkDeConvite` | `grupos.ts:530` | idem |
| `criarComunidade` (+ a função do mesmo arquivo na linha 89) | `ferramentas/comunidades.ts:70` e `:89` `identificadorExterno: gerarJid(state),` | idem; **conferir o nome da função da linha 89** (a varredura achou `criarComunidade` como última exportada antes dela) |
| `definirPontoDeTrocaDeDados`, `regenerarChavesDoPonto`, `publicarVersao`, `copiarFlow` | `ferramentas/flows.ts:231, 243, 651, 735` (`gerarChavePublica()`/`gerarIdentificadorDeFlow()`) | idem |
| `inviteMember` | `rotas/operacoes.ts:237-249` (`SERVICOS`): o servidor resolve e-mail → `userId` no Supabase Auth **antes** da transação e reativa Membro removido (RN-ET-11, `convidar-membro.ts:36-47`); a cópia roda sem `userId` | Resolução só do servidor |
| `runScheduledAutomations`, `runCalendarRecurrences` | chamados com `new Date()` em `features/estrutura/bulk-status-bar.tsx:210,218` e `features/estrutura/financeiro/contas-view.tsx:376`; o servidor também roda o agendador por dia (`jaRodou`, `automations.ts:794`) | Idempotência/corrida com o agendador do servidor; criam registros em massa com ids da sequência |

**A verificar pelo planejador (não li o corpo; marcar `[ASSUMED]` até ler):** `importarGruposDoCanal` (`grupos.ts:293`, pode reusar o gerador de JID), `criarRascunhoAPartirDe`/`enviarFlow` (flows), `ensaiarAgente` (`features/ia/agentes/ensaiar-dialog.tsx:65`: simulação do Agente), `sendChatMessage` (resposta do assistente), `runLancamentoAgent`, `converterSolicitacaoEmContaAPagar`. **Outras duas regras de código, independentes da lista:** (i) `run` cuja cópia **não registra nenhuma chamada** (`chamadas.length === 0`) hoje volta `falha` ("Esta ação não passa por uma operação do domínio e não foi gravada.", `transporte.ts:160`): essa cópia **não** pode virar `data` (ficaria na tela uma mutação que nunca foi ao servidor) — tratar como exceção estrutural no store; (ii) um gesto com **qualquer** chamada na lista inteira espera o servidor (conservador). A lista fica em `apps/web/src/dados/operacoes-que-esperam.ts` como `ReadonlyMap<NomeDeOperacao, string>` (nome → motivo), com teste: toda chave passa `ehNomeDeOperacao` e todo motivo é não vazio (GRV-05: "a lista está no código com o motivo de cada uma").

### O "salvando" na árvore (D-15) — entregável 5

Estado atual lido: `StructureTree` (`app-shell.tsx:632`) pega `const data = useData((current) => current)` e desenha `TreeSpace` (linha ~830) → `TreeFolder` → `TreeList` (~1030). `TreeSpace` já faz `href={inert ? undefined : \`/estrutura/espacos/${space.id}\`}` (linha 859). **`TreeList` não usa `inert` para o `href`** (`const href = enderecos.lista(list)`, e `creatable` aparece sempre que `list.lifecycle === "ativo"`), então precisa mudar. `TreeRow` (`linha-da-arvore.tsx:20`) já sabe desenhar `href` ausente (um `<span aria-disabled="true" title="Nome exibido apenas para navegação.">`), mas esse `title` é do Convidado e **não serve** para "salvando".

Proposta (sem estado novo guardado, como D-15):
- Expor `confirmado` no `StoreShape` (somente leitura) e um hook `useIdsNaoConfirmados()` que devolve `Set<Id>` com os ids de `spaces/folders/lists` presentes em `data` e ausentes em `confirmado`, memoizado por `revision`. Quando `confirmado === data`, devolve o conjunto vazio sem varrer.
- `TreeRow` ganha `salvando?: boolean`: quando verdadeiro, **sem `href`**, `aria-busy="true"`, tinta fraca (`var(--texto-4)`, já usada) e `title="Salvando…"` (curto). Sem menu, sem "+", sem arrastar (a linha ainda não existe no servidor; `useMenuDeOrdem`/`useMenuDeMover` devolvem `[]` quando o nó é pendente, reaproveitando o caminho do `inert`).
- Vale também para qualquer registro criado que a tela liste com link (Tarefa nova na Lista: `runConfirmado` em `app/(shell)/estrutura/listas/[lista]/page.tsx:385,442`); o planejador define o recorte mínimo (árvore + linha de Tarefa) e anota o resto como seguimento.
- Testes: `features/shell/arvore-menu.test.tsx` e `arvore-arrastavel.test.tsx` já montam `AppShell` + `StoreProvider` com transporte falso (jsdom) — molde para "Lista nova aparece sem link até o transporte responder; depois ganha link".

### `runConfirmado` e o caso das duas chamadas — entregável 5

- Os 9 sítios de `runConfirmado(` são [VERIFIED: grep]: `ia/chat/page.tsx:93`, `estrutura/listas/[lista]/page.tsx:385,442`, `features/shell/app-shell.tsx:705`, `features/ia/agent-builder/agent-builder.tsx:130`, `features/estrutura/cabecalho-do-aspecto.tsx:140`, `conversao-de-item.tsx:89`, `mover-conteiner-dialog.tsx:290`, `create-container-dialog.tsx:217`. O diálogo de criação (`create-container-dialog.tsx:217`) continua esperando `confirmado` para navegar; com D-13 o `local.value` passa a ser um objeto **vivo dentro de `data`** (antes era de uma cópia descartada) e fica obsoleto após o rebuild — quem só lê `local.ok` não sofre; quem guardar `local.value` por mais tempo deve usar o `confirmado`.
- **O caso `(shell)/page.tsx` do CONTEXT/2.2.4 está desatualizado:** esse arquivo (apresentação do robô) **não chama `run`**. O fluxo "cria a Sessão de Chat e manda a mensagem" hoje está em `app/(shell)/ia/chat/page.tsx`: `runConfirmado(createChatSession)` seguido, em `.then`, de **um segundo `run(sendChatMessage)` separado** (`:93` e `:114`) — ou seja, duas fatias da fila, não duas chamadas de um `run`. `features/tarefa/fluxo-manual-dialog.tsx:66,74` também usa dois `run` seguidos. **Não achei nenhum `run` real cuja única closure chame duas operações do registro**; D-11 fica provado pelo teste de transporte falso (`store.test.ts (h)` já monta esse caso com `createChatSession` + `sendChatMessage` na mesma closure) e vale como robustez. O planejador deve corrigir a referência em `12-PROVAS.md` e, se quiser exemplo real, instrumentar um log temporário de `chamadas.length > 1` em desenvolvimento — [ASSUMED] que não existe.

### Anti-Patterns to Avoid
- **Fundir a trava e `hidratar` numa só consulta** (`… for update of w` no `left join`): o snapshot da instrução é o do começo dela; os registros `r` viriam velhos mesmo com `w` atualizado pelo re-check. A trava precisa ser instrução anterior.
- **`medicao` como campo espalhado em `ResultadoTransacao`** sem destruturar: vaza em `operacoes.ts:359,387,393` e `anexos-da-tarefa.ts:176,185`.
- **Replay que reaplica uma pendente já confirmada** (ver Pitfall 3).
- **`fila.then(...)` incondicional**: quebra o contrato síncrono de "a primeira gravação sai na hora".
- **Trocar a referência de `data` por dentro de `aplicarDiferenca`**: ele muta em lugar por contrato (`diferenca.ts:50`, "Muta `state` e `ordens` em lugar"); aplicar só em `confirmado`.
- **Tocar `estado.ts` para medir `GET /estado`** sem rodar o e2e local (memória: mudança em `GET /estado` exige e2e contra Postgres local).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exclusão mútua por Espaço | Mutex em memória, tabela de leases | `select … for update` na linha de `plataforma.workspaces` | Vale entre processos (API, agendador, ponte, CLI); o Postgres já arbitra e já tem `lock_timeout` |
| Prazo da espera pela vez | Temporizador próprio no Node | `set local lock_timeout` do `inicioDaTransacao()` (já existe) | O servidor desiste antes do cliente (06-13, H4); um temporizador do cliente deixaria instrução órfã |
| Cronômetro de etapa | Biblioteca de benchmark | `performance.now()` | Monotônico, sem dependência |
| Mediana/pior caso/percentil | Estatística nova | O `percentil` de `observabilidade/metricas.ts:157` (hoje não exportado — exportar ou mover para o módulo puro novo) | Mesma função que `coletarMetricas` usa para p50/p95/p99 |
| Linha de base de latência | Medir "ping" à parte | `select 1` repetido (`metricas.ts` `medirLatenciaLocal`, ~linha 266) dentro do comando | Dá o RTT VPS↔banco, que é a unidade em que as etapas devem ser lidas |
| Validar o nome da operação para o log | Regex própria | `ehNomeDeOperacao` (`Object.hasOwn`) | Já bloqueia `__proto__`/`constructor` (T-1-04) |
| Aplicar diferença no `confirmado` | Merge próprio | `aplicarDiferenca` de `@n1/dominio` | Cuida de ordem, singulares, coleção desconhecida |
| Refazer pendentes | Interpretador próprio de chamadas | `OPERACOES[nome](state, memberId, ...args)` | É o mesmo registro que o servidor usa em `POST /operacoes` |
| Capturar o log do Fastify no teste/CLI | Monkey-patch de `console` | `opcoesDoLogger(env, destino)` (`observabilidade/log.ts`, aceita `destino: { write(linha) }`) | Já existe para `log.test.ts`; `buildApp({ logger })` aceita o objeto |

**Key insight:** o custo mora em **idas e voltas ao banco** (a única medição indicativa do projeto é ~234 ms de ida e volta de um notebook ao `us-west-2`, `docs/08-migracao-financeiro/05-topologia-e-regiao.md`; da VPS, a tabela §5 está em branco). Por gravação travada contam: `begin…set local` (1), trava (1), `hidratar` (1), canais (1; +1 só no primeiro boot por causa da guarda), `update` (1), `upsert` (1), `delete` (0–1), eventos (0–N), `commit` (1) — **7 a 9**, contra 6 a 8 hoje. A trava acrescenta **uma** ida e volta ao caminho feliz e remove as repetições inteiras do caminho de conflito. Se o "depois" ficar pior no caso sem concorrência, é isto (ver Pitfall 9 para a forma de recuperar a ida e volta).

## Runtime State Inventory

Não é fase de rename/refactor/migração de dado. A única "mudança de contrato com estado vivo" é a do store web; mesmo assim, por exigência de completude:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Nenhum** — sem migração (`plataforma.registros`/`workspaces` intactos; verificado: a fase não cria `.sql`). O comando de medição **escreve** linhas de Atividade e um Espaço de teste por gesto no `ws_n1` (rastro aceito, D-04) | Nenhuma migração; nomear o Espaço de teste com prefixo reconhecível (ex.: `ZZ-MEDICAO-<timestamp>`) para o dono limpar se quiser |
| Live service config | Nenhum config vivo carrega o regime; o `lock_timeout` é por transação (`set local`) | Nenhuma |
| OS-registered state | `n1-crm-api.service` fixa `Environment=` dos workers e `TZ`; **não** define `DATABASE_QUERY_TIMEOUT_MS` | Nenhuma; nada novo no systemd (D-03 já descartou liga por env) |
| Secrets/env vars | `api.env` (dono `n1crm`, modo 600) já tem `DATABASE_URL`, `SUPABASE_*`; o comando só lê o que o `carregarEnv()` já lê. **Nenhum segredo novo** em arquivo | Nenhuma |
| Build artifacts | O cliente web antigo (aba aberta) continua falando com a API nova: o servidor **não muda o contrato** (`POST /operacoes` mesmo corpo, mesmo `revisaoAnterior`) | Nenhuma; a web é do Vercel e publica sozinha |

## Common Pitfalls

### Pitfall 1: `medicao` vaza para o corpo da resposta
**What goes wrong:** o spread `{ ...resultado, diferenca: …, sequencia }` (`operacoes.ts:386-391`) copia qualquer campo novo de `ResultadoTransacao`. Também vazam `reply.code(409).send(resultado)` (`:359`), `reply.code(200).send(resultado)` (`:393`) e, em `rotas/anexos-da-tarefa.ts`, `:176` e `:185`.
**Why it happens:** o resultado da Unidade de Trabalho foi desenhado para ser o corpo.
**How to avoid:** `aoMedir` (callback); ou, se o campo for mantido, `const { medicao, ...corpo } = resultado` **logo após** `executar()` e usar só `corpo` adiante. Teste sem banco: `vi.mock` de `../persistencia/unidade-de-trabalho` devolvendo um resultado com `medicao` (ou chamando `aoMedir`) e `app.inject` verificando que `Object.keys(res.json())` não contém `medicao` nos caminhos 200, recusa e 409. `inviteMember` passa por `convidarMembro → executar` e volta pelo mesmo `resultado`.
**Warning signs:** `medicao` visível no painel de rede do navegador.

### Pitfall 2: Esperas de 10 s prendem conexões do pool de 10
**What goes wrong:** no regime travado todo escritor concorrente espera **com a conexão tomada** (até `lock_timeout` = 10 s). Dez escritores esperando esgotam o pool: as consultas que **não** escrevem (hook de autenticação `membroPorUsuario` roda `pool().query` em **toda** requisição; `GET /estado`) ficam na fila do pool até `connectionTimeoutMillis: 10_000` e viram erro.
**Why it happens:** `pool().connect()` acontece antes da trava; o pool é `max: 10` (`conexao.ts:171`).
**How to avoid:** é o motivo de D-09 limitar a ~10 s e de uma tentativa só; **medir** `conexaoMs` e logar; considerar, só se a medição pedir, tomar a trava com `statement_timeout`/`lock_timeout` menores para escritas da ponte/agendador (fora do escopo; anotar como Open Question se `conexaoMs` aparecer alto no "depois"). O worker do agendador e a ponte do Agente passam a **enfileirar** com os gestos de tela no mesmo Espaço.
**Warning signs:** `tentativas` irrelevante, mas `conexaoMs`/`travaMs` altos; 500 de `membroPorUsuario`.

### Pitfall 3: Replay duplica o que o servidor já gravou
**What goes wrong:** se `rehidratar()` (por `useRehidratar`, p. ex. depois de um upload de anexo, ou por `verificarRevisao`) traz um `GET /estado` **posterior ao commit** de uma pendente cuja resposta ainda não chegou, `confirmado` já contém o efeito dela e o replay a faz de novo (uma Lista criada duas vezes).
**Why it happens:** `rehidratar` não sabe quais pendentes o snapshot já cobre.
**How to avoid:** serializar `rehidratar` externo na **mesma fila** (esperar o pedido em voo terminar antes de buscar `GET /estado`, e só refazer as pendentes ainda **não enviadas**). `verificarRevisao` já não pergunta com `pendentes > 0` (`store.ts:255`), mas uma pergunta **em voo** quando um `run` começa precisa do mesmo cuidado (ele já confere `get().pendentes > 0` depois do `await`, `:260`). O caminho `rehidratar` **dentro** de `enviar` (revisão não encaixa) é seguro se a pendente corrente for tirada antes.
**Warning signs:** item duplicado na árvore depois de upload de anexo.

### Pitfall 4: `55P03` fora da trava e os formulários públicos
**What goes wrong:** `persistencia/CONTEXT.md:59-64` documenta que um `55P03` **fora** do `update … revisao` sobe como exceção (500) — o exemplo é o `consumirSessao … for update` do formulário. Com a trava no começo, `55P03` **na trava** vira 409; mas o `55P03` do `consumirSessao` (chamador 6) continua 500.
**How to avoid:** no regime travado só a instrução da trava mapeia `55P03` → conflito; manter o teste existente "55P03 FORA da revisão (no insert dos registros) não vira conflito: sobe como antes" (`unidade-de-trabalho-trava.test.ts:125`). Documentar no `CONTEXT.md` que "a trava" agora é o `select … for update` e que a regra de "fora" continua.

### Pitfall 5: As fakes de teste não têm o que o código novo lê
**What goes wrong:** `unidade-de-trabalho.test.ts` e `unidade-de-trabalho-trava.test.ts` usam um pool falso cujo `query` devolve `{ rowCount: 0, rows: [] }` para qualquer SQL que não seja `update plataforma.workspaces`, e mocks `hidratar: async () => ({ state: { automationExecutions: [] }, revisao: 7 })` / `gravar: async () => ({})`. O `select … for update` novo recebe `rowCount: 0` → o código (corretamente) lança "não existe"; `linhasLidas` sem `original` lança.
**How to avoid:** ajustar o falso para devolver `{ rowCount: 1, rows: [{ revisao: "7" }] }` ao `select revisao from plataforma.workspaces … for update`; mudar `naRevisao` (`unidade-de-trabalho-trava.test.ts:99`) para casar a nova instrução; contar linhas com `?.`. **Os testes das linhas 101 e 110 de `unidade-de-trabalho-trava.test.ts` mudam de sentido** (hoje: 3 tentativas, 3 rollbacks; 55P03 uma vez e depois passa): no travado viram "1 tentativa, 1 rollback, 409" e, para o regime otimista, mantêm-se com `regime: "otimista"`.

### Pitfall 6: O teste de concorrência não cabe no arquivo de fakes
**What goes wrong:** o CONTEXT/GRV-03 nomeia `unidade-de-trabalho-trava.test.ts` para "duas `executar()` simultâneas, `hidratar` exatamente 2 vezes". Esse arquivo faz `vi.mock("./repositorio", …)` e `vi.mock("./conexao", …)` **no módulo inteiro**: com pool falso não há lock real, e não há como misturar com Postgres real no mesmo arquivo.
**How to avoid:** arquivo novo `persistencia/unidade-de-trabalho-concorrencia.test.ts` com `describeComBanco` (`testes/banco-crm.ts`: só `localhost`/`127.0.0.1`), `prepararBancoCrm()`, `novoEspacoDeTeste('conc')`, `semear(...)`, e `vi.mock("./repositorio", async (orig) => ({ ...(await orig()), hidratar: vi.fn((await orig()).hidratar) }))` para contar. Duas `executar()` em `Promise.all`; asserir: ambas `ok`, `revisao` finais sequenciais (`n+1`, `n+2`), `hidratar` 2 vezes, e (opcional) `tentativas` = 1 em cada `aoMedir`. Documentar o comando de Docker no próprio arquivo, como `banco-crm.ts` faz.

### Pitfall 7: `lock_timeout` desligado quando Q = 0
**What goes wrong:** `inicioDaTransacao()` devolve `"begin"` puro com `DATABASE_QUERY_TIMEOUT_MS=0` (`unidade-de-trabalho.ts:103`). Um chamador **travado** rodado com Q=0 (um CLI de `bootstrap/` com a variável herdada do shell do operador) esperaria **sem prazo** por um escritor lento.
**How to avoid:** no regime travado, se Q = 0, acrescentar um `set local lock_timeout = <constante>` (ex.: 10 s) ou lançar erro claro; teste com `{ DATABASE_QUERY_TIMEOUT_MS: "0" }`. Anotar no `CONTEXT.md`: "Q=0 só nas importações otimistas".

### Pitfall 8: Contrato síncrono do primeiro envio e dos testes existentes
**What goes wrong:** `store.test.ts (b)` afirma `expect(transporte.gravarMock).toHaveBeenCalledTimes(1)` imediatamente depois de `run()`. Uma fila implementada como `fila = fila.then(() => enviar(...))` adia a chamada para uma microtarefa.
**How to avoid:** iniciar o envio **sincronamente** quando não há pedido em voo; só encadear quando há. E reescrever deliberadamente os testes que D-13 inverte: `(b)` ("antes do POST resolver, o dado real não mudou") passa a afirmar o contrário; `(h)` mantém `pedido.chamadas`.

### Pitfall 9: A trava custa uma ida e volta no caminho sem concorrência
**What goes wrong:** o "depois" pode ficar **mais lento** que o "antes" quando ninguém concorre (mais uma ida e volta de ~RTT).
**How to avoid / opções (Claude's Discretion — forma interna da trava):** (a) comparar "antes/depois" por gesto e por RTT (o comando mede `select 1`); (b) se a meta não fechar, recuperar a ida e volta **sem mudar a semântica de D-09**: enviar `begin; set local …; select revisao … for update` numa só consulta simples (exige escapar o `workspaceId`; `pg` tem `escapeLiteral` — [ASSUMED], conferir na versão instalada — e as fakes de teste só têm `query`), ou tomar a trava com o próprio `update … set revisao = revisao + 1 … returning revisao` no começo (rollback desfaz em recusa). Só depois de medir.

### Pitfall 10: D-13 inverte suposições de dezenas de testes de tela
**What goes wrong:** ~43 arquivos de teste definem um `Transporte` falso (`gravar: vi.fn(async () => ({ tipo: "falha", erro: "não configurado neste teste." }))` é o padrão) e o `arvore-menu.test.tsx` documenta "o que a tela mostra depois de reordenar é o que o servidor devolveu, nunca o que a cópia aceitou". Com `data` otimista e `falha` por padrão, toda operação aceita agora **aparece e depois some**, e esses testes podem afirmar o estado intermediário.
**How to avoid:** rodar a suíte web inteira (13 s, 847 testes verdes hoje) a **cada** onda do store; tratar as falhas como mudança deliberada de contrato (atualizar o teste e anotar), nunca como flaky. Para D-11, a mudança do tipo de retorno de `Transporte.gravar` toca todas essas fakes — ver Open Question 2 (união `RespostaDeGravacao | readonly RespostaDeGravacao[]` evita editar ~43 arquivos).

### Pitfall 11: O tamanho do banco medido por `pg_column_size` subestima o que trafega
**What goes wrong:** `pg_column_size` "reflects any compression" quando aplicado direto à coluna [CITED: https://www.postgresql.org/docs/current/functions-admin.html]; `dados` é `jsonb` com TOAST/compressão. O `hidratar` transfere o texto inteiro.
**How to avoid:** na consulta de D-05, somar também `sum(length(dados::text))` ("bytes de texto") e `count(*)`, por coleção e no total; usar a segunda para dimensionar o payload de `GET /estado`.

## Fatos do Postgres confirmados (entregável 6)

| Fato | Evidência |
|---|---|
| `SELECT … FOR UPDATE` bloqueia até o escritor anterior confirmar; ao acordar, trava e devolve **a versão atualizada** da linha | [CITED: https://www.postgresql.org/docs/current/transaction-iso.html, "Read Committed"]: "…`SELECT FOR UPDATE`… this means it is the updated version of the row that is locked and returned to the client." |
| O `SELECT` seguinte (a hidratação) enxerga tudo que foi confirmado antes dele começar | idem: "a `SELECT` query sees a snapshot of the database as of the instant the query begins to run." Por isso a trava é instrução **anterior** a `hidratar` |
| `lock_timeout` vale para `SELECT FOR UPDATE` sem `NOWAIT`, **por tentativa de lock**, e só dispara esperando lock | [CITED: https://www.postgresql.org/docs/current/runtime-config-client.html]: "The limit applies both to explicit locking requests (such as `LOCK TABLE`, or `SELECT FOR UPDATE` without `NOWAIT`) and to implicitly-acquired locks." |
| `statement_timeout` é por instrução (80 % de Q = 24 s) e vem depois do `lock_timeout` (10 s) | idem; `lock_timeout` < `statement_timeout`, então o `55P03` dispara primeiro |
| O erro da trava esgotada é SQLSTATE **`55P03`** | **Experimento local descartável** (Docker `postgres:16`, tabela de 1 linha, duas sessões): sessão A `begin; select … for update; select pg_sleep(3); update …; commit;`; sessão B `set local lock_timeout = 700; select … for update;` → `ERROR:  55P03: canceling statement due to lock timeout / CONTEXT: while locking tuple (0,1) in relation "w"`. Depois, B com `lock_timeout = 5000` esperou e leu **`8`** (a revisão que A gravou) [VERIFIED: saída do experimento nesta sessão; container removido] |
| O `update … revisao = revisao + 1` depois da trava não tem corrida | a linha é do escritor corrente até o `commit`; o `where revisao = $2` pode sair; `rowCount === 0` só se o Espaço sumir no meio (tratar como erro) |
| Outros escritores da revisão (o CRM: `avancarRevisaoDoEspaco`, `repositorios/crm/referencias.ts:102`, `update … set revisao = revisao + 1 … where workspace_id = $1`, **sem** `lock_timeout` próprio) | passam a esperar atrás da trava de `executar`; o limite deles é o `query_timeout` do cliente (30 s). Não há ciclo de espera: `executar` só **lê** `plataforma.canais` (MVCC, sem lock; `semCanaisProjetados` lança se uma operação tentar mudá-los) e só **escreve** `plataforma.registros` — análise por leitura de código, [ASSUMED] até o teste com Postgres real (a tarefa de concorrência pode incluir uma escrita de Canal REST simultânea) |
| Idempotência (`servicos/idempotencia.ts`) | `comIdempotencia` usa `pool().query` próprio (conexões separadas) **por fora** de `executar`; a linha `in_progress` não toma a trava do Espaço → sem interação nova; só `integracao-solicitacoes` a usa |
| Outbox | `gravarEventos` insere no mesmo `cliente` da transação (`outbox.ts`); o worker usa `for update skip locked` na tabela do outbox, não em `workspaces` → sem interação |
| Agendador (`automacao_agenda`) | a reivindicação é transação própria; `executar` (`scheduler-worker.ts:708`) entra depois → passa a enfileirar com a tela |

**Pooler do Supabase:** o `vitest.config.mts` registra que o pooler está em **modo sessão** (`apps/api/vitest.config.mts`, comentário "pooler do Supabase em modo sessão"); `set local` e `for update` valem dentro de uma transação em qualquer modo, e já é o que `inicioDaTransacao()` faz.

## O comando de medição (entregável 7)

**Como os CLIs existentes são feitos** [VERIFIED: leitura de `reconciliacao.cli.ts`, `package.json`]: arquivo `*.cli.ts` com `carregarEnv()`, `process.argv.slice(2)` e `--chave=valor`; classe `SairComCodigo` para sair com código sem `process.exit` direto (`encerrar()` do pool sempre roda); script em `apps/api/package.json` (`"reconciliar": "vite-node src/observabilidade/reconciliacao.cli.ts"`). Seguir: `"gravacao:medir": "vite-node src/observabilidade/medir-gravacao.cli.ts"`, módulo puro `medicao-da-gravacao.ts` (mediana, pior caso, formatação, testável sem banco).

**Autenticação sem segredo em arquivo:** `POST /operacoes` exige JWT de **Membro** do Supabase (`plugins/autenticacao.ts`); a credencial de serviço (`credenciais-de-servico.ts`, `svc_…`) só autentica `/v1/integrations/*` (`plugins/autenticacao.ts:92` isenta esse prefixo do JWT humano, e `POST /operacoes` não está sob ele) e **não** serve para `/operacoes`. Opções:
1. **(Recomendada) O comando sobe o próprio Fastify** com `buildApp({ logger: opcoesDoLogger(process.env, destino), verificarToken: async () => ({ sub: userIdDoProprietario }) })`, `app.listen({ host: "127.0.0.1", port: 0 })` e faz `fetch` com `Authorization: Bearer medicao` (o hook exige o cabeçalho, o `verificarToken` injetado o aceita). `resolverMembro` fica o **real** (`membroPorUsuario`), então a consulta de sessão entra na medição. O `userId` do Proprietário sai de `plataforma.registros` (`colecao = 'workspace'` → `dados->>'ownerMemberId'`; depois `colecao = 'members'`), `SINGULARES = ["workspace", "inbox"]` [VERIFIED: `colecoes.ts:20`]. **Nenhum segredo novo**: o processo já tem `DATABASE_URL` pelo `api.env`, e o stub de `verificarToken` só existe dentro do arquivo do comando (nunca exportado nem ligável por env). O destino do logger captura as linhas JSON de `"gravacao medida"` e o comando monta a tabela por etapa. **Contra:** é outro processo (sem o tráfego e o pool quente do serviço, sem nginx/TLS).
2. HTTP para o serviço real (`127.0.0.1:3020` ou a URL pública) com JWT real obtido por `admin.generateLink` + `verifyOtp` ([ASSUMED]: o fluxo existe no `@supabase/supabase-js` ^2.116; `criar-usuario.cli.ts` já usa `auth.admin.createUser`/`listUsers` com `SUPABASE_SECRET_KEY`): "mais real", mas o comando **não consegue ler as etapas** (D-03 as põe só no log do serviço, e o `n1crm` só tem `sudo` para `journalctl … -n 80`, `preparar-vps.sh:130`) — sairia só o total. Só serve se o dono aceitar `Server-Timing`/cabeçalho (contradiz D-03).
**Execução na VPS:** a chave de deploy (`restrict`: "roda comando e copia arquivo", `preparar-vps.sh:94`) **pode** disparar o comando como `n1crm` por `ssh … 'cd /opt/n1-crm/current && PATH=/opt/n1-crm/node/bin:$PATH npm run gravacao:medir -w @n1/api -- --repeticoes=10'` (o `api.env` já é o `apps/api/.env` por link, `instalar-release.sh`). Publicar antes: `publicar.sh` (manual, só quando o dono mandar; só publica se `apps/api` mudou). **Nada disso foi executado nesta pesquisa.**

**O que o comando faz (ordem):** (1) baseline: `select 1` ×N → RTT; (2) D-05: a consulta por coleção (com `count`, `pg_size_pretty(sum(pg_column_size(dados)))` e, a mais, `sum(length(dados::text))`) + total; (3) `hidratar()` direto ×10 (mediana de `hidratar` puro, o número que decide a sessão C, D-07); (4) `GET /estado` ×10 pela mesma rota (D-12: a medição de `/estado` precisa aparecer; sem tocar `estado.ts`, o total do `fetch` basta); (5) cria o Espaço de teste, uma Lista e uma Tarefa de teste (`createSpace`, `createList`, `createTask`); (6) 10× cada: `createList`, `updateContainer("list", id, { name })`, `trashContainer("space", id)` (cada repetição prepara **um novo** Espaço com Listas fora da medição) e `changeTaskStatus` alternando entre dois Status da Lista; (7) imprime a tabela (mediana e pior caso por etapa + total do pedido + `tentativas` + `linhasLidas`) e manda o Espaço de teste restante à lixeira em `finally`. Os nomes das operações e a forma dos argumentos vêm dos esquemas (`rotas/esquemas/estrutura.ts:103-111`: `createSpace: z.tuple([CREATE_SPACE_INPUT])`, `createList: z.tuple([CREATE_LIST_INPUT])`, `updateContainer: z.tuple([CONTAINER_TYPE, ID, UPDATE_CONTAINER_INPUT])`, `trashContainer: z.tuple([CONTAINER_TYPE, ID])`) — o corpo é `{ args: [...] }` (`revisao` é opcional e ignorada, `operacoes.ts:173-180`). O comando só toca ids que ele mesmo criou; imprime contagens e milissegundos, **nunca** nomes de Tarefa/Contato (mesma disciplina de `observabilidade/CONTEXT.md`).

**Para o "depois" ser justo:** o "antes" deve rodar sobre o commit **só da instrumentação** (regime e store inalterados); "antes" e "depois" devem usar `--repeticoes`, versão do comando e Espaço de teste de mesma forma; registrar no `12-PROVAS.md` o SHA publicado (`cat /opt/n1-crm/current/REVISION`) de cada rodada.

## Parada, meta e expectativa do número (GRV-02)

O comentário de `repositorio.ts:9-10` ("cerca de 900 registros e 475 KB") é de antes do Financeiro e do CRM; a importação de Contas a pagar trouxe **2.861** contas (`importacao/clickup/importar-contas-a-pagar.ts:9`, "Uma `executar()` por conta (2.861 chamadas)") e a de Contas a receber 240 (`corrigir-data-de-pagamento-cr.ts:6`). Cada conta é uma Tarefa com comentários/Campos/Atividade, então é **muito provável** que `ws_n1` tenha muito mais que 900 registros e que `hidratar` passe de 300 ms na mediana só pela ida e volta + payload (D-07). O plano deve **preparar** o gatilho de D-07 (texto da entrada no ROADMAP pronto para o dono aprovar na parada), em vez de descobri-lo depois. A tabela da parada deve sempre mostrar o RTT (`select 1`) ao lado: sem ele, "hidratar = 700 ms" não distingue rede de CPU.

## Code Examples

### Medição na rota sem vazar para o corpo
```typescript
// Fonte: forma de operacoes.ts:316-393 (lido) + Pattern 2. `medicao`/`recorteMs` são nomes propostos.
let medicao: MedicaoDaExecucao | undefined;
resultado = await executar(ws, operacao, { eventos, aoMedir: (m) => { medicao = m; } });
// …409 e demais caminhos…
const t0 = performance.now();
const { ocultos } = visibilidadePara(depois, request.membro.id);
const corpo = {
  ...resultado,                                   // sem `medicao`: o campo nunca esteve aqui
  diferenca: recortarDiferenca(resultado.diferenca, depois, request.membro.id, ocultos),
  ...(resultado.ok ? { value: recortarValor(resultado.value, depois, request.membro.id, ocultos) } : {}),
  sequencia: maiorIdDe(depois),
};
request.log.info({ operacao: nome, medicao: { ...medicao, recorteMs: performance.now() - t0 } }, "gravacao medida");
return reply.code(200).send(corpo);
```

### Replay das pendentes sobre `confirmado`
```typescript
// Fonte: store.ts:202-230 (rodarNaCopia) + registro.ts:421 (OPERACOES). Nomes novos propostos.
function refazer(confirmado: DataState, pendentes: readonly Pendente[], memberId: Id, sequencia: number) {
  const copia = structuredClone(confirmado);
  syncIdSequence(copia, sequencia);
  const falhas: Array<{ pendente: Pendente; erro: string }> = [];
  const mantidas: Pendente[] = [];
  for (const p of pendentes) {
    if (!p.otimista) { mantidas.push(p); continue; }          // exceção de D-13: espera o servidor
    const r = executarChamadas(copia, memberId, p.chamadas);  // OPERACOES[nome](copia, memberId, ...args)
    if (r.ok) mantidas.push(p);
    else falhas.push({ pendente: p, erro: r.error });         // D-14: some e mostra o erro
  }
  return { data: copia, mantidas, falhas };
}
```

### Fila serial com primeiro envio síncrono
```typescript
// Fonte: contrato do teste (b) de store.test.ts:82-97 + D-16.
let emVoo: Promise<void> | null = null;
function enfileirar(pedido: Pedido): Promise<OperationResult<unknown>> {
  const executar = () => enviar(pedido);
  if (emVoo === null) { const p = executar(); emVoo = p.then(liberar, liberar); return p; } // sai agora
  const p = emVoo.then(executar);
  emVoo = p.then(liberar, liberar);
  return p;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Revisão otimista: hidratar → operar → `update … where revisao` → repetir até 3× | Trava no começo (`select … for update`), 1 tentativa; otimista só nas importações | Esta fase (D-09/D-10) | Fim das hidratações repetidas por conflito; +1 ida e volta sem concorrência |
| `data` só muda quando a diferença volta | `data` otimista + `confirmado` + replay | Esta fase (D-13) | A tela responde sem esperar a rede; refusal faz a mudança sumir |
| Pedidos de um `run` em paralelo com a mesma `revisao`; só a última resposta aplicada | Fila serial + lista de respostas aplicadas em ordem | Esta fase (D-11/D-16) | Some a re-hidratação causada por resposta fora de ordem |

**Deprecated/outdated:** a referência a `(shell)/page.tsx` como caso de duas chamadas (ver acima); o comentário "cerca de 900 registros e 475 KB" de `repositorio.ts` (atualizar com o número medido); a linha de `persistencia/CONTEXT.md:15` "revisão otimista (3 tentativas)".

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Subir o Fastify do comando em loopback é aceitável como "API real" de D-01 | O comando de medição / Open Question 1 | O dono pode exigir o serviço real; então só sai o total (sem etapas) ou se amplia D-03 (`Server-Timing`) |
| A2 | `pg` expõe `escapeLiteral` utilizável para fundir `begin`+trava numa ida e volta | Pitfall 9 | Só uma otimização opcional; se não existir, ficar na forma de duas instruções |
| A3 | `admin.generateLink` + `verifyOtp` do `@supabase/supabase-js` produz JWT de Membro | O comando de medição (opção 2) | Só afeta a alternativa não recomendada |
| A4 | `importarGruposDoCanal`, `criarRascunhoAPartirDe`, `enviarFlow`, `ensaiarAgente`, `sendChatMessage`, `runLancamentoAgent`, `converterSolicitacaoEmContaAPagar` entram (ou não) na lista de exceções — não li os corpos | Lista de exceções | Uma operação com resultado divergente fica otimista e mostra valor errado até a confirmação (substituído em ms; baixo) |
| A5 | O nome da função na linha 89 de `ferramentas/comunidades.ts` | Lista de exceções | Lista incompleta de uma operação |
| A6 | Não há ciclo de espera entre a trava de `executar` e as transações do CRM/Canal/formulário (análise por leitura) | Fatos do Postgres | Deadlock raro só visível com Postgres real; mitigado pelo teste de concorrência opcional com escrita de Canal |
| A7 | Não existe `run` de uma só closure com 2+ operações do registro em produção | Seção `runConfirmado` | D-11 tem caso real a mais para testar à mão; sem efeito no desenho |
| A8 | O custo de `structuredClone` de `confirmado` é pequeno (o comentário de `store.ts:208` diz "sub-ms para ~475 KB"; **não medido por mim**, e o `ws_n1` hoje é maior) | Pattern 3 | O copy-on-write evita o clone extra no caso comum; com pendentes o replay clona o estado inteiro — medir na tela |
| A9 | A VPS↔banco RTT é da ordem de 100–250 ms (o único dado é ~234 ms de um notebook; §5 de `05-topologia-e-regiao.md` está em branco) | Don't Hand-Roll (Key insight) | Define se "idas e voltas" ou CPU domina; o comando mede e resolve |

## Open Questions

1. **O comando mede o serviço real ou um Fastify próprio? (tensão D-01 × D-03)**
   - What we know: D-03 põe a medição só no log do serviço; o comando é outro processo; `n1crm` só lê `journalctl -n 80` via `sudo`; a credencial de serviço não autentica `/operacoes`.
   - What's unclear: se o dono aceita "mesmo código, mesmo banco, mesma VPS, processo à parte" como "API real".
   - Recommendation: opção 1 (Fastify próprio em loopback, `verificarToken` injetado, logger capturado); levar a pergunta ao plano como decisão a confirmar **antes** da onda 2 (custa trocar o comando depois).

2. **Contrato de `Transporte.gravar` (D-11): lista pura ou união?**
   - What we know: ~43 arquivos de teste definem fakes que devolvem **uma** `RespostaDeGravacao`; `transporteHttp` e `transporteEmMemoria` são as únicas implementações reais.
   - What's unclear: se editar ~43 arquivos é aceitável.
   - Recommendation: `gravar(): Promise<RespostaDeGravacao | readonly RespostaDeGravacao[]>` com normalização em `store.ts` (`Array.isArray`); `transporteHttp` sempre devolve array (D-11 cumprido onde importa, e `transporte.test.ts (g)` passa a afirmar a lista). Alternativa fiel: lista pura + auxiliar de teste comum.

3. **`travaMs` comparável entre regimes** (Pattern 2): confirmar a definição "tempo até ter a revisão garantida" e o campo extra `atualizaMs`.

4. **Classificação dos 14 chamadores:** confirmar a linha 14 (`corrigir-data-de-pagamento-cr`, recomendada otimista) e que os `bootstrap/` ficam travados (D-10 antecipa "o que achar de igual natureza em `bootstrap/`": não achei).

5. **`GET /estado` com etapa de servidor?** Hoje só o total (do comando) e `hidratar` direto entram na tabela; mexer em `rotas/estado.ts` exige e2e local de `GET /estado` (memória do dono). Recomendação: não mexer.

6. **`Q = 0` com regime travado** (Pitfall 7): `lock_timeout` de reserva ou erro?

7. **Escopo do "salvando" fora da árvore** (D-15 "qualquer registro"): recorte mínimo proposto = árvore de Espaço/Pasta/Lista + linha de Tarefa; o resto vira seguimento.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Todos os testes e comandos | ✓ | v24.14.0 | — |
| npm / vite-node / vitest | CLI e testes | ✓ | vitest 5.0.1 | — |
| Docker | Teste de concorrência e rodadas contra Postgres local | ✓ | 29.3.1 (imagem `postgres:16` subiu e foi descartada) | Sem Docker, o teste de concorrência pula (`describeComBanco`) e o gate perde GRV-03 real |
| Postgres local descartável | GRV-03 (lock real) | ✓ via Docker | 16 | — |
| VPS (`85.155.186.214`), chave `n1_crm_deploy_ci` | Rodar o comando "antes"/"depois", `publicar.sh` | **não probado** (nada contra produção, por instrução) | — | É ação do dono (checkpoint); a chave `restrict` permite `ssh … 'comando'` |
| Conector Supabase do claude.ai | Consulta D-05 | ✗ (lista só `rede-social`; ver memória) | — | A consulta entra no comando (tem `DATABASE_URL` na VPS) ou o dono roda no `psql` |

**Missing dependencies with no fallback:** nenhuma para o código; os números de produção dependem de ação humana.
**Missing dependencies with fallback:** conector Supabase → comando/`psql`.

## Validation Architecture

> `workflow.nyquist_validation` está `true` em `.planning/config.json` (lido nesta sessão).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.1 nas duas camadas [VERIFIED: saída `RUN v5.0.1` nesta sessão] |
| Config file | `apps/api/vitest.config.mts` (`fileParallelism: false`, timeouts 180 s); `apps/web/vitest.config.mts` (`environment: "node"`; `// @vitest-environment jsdom` por arquivo `.tsx`) |
| Quick run (api, sem banco) | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run src/persistencia/unidade-de-trabalho-trava.test.ts src/persistencia/unidade-de-trabalho.test.ts src/rotas/operacoes-medicao.test.ts && npx tsc --noEmit` (os dois primeiros: 14 testes em ~1 s, verificados) |
| Full (api, sem banco) | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` → **119 arquivos passam, 36 pulam, 1164 testes, ~52 s** (verificado nesta sessão) |
| Quick run (web) | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados` (10 arquivos, 99 testes, ~2 s, verificado) |
| Full (web) | `cd apps/web && npx vitest run` → **92 arquivos, 847 testes, ~13 s** (verificado) + `npm run lint -w @n1/web` |
| Com banco real | `docker run -d --rm --name crm-n1-pg-12NN -e POSTGRES_PASSWORD=x -p <porta livre>:5432 postgres:16`; `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:<porta>/postgres DATABASE_URL_MIGRACAO=<mesma> npm run migrar && DATABASE_URL=… DATABASE_URL_MIGRACAO=… npx vitest run src/persistencia/unidade-de-trabalho-concorrencia.test.ts src/rotas/operacoes.test.ts src/rotas/estado.test.ts` (padrão das Fases 10–11; **nunca** contra o `.env`) |
| Gate de fase | `npm run check` com o Docker migrado (≈3 min nas Fases 10–11; falha esperada só em `lote-contas-a-pagar` de contêiner novo, ver memória) ou, se der 124, rodadas dirigidas (`--exclude 'src/e2e/lote-contas-a-pagar.test.ts'`) |

**Quais testes pulam sem `DATABASE_URL`:** 36 arquivos da API (blocos `describe.skip` por `temBanco`/`describeComBanco`), inclusive o bloco "contra o banco real" de `rotas/operacoes.test.ts` (só confere se `DATABASE_URL` existe depois de `carregarEnv()`; **sem URL local explícita cai no `.env`**, por isso sempre passar `DATABASE_URL=` vazia ou a do Docker).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRV-01 | Cada gravação loga nome + etapas; `medicao` fora do corpo (200, recusa, 409) | integração sem banco (`vi.mock` de `executar`, `buildApp({ logger: { stream } })`, `app.inject`) | `cd apps/api && DATABASE_URL= npx vitest run src/rotas/operacoes-medicao.test.ts` | ❌ Wave 0 |
| GRV-01 | Etapas, `tentativas`, `linhasLidas` coletados por `executar` (fake de pool); `aoMedir` chamado também em conflito/exceção | unit | `cd apps/api && DATABASE_URL= npx vitest run src/persistencia/unidade-de-trabalho.test.ts` | ✅ (estender) |
| GRV-01 | Mediana, pior caso e formatação da tabela do comando | unit puro | `cd apps/api && DATABASE_URL= npx vitest run src/observabilidade/medicao-da-gravacao.test.ts` | ❌ Wave 0 |
| GRV-01 | O comando repete 4 gestos ×10 e imprime a tabela; tamanho do banco | **manual/produção** (checkpoint do dono) → `12-PROVAS.md` | `ssh … 'cd /opt/n1-crm/current && npm run gravacao:medir -w @n1/api -- --repeticoes=10'` | n/a |
| GRV-02 | Parada com a tabela na mão; meta preenchida; sessão C no ROADMAP se > 300 ms | **manual** (checkpoint `[BLOCKING]`) + `grep` de conferência | `grep -n "Meta (fixada na parada)" -A3 .planning/phases/12-*/12-CONTEXT.md` (sem o texto "A preencher") | n/a |
| GRV-03 | Trava é a 1ª instrução depois do `begin`; `55P03` na trava → 409, 1 rollback, sem repetir; regime otimista mantém 3 tentativas; Q=0 com lock de reserva | unit (fake) | `cd apps/api && DATABASE_URL= npx vitest run src/persistencia/unidade-de-trabalho-trava.test.ts` | ✅ (reescrever os casos das linhas 101 e 110) |
| GRV-03 | 2 `executar()` simultâneas: ambas gravam, 1 tentativa cada, `hidratar` ×2, revisões `n+1`/`n+2` | integração, Postgres local | `cd apps/api && DATABASE_URL=<docker> DATABASE_URL_MIGRACAO=<docker> npx vitest run src/persistencia/unidade-de-trabalho-concorrencia.test.ts` | ❌ Wave 0 |
| GRV-03 | As 4 importações passam `regime: "otimista"`; os demais, não | unit (espiar `executar` nos testes dos importadores existentes ou um teste por `grep` estático) | `cd apps/api && DATABASE_URL= npx vitest run src/importacao` | ✅ (estender) |
| GRV-04 | `run` com 2 chamadas aplica 2 diferenças em ordem e não chama `hidratar` | unit (transporte falso) | `cd apps/web && npx vitest run src/dados/store.test.ts` | ✅ (novo caso; hoje `(h)` só prova o envio) |
| GRV-04 | `transporteHttp.gravar` devolve a lista, parando na 1ª que não for `diferenca` | unit (`fetch` falso) | `cd apps/web && npx vitest run src/dados/transporte.test.ts` | ✅ (ajustar `(g)`) |
| GRV-05 | `data.lists` já tem a Lista antes de o transporte responder; `ok:false` a remove e `lastResult.error` traz a mensagem | unit (transporte lento) | `cd apps/web && npx vitest run src/dados/store.test.ts` | ✅ (novo; inverter `(b)`) |
| GRV-05 | Dois `run` seguidos: 1 pedido em voo por vez, ordem preservada; recusa do 1º refaz o 2º; replay que falha some com erro | unit | idem | ❌ Wave 0 (casos novos) |
| GRV-05 | Lista de exceções: chaves válidas (`ehNomeDeOperacao`) e motivos não vazios; gesto com exceção não vira `data` na hora | unit | `cd apps/web && npx vitest run src/dados/operacoes-que-esperam.test.ts` | ❌ Wave 0 |
| GRV-05 | Lista nova aparece sem link e com `aria-busy` até confirmar; depois ganha link | jsdom (molde `arvore-menu.test.tsx`) | `cd apps/web && npx vitest run src/features/shell` | ✅ (estender) |
| GRV-05 | `beforeunload` só avisa com `pendentes > 0` | unit da função pura | `cd apps/web && npx vitest run src/dados/store.test.ts` | ❌ Wave 0 |
| GRV-06 | Tabela antes/depois com o mesmo comando, comparada à meta | **manual** (checkpoint do dono) | idem GRV-01 | n/a |

### Sampling Rate
- **Por commit de tarefa:** o quick run da camada tocada (API: os 2–3 arquivos acima + `npx tsc --noEmit`; web: `npx tsc --noEmit && npx vitest run src/dados`).
- **Por onda:** suíte completa sem banco da API (52 s) **e** da web (13 s) — obrigatório nas ondas do store (Pitfall 10).
- **Gate de fase:** rodada com Postgres local (concorrência, `operacoes.test.ts`, `estado.test.ts`) + `npm run check` local/Docker; `/gsd-verify-work` só com tudo verde exceto o baseline conhecido (`lote-contas-a-pagar`).

### Wave 0 Gaps
- [ ] `apps/api/src/rotas/operacoes-medicao.test.ts` — GRV-01 (sem vazamento + linha de log)
- [ ] `apps/api/src/observabilidade/medicao-da-gravacao.test.ts` — GRV-01 (mediana/pior caso/tabela)
- [ ] `apps/api/src/persistencia/unidade-de-trabalho-concorrencia.test.ts` — GRV-03 (Postgres local, `describeComBanco`)
- [ ] `apps/web/src/dados/operacoes-que-esperam.test.ts` — GRV-05
- [ ] Ajuste dos fakes de `unidade-de-trabalho*.test.ts` (linha do `select … for update`, `linhasLidas` defensivo) — Pitfall 5
- [ ] Auxiliar de teste do transporte lento/controlável (promessa que o teste solta, como já faz `store.test.ts (o)` com `soltar`) — GRV-05
- [ ] Container Docker local para os testes com banco: `docker run … postgres:16` (já disponível; sem instalação)

## Security Domain

> `security_enforcement` está habilitado (ausente/`true`; `security_asvs_level: 1`, `security_block_on: "high"` em `config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim (comando) | O comando **não** cria caminho de autenticação nem segredo em arquivo: stub de `verificarToken` só dentro do `.cli.ts`, nunca exportado nem ligado por env; a API em produção segue com `verificarTokenDoSupabase` |
| V3 Session Management | não muda | JWT do Supabase como hoje |
| V4 Access Control | sim | O comando age como o **Proprietário** e só nos ids que criou; `POST /operacoes` continua aplicando permissão do domínio (`mayBuild` etc.). A trava não altera quem pode gravar |
| V5 Input Validation | sim | Argumentos do comando (`--repeticoes`, `--membro`) validados como inteiros/ids; o nome da operação logado já passou por `ehNomeDeOperacao` |
| V6 Cryptography | não | Nada novo; não inventar token |
| V7 Error Handling and Logging | **sim, principal** | A linha de medição leva só `operacao` (nome validado) e números; **nunca** `args`, `valor`, títulos, nomes (dado financeiro/pessoal); `redact` do logger (`observabilidade/log.ts`) continua cobrindo `authorization`; 409/500 também logam sem corpo |
| V8 Data Protection | sim | O comando escreve em produção (D-04): Espaço de teste identificável, tudo à lixeira ao fim, saída só com contagens/ms |
| V13/disponibilidade (DoS) | sim | Esperas de até 10 s por conexão num pool de 10 (Pitfall 2): `lock_timeout` limitado, 1 tentativa, `conexaoMs` medido |

### Known Threat Patterns for {Fastify + pg + store zustand}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vazamento de campo interno na resposta (`medicao`) | Information Disclosure | `aoMedir` por callback ou destruturar antes de enviar; teste de chaves do corpo nos 3+2 pontos de `send` |
| Log injection pelo nome da operação | Tampering | Logar só depois de `ehNomeDeOperacao`; nunca interpolar `args` |
| Stub de `verificarToken` alcançável em produção | Spoofing / Elevation | Stub confinado ao `.cli.ts` (sem export, sem env); revisão do plano deve provar que `app.ts`/`index.ts` não o importam |
| Comando escrevendo fora do Espaço de teste | Tampering | Só ids criados pelo comando; `finally` manda o resto à lixeira; recusar rodar se `--workspace` ≠ o do `.env` sem flag explícita |
| Pool esgotado por esperas de trava (DoS por escritor lento) | Denial of Service | `lock_timeout` ≤ Q/3, uma tentativa, 409 limpo e re-hidratação; medir `conexaoMs` |
| Mudança otimista mostrada e perdida (a pessoa acredita que gravou) | Repudiation/Integrity (UX) | `beforeunload` com `pendentes > 0`; erro visível em `lastResult` (D-14) |
| Segredo de link mostrado na tela antes de existir (formulário/compartilhamento) | Information Disclosure | Operações com `secret()` na lista de exceções: só aparecem depois do servidor |

## Sources

### Primary (HIGH confidence)
- Código lido integralmente nesta sessão: `apps/api/src/persistencia/{unidade-de-trabalho,repositorio,conexao,canais-projetados,membros,unidade-de-trabalho-trava.test,unidade-de-trabalho.test}.ts`, `persistencia/CONTEXT.md`, `rotas/{operacoes (200-396),estado}.ts`, `plugins/autenticacao.ts`, `app.ts`, `autenticacao/verificar-token.ts`, `servicos/idempotencia.ts`, `persistencia/outbox.ts`, `repositorios/crm/referencias.ts`, `apps/web/src/dados/{store,transporte,store.test}.ts`, `features/shell/{app-shell (trechos),linha-da-arvore}.tsx`, `packages/dominio/src/operations/{registro,scale,structure (assinaturas),automations (cabeçalho)}.ts`, `ferramentas/provedor-simulado.ts`, `diferenca.ts`, `colecoes.ts`.
- Postgres (documentação oficial): https://www.postgresql.org/docs/current/transaction-iso.html (Read Committed, `SELECT FOR UPDATE`), https://www.postgresql.org/docs/current/runtime-config-client.html (`lock_timeout`, `statement_timeout`, `idle_in_transaction_session_timeout`), https://www.postgresql.org/docs/current/functions-admin.html (`pg_column_size`).
- Experimento local descartável (Docker `postgres:16`) confirmando `55P03` em `SELECT … FOR UPDATE` com `lock_timeout` e a leitura da revisão nova depois da espera.
- Execuções locais nesta sessão: `apps/api` sem banco (119 passam, 36 pulam, 1164 testes, ~52 s), `apps/web` (92 arquivos, 847 testes, ~13 s), quick runs de `unidade-de-trabalho*.test.ts` e `src/dados`.

### Secondary (MEDIUM confidence)
- `apps/api/deploy/{CONTEXT.md,preparar-vps.sh,instalar-release.sh,publicar.sh,n1-crm-api.service}` e `docs/08-migracao-financeiro/05-topologia-e-regiao.md` (RTT ~234 ms, tabela §5 vazia).
- Memória do projeto (`gsd-gate-de-testes-baseline`, `deploy-da-api-e-manual-na-vm`, `supabase-projeto-n1-crm`) para baseline de testes, deploy manual e permissões do `n1crm`.

### Tertiary (LOW confidence)
- Nenhuma fonte web só-busca foi usada. Itens `[ASSUMED]` estão no Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma dependência nova; versões lidas dos `package.json` e do vitest em execução.
- Architecture: HIGH para `executar()`/regimes/vazamento (código lido por inteiro); MEDIUM para o comando (Open Question 1) e para a lista de exceções (critério firme, conteúdo parcialmente `[ASSUMED]`).
- Pitfalls: HIGH — cada um com arquivo:linha ou experimento; Pitfall 10 (testes de tela) é previsão baseada no padrão das fakes, a validar rodando a suíte.

**Research date:** 2026-10-30
**Valid until:** 2026-11-29 (código interno estável; reler `unidade-de-trabalho.ts` e `store.ts` se outra fase os tocar antes — a Fase 11 declarou que não toca)
