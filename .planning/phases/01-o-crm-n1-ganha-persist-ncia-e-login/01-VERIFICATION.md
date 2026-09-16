---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
verified: 2026-09-16T18:38:28Z
status: gaps_found
score: 4/5 critérios de sucesso do ROADMAP verificados (1 parcial); 2 achados críticos do 01-REVIEW.md confirmados no código e não corrigidos
overrides_applied: 0
gaps:
  - truth: "Reconvidar um Usuário removido reativa o mesmo Membro (RN-ET-11), sem criar um segundo (Critério 5 do ROADMAP; PERS-09)"
    status: partial
    reason: >
      O caminho testado e coberto (Membro que já foi `ativo`, ficou `removido`
      preservando `userId`, e é reconvidado) reativa corretamente o MESMO
      Membro — confirmado por `members-reconvite.test.ts` (a) e por
      `convidar-membro.test.ts` (a)/(c) contra o Supabase Auth real, ambos
      verdes. Mas existe um caminho não fechado, apontado pelo 01-REVIEW.md
      (CR-01) e confirmado lendo o código atual: quando um Membro nasce
      `pendente` só por `invitedIdentity` (convidado antes de ter conta no
      Supabase Auth) e, depois, o e-mail passa a resolver um `userId` (a
      pessoa criou a conta), um reconvite cria um SEGUNDO Membro `pendente`
      para o mesmo e-mail — porque `inviteMember` busca `existing` só por
      `userId` quando ele está presente, nunca em paralelo por
      `invitedIdentity`. O próprio `members-reconvite.test.ts` (b) documenta
      esse caminho como "a lacuna que o serviço de apps/api fecha", mas o
      serviço (`convidarMembro`) não fecha essa lacuna: ele só passa o
      `userId` resolvido para `inviteMember`, que continua buscando por um
      único critério.
    artifacts:
      - path: "packages/dominio/src/operations/members.ts"
        issue: "linhas ~330-337: `existing` busca só por `userId` quando presente; nunca casa em paralelo com um Membro `pendente` por `invitedIdentity` do mesmo e-mail — código idêntico ao citado em CR-01 do 01-REVIEW.md, sem correção aplicada"
    missing:
      - "Casar `existing` pelos dois critérios (por `userId` OU por `invitedIdentity`), com `userId` prevalecendo quando os dois existem — a correção já desenhada em CR-01 do 01-REVIEW.md"
      - "Um teste em `members-reconvite.test.ts` cobrindo 'pendente por invitedIdentity + userId resolvido depois → recusa, não cria um segundo Membro'"
  - truth: "POST /operacoes/:nome roda cada operação dentro da Unidade de Trabalho com segurança suficiente para não persistir dado corrompido nem cair em 500 por entrada hostil de um Membro autenticado (decorre do Critério 2 do ROADMAP e da premissa de que a rota não reimplementa regra, mas também não a substitui por ausência de validação)"
    status: failed
    reason: >
      O schema do corpo é `args: z.array(z.unknown()).max(32)`; depois de
      `reviverArgumentos`, os argumentos são espalhados direto nas ~130
      operações do domínio, que foram escritas para um protótipo em memória e
      não validam forma em runtime. Confirmado lendo `operacoes.ts`: não há
      schema por operação nem checagem estrutural de `args`. Efeito
      verificável: (a) qualquer Membro autenticado consegue derrubar a
      requisição em 500 com uma entrada trivial (ex.: `updateTask` com
      `title` numérico dispara `TypeError` em `.trim()`); (b) alguns campos
      só são comparados por `!==`, então um objeto onde o domínio espera
      escalar É GRAVADO no `jsonb` e todo Membro do Espaço hidrata esse
      registro malformado na próxima carga — a "verdade do servidor" (D-03)
      passa a conter o que o cliente quiser mandar. CR-02 do 01-REVIEW.md,
      código confirmado, sem correção aplicada.
    artifacts:
      - path: "apps/api/src/rotas/operacoes.ts"
        issue: "BODY.args = z.array(z.unknown()).max(32) sem schema por operação; TypeError lançado dentro de operacao(...) sobe ao setErrorHandler genérico como 500, não como 400 de entrada inválida"
    missing:
      - "Schemas por operação (ao menos para as mais expostas) ou um schema estrutural conservador para args, conforme a correção desenhada em CR-02 do 01-REVIEW.md"
      - "Tratar TypeError lançado dentro de operacao(...) como 400, não 500"
      - "Um teste em operacoes.test.ts: updateTask com title:123 → 400, description:{} → 400, nunca persistido"
human_verification:
  - test: "Logar como maryane@n1.teste (senha de desenvolvimento) em http://localhost:3001/entrar, abrir Gestão › Financeiro › Contas a pagar, criar uma Conta a pagar pela tela, recarregar a página (F5)."
    expected: "A Lista abre vazia de Tarefas fictícias; a Conta criada aparece e CONTINUA lá depois do F5 — critério 1 do ROADMAP, a parte 'pela tela' que só um navegador prova (o e2e de apps/api/src/e2e/criar-conta.test.ts já prova o equivalente por inject, e essa prova passou; falta o olho humano na tela real)."
    why_human: "Persistência através de recarga de página e a ausência de spinner/requisição numa recusa são efeitos visuais/perceptuais que app.inject() não reproduz."
  - test: "Na mesma sessão, tentar mover a Conta recém-criada para 'pago' (RN-CP-04, a Maryane não é Aprovadora)."
    expected: "A recusa aparece na hora, sem spinner e sem requisição na aba Rede do DevTools (D-05); no DevTools › Rede, a criação da Conta aparece como POST /operacoes/createTask com resposta 200 contendo diferenca e revisao."
    why_human: "Percepção de latência (presença/ausência de requisição de rede) não é assertável por app.inject(); é o mesmo cenário que 01-07-PLAN.md e 01-09-PLAN.md documentam como <human-check> em tasks auto, deferido para o fim da fase."
  - test: "Sair e entrar como tiago@n1.teste (removido no seed, não existe no Espaço 'Gestão' bootstrapado)."
    expected: "'Sem acesso' — o Membro não existe no Espaço bootstrapado (só a Maryane é Membro, D-08)."
    why_human: "Fluxo de cookie/sessão no navegador real; o hook de autenticação do apps/api já prova 403 para não-Membro por app.inject() (autenticacao.test.ts), mas a tela de 'Sem acesso' em si não foi inspecionada por mim."
---

# Fase 1: O CRM N1 ganha persistência e login — Relatório de Verificação

**Meta da fase:** O CRM N1 deixa de ser protótipo — um Membro real entra com e-mail e senha, cria uma Conta pela tela e ela está no Postgres da plataforma; toda operação do domínio chega ao backend por HTTP e roda na Unidade de Trabalho, sem que o domínio ou os 214 testes mudem.
**Verificado em:** 2026-09-16
**Status:** gaps_found
**Re-verificação:** Não — verificação inicial

## Metodologia

Verificação goal-backward: nenhuma alegação de SUMMARY.md foi aceita sem evidência direta. Evidências coletadas por: leitura dos 9 PLAN.md (must_haves em frontmatter) e dos 9 SUMMARY.md; execução de `npm run check` (com `DATABASE_URL`/`SUPABASE_*` reais); execução isolada de `vitest run --reporter=verbose` em `apps/api` listando cada teste; consultas SQL de leitura direta contra o Supabase real do projeto (`ws_n1`) via `pg`, fora dos testes, para confirmar de forma independente o que o bootstrap gravou; `git diff d713253 -- <arquivo>` nos três arquivos de teste originais do domínio; subida e queda controlada de `apps/api` (`npm run dev`) para confirmar `GET /saude` e `GET /estado` sem token; leitura de código-fonte linha a linha para os dois achados críticos do 01-REVIEW.md. Nenhum servidor ficou de pé ao final (porta 3002 confirmada livre); a porta 3001 (`apps/web`) foi deixada como estava, conforme instrução do ambiente.

## Goal Achievement

### Critérios de Sucesso do ROADMAP

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | Membro real entra em `/entrar`, é resolvido pelo Usuário, cria uma Conta pela tela, e ela persiste no Postgres após recarregar | ⚠️ VERIFICADO PARCIALMENTE (metade automatizada, metade precisa de navegador) | `apps/web/src/app/entrar/page.tsx`+`actions.ts` autenticam por Supabase Auth; `(shell)/layout.tsx` resolve sessão por `usuarioAtual()` + `carregarEstadoInicial()` (GET /estado), nunca por escolha manual. O equivalente ponta a ponta sem navegador está em `apps/api/src/e2e/criar-conta.test.ts` — rodei os 8 subtestes isoladamente contra o Supabase real: todos verdes, incluindo "(4) recarregar a página: um app novo ainda vê a Conta" e "(7) diff aplicado no cliente ≡ re-hidratação". A parte estritamente "pela tela, no navegador" não foi executada por mim (preciso de browser) — listada em Human Verification. |
| 2 | Toda operação dos 16 módulos chega por `POST /operacoes/:nome` e roda na UoW com o Membro da sessão; API pública do store não muda | ⚠️ VERIFICADO, COM RESSALVA DE ROBUSTEZ (gap CR-02) | 16 arquivos de operação em `packages/dominio/src/operations/` (confirmado por `ls`, excluindo `index.ts`/`registro.ts`) alimentam `OPERACOES` (132 entradas, allowlist por `Object.hasOwn`). `apps/api/src/rotas/operacoes.ts` despacha por `OPERACOES[nome]` dentro de `executar()` (hidratar→operação→diff→revisão), com `request.membro.id` sempre da sessão (nunca do corpo — `apps/api/src/plugins/autenticacao.ts`). `npm run check` compila os 3 workspaces sem editar nenhum dos 143 pontos de chamada do store (a assinatura de `run()` não mudou — se tivesse mudado, o typecheck do `apps/web` teria falhado). Testes `operacoes.test.ts` (10 casos, incluindo 404 para `__proto__`/`nextId`/nome inexistente, 409 comentado no código via revisão, recusa em 200) todos verdes contra o banco real. **Ressalva:** a rota aceita `args: unknown[]` sem validação de forma por operação (CR-02, ver Gaps) — a garantia "roda na UoW" existe, mas sem a garantia de que o que roda não corrompe o Espaço para os demais Membros. |
| 3 | Espaço "Gestão" › Financeiro › Listas "Contas a pagar"/"Contas a receber" no banco, com Status/Campos/Tags/Papéis dos SPECs, sem Tarefas fictícias; Lista de Contas a pagar filtra por status, vencimento, Tag `conta *`, Responsável e Pessoa com coluna gerada e índice | ✓ VERIFICADO DIRETO NO BANCO | Consulta SQL própria (fora dos testes) contra `ws_n1` no Supabase real: `select colecao, count(*) ... group by 1` devolve 20 coleções, SEM `tasks`/`contacts`/`activity`/`conversations`/`chatSessions` — 98 registros no total, batendo exatamente com o número que 01-05-SUMMARY.md alega. `members`=1 (`mem_maryane`, `state:ativo`, `roleId:role_prop`), `workspace.ownerMemberId = mem_maryane` — D-08 confirmado por leitura direta, não por teste. `packages/dominio/src/bootstrap-gestao.test.ts` prova adicionalmente `s.tasks.length===0`, `s.contacts.length===0`, `s.activity.length===0` e que a Maryane consegue `createTask` na Lista de Contas a pagar. Migração `002` com 3 colunas geradas + 6 índices parciais aplicada e provada por `colunas-geradas.test.ts` (10 testes verdes contra o banco real, incluindo o teste do planejador confirmando uso de índice, não Seq Scan). |
| 4 | `npm run check` verde nos 3 workspaces; 214 testes do domínio inalterados; hidratado ≡ seed vale contra o Supabase; ClickUp e `automation/` intocados | ✓ VERIFICADO | `npm run check` rodado por mim: typecheck (3 workspaces) + lint (web, único workspace com `lint` script no monorepo — convenção pré-existente, não desta fase) + `verificar:tokens` + testes → **357 testes verdes** (250 domínio + 54 api + 53 web), exatamente os números documentados. `git diff d713253 -- operations.test.ts seed-produto.test.ts contas-a-receber.test.ts` devolveu vazio nos três — zero diff confirmado por mim, não só alegado. `persistencia.test.ts > hidrata um estado equivalente ao que o seed monta` rodou contra o Supabase real (log `hidratar: 906 registros em 1414 ms`) e passou. `ClickUp`/`automation/` não existem neste repositório (são sistemas externos) — não há como este código tê-los tocado; nenhum commit da fase referencia esses caminhos. |
| 5 | Reconvidar um Usuário removido reativa o mesmo Membro (RN-ET-11), sem criar um segundo | ⚠️ VERIFICADO PARCIALMENTE — gap confirmado (CR-01) | O caminho literal do critério ("Usuário removido" — já foi `ativo`, tem `userId`, foi removido, é reconvidado) está coberto e verde: `members-reconvite.test.ts` (a), `convidar-membro.test.ts` (a)/(c) contra o Auth real (`userId forjado no corpo é ignorado — a rota resolve pelo Auth real e reativa mem_tiago`). Mas existe um caminho irmão da mesma regra (RN-ET-11/INV-ET-04) que ainda cria um segundo Membro — ver Gaps, CR-01. |

**Placar:** 3/5 critérios totalmente verificados sem ressalva (3, 4, e o núcleo automatizável do 2); 2/5 com ressalva registrada como gap (1 precisa de navegador para fechar — não é um gap de código, é verificação pendente; 5 tem um gap de código real e reproduzível).

### Artefatos Obrigatórios (por plano)

Todos os 27 artefatos declarados em `must_haves.artifacts` nos 9 PLAN.md existem e são substantivos (nenhum stub, nenhum arquivo vazio ou abaixo do `min_lines` declarado):

| Artefato | Plano | Status | Linhas |
|---|---|---|---|
| `apps/api/src/app.ts` | 02 | ✓ VERIFICADO | 102 |
| `apps/api/src/plugins/autenticacao.ts` | 02 | ✓ VERIFICADO | 82 |
| `apps/api/src/persistencia/membros.ts` | 02 | ✓ VERIFICADO | 28 |
| `apps/api/src/autenticacao/verificar-token.ts` | 02 | ✓ VERIFICADO | 46 |
| `apps/api/src/index.ts` | 02 | ✓ VERIFICADO | 26 |
| `packages/dominio/src/operations/registro.ts` | 03 | ✓ VERIFICADO (min 150) | 470 |
| `packages/dominio/src/diferenca.ts` | 03 | ✓ VERIFICADO | 97 |
| `packages/dominio/src/operations/activity.ts` | 03 | ✓ VERIFICADO | 113 |
| `apps/api/src/rotas/operacoes.ts` | 04 | ✓ VERIFICADO (mas ver gap CR-02) | 131 |
| `apps/api/src/rotas/estado.ts` | 04 | ✓ VERIFICADO | 32 |
| `apps/api/src/persistencia/repositorio.ts` | 04 | ✓ VERIFICADO | 251 |
| `apps/api/src/persistencia/unidade-de-trabalho.ts` | 04 | ✓ VERIFICADO | 88 |
| `packages/dominio/src/bootstrap-gestao.ts` | 05 | ✓ VERIFICADO | 196 |
| `packages/dominio/src/seed-financeiro.ts` | 05 | ✓ VERIFICADO | 708 |
| `packages/dominio/src/seed-contas-a-receber.ts` | 05 | ✓ VERIFICADO | 376 |
| `apps/api/src/bootstrap/gestao.ts` | 05 | ✓ VERIFICADO | 51 |
| `apps/api/migracoes/002-registros-colunas-geradas.sql` | 06 | ✓ VERIFICADO | 93 |
| `apps/api/src/persistencia/colunas-geradas.test.ts` | 06 | ✓ VERIFICADO | 250 |
| `apps/web/src/dados/transporte.ts` | 07 | ✓ VERIFICADO | 206 |
| `apps/web/src/dados/estado-inicial.ts` | 07 | ✓ VERIFICADO | 69 |
| `apps/web/src/dados/store.ts` | 07 | ✓ VERIFICADO | 287 |
| `apps/web/src/dados/store.test.ts` | 07 | ✓ VERIFICADO | 238 |
| `packages/dominio/src/operations/members.ts` | 08 | ✓ VERIFICADO (mas ver gap CR-01) | 673 |
| `apps/api/src/autenticacao/resolver-usuario.ts` | 08 | ✓ VERIFICADO | 46 |
| `apps/api/src/servicos/convidar-membro.ts` | 08 | ✓ VERIFICADO | 43 |
| `apps/api/src/e2e/criar-conta.test.ts` | 09 | ✓ VERIFICADO (min 60) | 213 |
| `apps/api/README.md` | 09 | ✓ VERIFICADO | 94 |

### Verificação de Key Links (Wiring)

Amostra dos elos mais críticos, verificados por leitura de código (não só grep):

| De | Para | Via | Status |
|---|---|---|---|
| `apps/web/src/app/(shell)/layout.tsx` | `apps/web/src/dados/estado-inicial.ts` | `await carregarEstadoInicial()` | ✓ WIRED — código lido linha a linha, `redirect("/entrar")` sem sessão e sem token válido |
| `apps/web/src/dados/store.ts` `run()` | `packages/dominio/src/operations/registro.ts` | `gravarChamadas(() => operation(copia, session.memberId))` + `structuredClone` antes | ✓ WIRED — recusa (`ok:false`) retorna sem chamar `enviar()`; aceite dispara `void enviar(...)` sem await |
| `apps/web/src/dados/store.ts` `enviar()` | `packages/dominio/src/diferenca.ts` | `aplicarDiferenca(get().data, get().ordens, resposta.diferenca)` + re-hidrata se `revisaoAnterior` divergir | ✓ WIRED — D-05/D-06 confirmados no código, não só no comentário |
| `apps/api/src/rotas/operacoes.ts` | `packages/dominio/src/operations/registro.ts` | `ehNomeDeOperacao(nome)` + `OPERACOES[nome]` dentro de `executar()` | ✓ WIRED — `__proto__`/`nextId`/nome inexistente → 404, confirmado por teste real |
| `apps/api/src/rotas/operacoes.ts` | `apps/api/src/servicos/convidar-membro.ts` | `SERVICOS.inviteMember → convidarMembro(...)`, `userId` do corpo descartado (`.strip()`) | ✓ WIRED — teste "(c) userId forjado no corpo é ignorado" verde contra o Auth real |
| `apps/api/src/bootstrap/gestao.ts` | `apps/api/src/persistencia/repositorio.ts` | `semear(cliente, workspaceId, buildGestaoBootstrap(...))`, guardado por `count(*)>0` | ✓ WIRED — confirmado por leitura direta do banco (`ws_n1`, 98 registros) e por teste de segunda execução no-op |

### Data-Flow Trace (Nível 4)

| Artefato | Variável de dado | Origem | Dado real? | Status |
|---|---|---|---|---|
| `(shell)/layout.tsx` → `StoreProvider` | `inicial` (DataState) | `carregarEstadoInicial()` → `GET /estado` → `hidratar()` sobre `plataforma.registros` | Sim — confirmado por consulta SQL direta mostrando 98 registros reais em `ws_n1`, não um array estático | ✓ FLOWING |
| `apps/api/src/rotas/estado.ts` | `data`, `ordens`, `sessao.memberId` | `hidratar(cliente, request.membro.workspaceId)` | Sim — `persistencia.test.ts` prova `toStrictEqual` contra o seed real | ✓ FLOWING |
| `apps/api/src/rotas/operacoes.ts` | `diferenca` na resposta | `gravar()` devolve `RegistroGravado[]`/`RegistroRemovido[]` reais, não contagem | Sim — teste (g) `addTaskComment ... grava e devolve o diff` verde contra o banco | ✓ FLOWING |

### Behavioral Spot-Checks

| Comportamento | Comando | Resultado | Status |
|---|---|---|---|
| `GET /saude` sem token responde 200 | `apps/api` subido com `npm run dev`, depois `curl -s http://127.0.0.1:3002/saude` | `{"ok":true,"servico":"apps/api"}` | ✓ PASS |
| `GET /estado` sem token responde 401 | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/estado` | `401` | ✓ PASS |
| `npm run check` completo (typecheck+lint+tokens+test, 3 workspaces, com `DATABASE_URL`/`SUPABASE_*` reais) | `npm run check` | 357/357 testes verdes | ✓ PASS |
| Suíte `apps/api` isolada, listando cada teste | `npx vitest run --reporter=verbose` em `apps/api` | 54/54, incluindo os 8 subtestes do e2e `criar-conta.test.ts` nominalmente listados | ✓ PASS |
| Zero Tarefas/Contatos/Atividade no Espaço bootstrapado, contra o banco real | consulta SQL própria (`select colecao, count(*) ... group by 1`) | 20 coleções presentes, nenhuma `tasks`/`contacts`/`activity`/`conversations`/`chatSessions`; total 98 registros | ✓ PASS |
| `members` do Espaço bootstrapado tem só a Maryane, Proprietária | consulta SQL própria | `mem_maryane`, `role_prop`, `ativo`; `workspace.ownerMemberId = mem_maryane` | ✓ PASS |
| Os 3 arquivos de teste originais do domínio sem diff desde `d713253` | `git diff d713253 -- operations.test.ts seed-produto.test.ts contas-a-receber.test.ts` | saída vazia nos três | ✓ PASS |
| Achado CR-01 do 01-REVIEW.md (busca só por `userId`) ainda presente no código | leitura de `members.ts:330-337` | código idêntico ao citado no achado, sem correção | ✗ FAIL (gap, ver acima) |
| Achado CR-02 do 01-REVIEW.md (`args: unknown[]` sem schema) ainda presente no código | leitura de `operacoes.ts:36-43` | `BODY.args = z.array(z.unknown()).max(32)`, sem schema por operação | ✗ FAIL (gap, ver acima) |

Servidor `apps/api` encerrado ao fim do spot-check; porta 3002 confirmada livre (`lsof -i :3002` vazio). Porta 3001 (`apps/web`) deixada como estava, conforme instrução do ambiente.

### Requirements Coverage

| Requisito | Plano(s) | Descrição (REQUIREMENTS.md) | Status | Evidência |
|---|---|---|---|---|
| PERS-01 | 09 (regressão) | Repositórios + Unidade de Trabalho | ✓ SATISFIED | Já feito antes da fase (`9fb2754`..); `persistencia.test.ts` continua verde contra o Supabase real, confirmado por mim |
| PERS-02 | 09 (regressão) | `/entrar` autentica por Supabase Auth, Membro resolvido pelo Usuário | ✓ SATISFIED | Já feito antes da fase (`d713253`); `(shell)/layout.tsx` e `entrar/actions.ts` inalterados na função, `autenticacao.test.ts` verde |
| PERS-04 | 01, 02, 03, 04, 09 | Rotas HTTP por operação, UoW, Membro da sessão | ⚠️ SATISFIED COM RESSALVA | Rotas existem e funcionam (10 testes de `operacoes.test.ts` verdes); ressalva CR-02 (validação de forma dos args) |
| PERS-05 | 03, 07 | `store.ts` troca `run()` local por `POST` | ✓ SATISFIED | API pública do store inalterada (typecheck dos 143 call-sites passa); `store.test.ts` prova D-05/D-06 |
| PERS-06 | 05 | Bootstrap do Espaço "Gestão" sem fixtures | ✓ SATISFIED | Confirmado por consulta SQL direta contra o banco real, não só por teste |
| PERS-07 | 06 | Colunas geradas e índices | ✓ SATISFIED | 10 testes de `colunas-geradas.test.ts` verdes contra o banco real, incluindo prova do planejador |
| PERS-08 | 09 (documental) | Onde `apps/api` roda | **Bloqueado por decisão D11** — não é código desta fase; documentado em `apps/api/README.md` §5 e em `REQUIREMENTS.md` linha 116/31. Tratado como **accounted-for-but-blocked**, não como lacuna silenciosa. | `apps/api/README.md:66-76` confirma explicitamente: "Ainda não decidido... PERS-08 não bloqueia o código desta fase" |
| PERS-09 | 08 | RN-ET-11 — reconvite reativa o mesmo Membro | ⚠️ SATISFIED COM RESSALVA | Caminho principal (Usuário removido) funciona e está testado; gap CR-01 no caminho irmão (pendente por invitedIdentity → userId resolvido depois) — ver Gaps |

**Nenhum requisito órfão:** todos os 8 IDs de `ROADMAP.md` linha 48 aparecem em pelo menos um `requirements:` de PLAN.md; nenhum ID adicional em `REQUIREMENTS.md` mapeado para a Fase 1 ficou de fora dos planos.

### Anti-Patterns Found

Origem: `01-REVIEW.md` (revisão de código já completada nesta fase, 61 arquivos, 2026-09-16), com confirmação direta por mim nos dois achados críticos e spot-check nos demais.

| Arquivo | Achado | Severidade | Impacto no critério/must-have | Confirmado por mim? |
|---|---|---|---|---|
| `packages/dominio/src/operations/members.ts:330-337` | CR-01 — reconvite não casa por `invitedIdentity` quando `userId` está presente | 🛑 Gap estruturado acima | Ameaça o "sem criar um segundo" do Critério 5 num caminho irmão do testado | Sim — leitura de código |
| `apps/api/src/rotas/operacoes.ts:36-43` | CR-02 — `args: unknown[]` sem schema por operação | 🛑 Gap estruturado acima | Ameaça a integridade dos dados que "toda operação... roda na Unidade de Trabalho" deveria garantir para todos os Membros do Espaço | Sim — leitura de código |
| `packages/dominio/src/seed-financeiro.ts:110` | WR-01 — status "pago" inalcançável no bootstrap de produção (falta o Aprovador) | ℹ️ Info, não gap | **Não é lacuna:** D-08 em `01-CONTEXT.md` já aceita explicitamente essa consequência ("o processo de Contas a pagar não fecha ponta a ponta sozinho... é esperado e aceito") | Sim — `bootstrap-gestao.test.ts:89-99` celebra a recusa como esperado, exatamente como o REVIEW descreve |
| `apps/api/src/persistencia/registro.ts` (via `operations/registro.ts`) `runScheduledAutomations` | WR-02 — `today` controlado pelo cliente | ⚠️ Warning | Não é must-have desta fase (nenhum plano lista validação de `today` em `must_haves`); fica para quando as Automações A1-A9 entrarem (Phase 3) | Não verificado por mim linha a linha — aceito o achado do REVIEW |
| `apps/web/src/dados/store.ts:97-158` | WR-06 — `enviar()` sem `catch`; exceção de transporte vira rejeição não tratada | ⚠️ Warning | Não é must-have listado em `01-07-PLAN.md`; risco real (feedback enganoso ao usuário) mas fora do escopo formal da fase | Sim — confirmei o `try/finally` sem `catch` lendo `store.ts` |
| `apps/web/src/dados/store.ts:173-185` | WR-08 — clique duplo com `pendentes>0` clona sobre `data` desatualizado | ⚠️ Warning | Idem — fora do escopo formal, mas real | Não verificado por mim linha a linha — aceito o achado do REVIEW |
| `apps/api/CONTEXT.md:28-29,40-41`; `apps/api/package.json:5` | IN-04 — documentação desatualizada ("Hoje só GET /saude", `src/repositorios/`) | ℹ️ Info | Nenhum critério de sucesso menciona documentação; mas o próprio CLAUDE.md do projeto pede que `CONTEXT.md` seja lido antes do código — "estar errado é pior que não existir" | Sim — confirmei as três frases ainda presentes |
| WR-03, WR-04, WR-05, WR-07, IN-01, IN-02, IN-03, IN-05, IN-06, IN-07, IN-08, IN-09 | Demais achados de `01-REVIEW.md` | ⚠️/ℹ️ Warning/Info | Nenhum corresponde a um `must_haves` de nenhum dos 9 planos nem a um Critério de Sucesso do ROADMAP | Não relidos individualmente por mim — ver `01-REVIEW.md` para o texto completo; nenhum contradiz os testes verdes |

Nenhum marcador de débito (`TBD`/`FIXME`/`XXX`) sem referência de issue encontrado nos arquivos-chave lidos.

### Human Verification Required

Ver frontmatter `human_verification`. Resumo: os três itens pendentes são exatamente os `<human-check>` já registrados como deferidos para o fim da fase em `01-02-PLAN.md` (já fechado por mim com `curl` real — ver Behavioral Spot-Checks), `01-05-PLAN.md` (já fechado por mim com consulta SQL direta), `01-07-PLAN.md` e `01-09-PLAN.md` (a parte de navegador de fato — login, criar Conta, F5, recusa sem spinner, `tiago@n1.teste` sem acesso). Só esta última continua sem fechamento automatizável: precisa de um navegador real.

## Gaps Summary

A fase entrega o essencial da meta: persistência real contra o Postgres/Supabase da plataforma (confirmado por consulta direta, não só por teste), rotas por operação cobrindo os 16 módulos do domínio, bootstrap do Espaço "Gestão" sem fixtures, colunas geradas e índices provados contra o banco real, os 214 testes originais do domínio intactos (diff zero confirmado), e `npm run check` verde com 357 testes. A parte "pela tela" do Critério 1 tem o equivalente automatizado (e2e por `inject`) verde, mas falta o olho humano no navegador — não é um gap de código, é uma verificação pendente listada acima.

Dois achados do próprio `01-REVIEW.md`, classificados como críticos e não corrigidos, foram confirmados por leitura direta do código nesta verificação e são reportados como gaps: (1) CR-01 — um caminho irmão do RN-ET-11 (Membro `pendente` por `invitedIdentity` cujo `userId` só é resolvido depois) ainda cria um segundo Membro, o que o Critério 5 do ROADMAP promete evitar em geral; (2) CR-02 — a rota `POST /operacoes/:nome` não valida a forma dos argumentos por operação, permitindo que um Membro autenticado derrube o processo em 500 ou persista `jsonb` malformado que todo o Espaço hidrata depois.

Nenhum dos dois gaps está coberto por um `must_haves.truths` explícito em nenhum dos 9 PLAN.md — por isso os planos, individualmente, cumprem o que prometeram. Mas o próprio 01-REVIEW.md recomenda corrigir os dois "antes de considerar a fase fechada", e a leitura de código confirma que continuam abertos. Como verificador, escalo os dois para decisão humana: ou entram como plano de fechamento de lacuna (`/gsd-plan-phase --gaps`), ou o dono do produto registra um `override` explícito em `overrides:` no frontmatter deste arquivo, aceitando o risco (por exemplo, se a Phase 2 já planeja endurecer a validação de entrada antes de expor a rota a mais Membros que só a Maryane).

---

_Verificado em: 2026-09-16T18:38:28Z_
_Verificador: Claude (gsd-verifier)_
