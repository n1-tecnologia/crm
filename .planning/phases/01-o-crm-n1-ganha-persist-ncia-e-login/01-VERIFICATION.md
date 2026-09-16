---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
verified: 2026-09-16T20:16:06Z
status: gaps_found
score: 4/5 critérios de sucesso do ROADMAP verificados sem ressalva (1 parcial); gap 1 (CR-01) fechado e confirmado por teste; gap 2 (CR-02) permanece parcialmente aberto
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "4/5 critérios (1 parcial); 2 achados críticos confirmados"
  gaps_closed:
    - "Reconvidar um Usuário removido reativa o mesmo Membro (RN-ET-11), sem criar um segundo — caminho irmão do `pendente` por `invitedIdentity` (CR-01)"
  gaps_remaining:
    - "POST /operacoes/:nome roda cada operação dentro da Unidade de Trabalho com segurança suficiente para não persistir dado corrompido nem cair em 500 por entrada hostil de um Membro autenticado (CR-02) — parcialmente fechado"
  regressions: []
gaps:
  - truth: "POST /operacoes/:nome roda cada operação dentro da Unidade de Trabalho com segurança suficiente para não persistir dado corrompido nem cair em 500 por entrada hostil de um Membro autenticado (decorre do Critério 2 do ROADMAP; PERS-04)"
    status: partial
    reason: >
      O Plan 01-11 fechou por inteiro o efeito 1 do gap original (500 por
      `TypeError`): schema por operação (`ESQUEMAS`, 23 entradas cobrindo
      tasks/financeiro/automations — os módulos que o Espaço "Gestão" usa na
      Fase 1) mais fallback estrutural para as demais; `TypeError` dentro de
      qualquer operação vira 400 com rollback garantido por `executar()`
      (`unidade-de-trabalho.ts:73-76`, que faz `rollback` e relança antes de
      qualquer `commit`). Confirmado por mim: `npm run check` verde (379
      testes: dominio 253, api 73, web 53), os 8 casos novos (k)-(r) de
      `operacoes.test.ts` rodados isoladamente e verdes, incluindo (q)
      (`createChatFolder` com `name:123` → 400 via `TypeError`, nada
      persistido) e (p) (`updateTask` com `title:123`/`description:{}` → 400,
      nunca persistido).

      O efeito 2 (persistir `jsonb` malformado que todo o Espaço hidrata)
      continua aberto para as ~109 operações fora de `ESQUEMAS` — reproduzido
      de forma independente por mim, sem depender do relato do
      `01-REVIEW.md`: `ARGUMENTOS_GENERICOS.safeParse([{ name: "Meta", anchor:
      { type: "list", id: "lst_ativacao", lixo: { a: [1,2] } }, kind: 42,
      target: 10 }])` devolve `success: true` (script rodado com `vite-node`
      contra o código real de `esquemas-de-argumentos.ts`); a leitura de
      `packages/dominio/src/operations/scale.ts` (`createGoal` linhas
      208-236, `validateGoal` linhas 198-206) confirma que `input.kind` e
      `input.anchor` são copiados para o registro sem checagem de tipo/enum
      — `kind: 42` (não `"metrica"`/outro literal esperado) e
      `anchor.lixo` (chave desconhecida em objeto aninhado) seriam gravados
      no `jsonb` compartilhado. `saveView` (mesmo arquivo, linhas 74-101)
      copia `input.kind`/`input.filters` do mesmo jeito. O comentário do
      próprio `esquemas-de-argumentos.ts:20-25` ("conservador o bastante
      para barrar objeto onde o domínio espera escalar") não é verdade para
      o caso oposto (escalar/enum errado onde o domínio espera outro, ou
      objeto com chave a mais dentro de um contêiner aninhado) — o
      `01-REVIEW.md` (CR-02, PARCIALMENTE RESOLVIDO) chega à mesma conclusão
      e eu a confirmo por reprodução própria, não por aceitação do relato.

      Além disso, encontrei e confirmei por reprodução independente um
      segundo caminho para o MESMO efeito 1 que o plano visava fechar
      (500 por entrada hostil), não coberto pela correção: `reviverArgumentos`
      (`packages/dominio/src/operations/registro.ts:456-468`) roda ANTES de
      `esquemaDeArgumentos(...).safeParse(...)` em `operacoes.ts:125-126`, é
      recursivo sem limite de profundidade, e um corpo de ~400 KB com arrays
      aninhados (abaixo do `bodyLimit` padrão do Fastify de 1 MiB) estoura a
      pilha (`RangeError: Maximum call stack size exceeded`) fora de
      qualquer `try/catch` da rota — sobe ao `setErrorHandler` genérico como
      500. Reproduzido por mim chamando `reviverArgumentos(JSON.parse(...))`
      diretamente com `n=200000` níveis de aninhamento: `RangeError` lançado,
      confirmando o achado WR-10 do `01-REVIEW.md` (novo, não fazia parte do
      gap original, mas ataca exatamente a mesma garantia — "não cair em 500
      por entrada hostil de um Membro autenticado" — pela mesma rota).
    artifacts:
      - path: "apps/api/src/rotas/esquemas-de-argumentos.ts"
        issue: "ARGUMENTOS_GENERICOS (linhas ~163-173) só garante profundidade ≤ 6 e folhas JSON-primitivas; não garante tipo/enum por campo nem chaves conhecidas em objetos aninhados — confirmado por reprodução própria com createGoal/saveView"
      - path: "apps/api/src/rotas/operacoes.ts"
        issue: "reviverArgumentos(request.body.args) (linha ~125) roda fora de qualquer try/catch, antes da validação por schema — um RangeError de recursão profunda sobe ao setErrorHandler como 500, não como 400"
    missing:
      - "Fechar o efeito 2 para as operações fora de ESQUEMAS: ou (a) 404 para toda operação sem schema próprio (a opção que o próprio 01-REVIEW.md recomenda por custar zero funcionalidade na Fase 1, já que o Espaço 'Gestão' só usa as 23 cobertas), ou (b) schema próprio para as ~109 restantes, com o teste (j) de esquemas-de-argumentos.test.ts passando a exigir Object.keys(ESQUEMAS).length === Object.keys(OPERACOES).length"
      - "Um teste em operacoes.test.ts provando que uma operação fora de ESQUEMAS (ex.: createGoal com kind:42) responde 400, não 200 com dado corrompido gravado"
      - "Envolver reviverArgumentos(...) em try/catch (ou limitar a profundidade dentro do próprio reviver) para que um RangeError de recursão vire 400, não 500 — a correção mínima já desenhada em WR-10 do 01-REVIEW.md"
      - "Um teste em operacoes.test.ts com um corpo profundamente aninhado (ex.: n=10000) → 400, não 500"
deferred: []
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

# Fase 1: O CRM N1 ganha persistência e login — Relatório de Verificação (re-verificação após fechamento de lacunas)

**Meta da fase:** O CRM N1 deixa de ser protótipo — um Membro real entra com e-mail e senha, cria uma Conta pela tela e ela está no Postgres da plataforma; toda operação do domínio chega ao backend por HTTP e roda na Unidade de Trabalho, sem que o domínio ou os 214 testes mudem.
**Verificado em:** 2026-09-16T20:16:06Z
**Status:** gaps_found
**Re-verificação:** Sim — depois dos Plans 01-10 (CR-01) e 01-11 (CR-02); linha de base em `git show 3ba8b86:.planning/phases/01-o-crm-n1-ganha-persist-ncia-e-login/01-VERIFICATION.md`

## Metodologia

Re-verificação goal-backward, focada nos dois gaps da rodada anterior. Nenhuma alegação de SUMMARY.md ou de `01-REVIEW.md` foi aceita sem evidência própria. Evidências coletadas por: leitura de `01-10-PLAN.md`/`01-10-SUMMARY.md`, `01-11-PLAN.md`/`01-11-SUMMARY.md` e do `01-REVIEW.md` (re-revisão pós-fechamento, `ecdbea2`); leitura linha a linha de `packages/dominio/src/operations/members.ts` (a busca `porUserId ?? porEmail`), `apps/api/src/rotas/esquemas-de-argumentos.ts` e `apps/api/src/rotas/operacoes.ts`; execução de `npm run check` na raiz (379 testes: dominio 253, api 73, web 53); execução isolada de `vitest run --reporter=verbose` em `packages/dominio` e `apps/api`, listando nominalmente os casos novos (g)/(h)/(i) de `members-reconvite.test.ts`, (e) de `convidar-membro.test.ts` e (k)-(r) de `operacoes.test.ts`; `git diff d713253 -- operations.test.ts seed-produto.test.ts contas-a-receber.test.ts` (vazio); e **três reproduções próprias, independentes do relato do `01-REVIEW.md`**, rodadas com `vite-node` contra o código real do repositório (não hipotéticas): (1) o cenário WR-09 (`inviteMember` chamado duas vezes contra `buildSeed()`, confirmando 12 Membros vivos e um e-mail com dois registros `pendente`); (2) `ARGUMENTOS_GENERICOS.safeParse(...)` com a forma hostil de `createGoal`/`saveView` do CR-02 residual (confirmando `success: true`); (3) `reviverArgumentos(JSON.parse(...))` com 200.000 níveis de aninhamento (confirmando `RangeError`, WR-10). Nenhum servidor (`npm run dev`, `apps/api`) foi subido por mim nesta rodada — as reproduções rodaram como scripts diretos contra os módulos TypeScript, sem HTTP. Um processo de `vitest --watch`-like ficou pendurado por um erro meu de sintaxe de comando (uso de `-w` fora de um workspace) e foi encerrado por mim (`kill -9`) antes de finalizar esta verificação; não era um servidor da aplicação e não gravou nada. Porta 3001 (`apps/web`, processo pré-existente do ambiente, não iniciado por mim) e porta 3002 (`apps/api`, livre) confirmadas ao final.

## Goal Achievement

### Critérios de Sucesso do ROADMAP

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | Membro real entra em `/entrar`, é resolvido pelo Usuário, cria uma Conta pela tela, e ela persiste no Postgres após recarregar | ⚠️ VERIFICADO PARCIALMENTE (metade automatizada, metade precisa de navegador) — inalterado desde a rodada anterior | Nenhum arquivo desta parte mudou nos Plans 01-10/01-11 (`git diff --stat 3ba8b86..HEAD` confirma só 8 arquivos alterados, nenhum em `apps/web` ou nos e2e). O e2e `criar-conta.test.ts` continua verde; a parte "pela tela, no navegador" continua em Human Verification. |
| 2 | Toda operação dos 16 módulos chega por `POST /operacoes/:nome` e roda na UoW com o Membro da sessão; API pública do store não muda | ⚠️ VERIFICADO, COM RESSALVA DE ROBUSTEZ (gap CR-02 parcialmente fechado) | `apps/api/src/rotas/operacoes.ts` despacha por `OPERACOES[nome]` dentro de `executar()`, com `request.membro.id` sempre da sessão. O efeito 1 do gap anterior (500 por `TypeError`) está fechado: 23 schemas por operação (`esquemas-de-argumentos.ts`) + fallback estrutural, `TypeError` dentro de `operacao(...)` mapeado para 400 com rollback (confirmado lendo `unidade-de-trabalho.ts:73-76` e `operacoes.ts:143-161`; casos (k)-(r) de `operacoes.test.ts` rodados por mim, todos verdes). **Ressalva que permanece:** (a) o efeito 2 (persistir `jsonb` malformado) segue aberto para as ~109 operações fora de `ESQUEMAS` — confirmei por reprodução própria com `createGoal`/`saveView`; (b) um caminho NOVO para 500 por entrada hostil existe em `reviverArgumentos`, que roda antes da validação e não tem limite de profundidade — confirmei por reprodução própria (`RangeError` com um corpo de 400 KB). Ver Gaps. |
| 3 | Espaço "Gestão" › Financeiro › Listas "Contas a pagar"/"Contas a receber" no banco, com Status/Campos/Tags/Papéis dos SPECs, sem Tarefas fictícias; Lista de Contas a pagar filtra por status, vencimento, Tag `conta *`, Responsável e Pessoa com coluna gerada e índice | ✓ VERIFICADO (inalterado) | Nenhum arquivo desta parte mudou nos Plans 01-10/01-11. `npm run check` desta rodada confirma `bootstrap-gestao.test.ts` e `colunas-geradas.test.ts` continuam verdes, sem regressão. |
| 4 | `npm run check` verde nos 3 workspaces; 214 testes do domínio inalterados; hidratado ≡ seed vale contra o Supabase; ClickUp e `automation/` intocados | ✓ VERIFICADO | `npm run check` rodado por mim nesta rodada: **379 testes verdes** (253 domínio + 73 api + 53 web) — os números batem exatamente com o que 01-10-SUMMARY.md e 01-11-SUMMARY.md alegam (250+3 domínio; 54+10+8+1 api). `git diff d713253 -- packages/dominio/src/operations/operations.test.ts packages/dominio/src/seed-produto.test.ts packages/dominio/src/contas-a-receber.test.ts` devolveu vazio, confirmado por mim. `ClickUp`/`automation/` continuam fora deste repositório. |
| 5 | Reconvidar um Usuário removido reativa o mesmo Membro (RN-ET-11), sem criar um segundo | ✓ VERIFICADO — gap CR-01 fechado no cenário reportado; residual WR-09 tratado como achado fora do critério (ver "Julgamento sobre WR-09" abaixo) | `members.ts:346-349`: `existing = porUserId ?? porEmail`, com `porEmail` calculado incondicionalmente (era a lacuna: antes só rodava quando `userId` estava ausente). Os três casos novos (g)/(h)/(i) de `members-reconvite.test.ts` e o caso (e) de `convidar-membro.test.ts` (contra o Postgres real) rodados por mim isoladamente, todos verdes — reproduzem literalmente o cenário do `missing` da rodada anterior (pendente por `invitedIdentity` + `userId` resolvido depois → recusa, não cria segundo Membro). |

**Placar:** 3/5 critérios totalmente verificados sem ressalva (3, 4, 5); 2/5 com ressalva (1 precisa de navegador — verificação pendente, não gap de código; 2 tem um gap de código real e reproduzido por mim, parcialmente fechado por esta rodada de planos).

### Julgamento sobre WR-09 (residual da correção de CR-01)

O `01-REVIEW.md` (re-revisão) registra que a correção `existing = porUserId ?? porEmail` deixa um caso descoberto: se `porUserId` encontra um Membro `removido` E `porEmail` encontra, em paralelo, um Membro `pendente` VIVO (para o mesmo e-mail), o `??` escolhe o `removido` (porque é avaliado primeiro e é truthy), reativa-o, e o `pendente` vivo nunca é conferido — resultado: dois Membros vivos para o mesmo e-mail. Reproduzi isso de forma independente (script `vite-node` contra `buildSeed()` real, não contra um mock): convidar `x@empresa.com.br` sem `userId` cria `mem_0000ae` (`pendente`); convidar de novo com um `userId` que resolve para `mem_tiago` (`removido` no seed) reativa `mem_tiago` como `pendente` SEM tocar `mem_0000ae` — total de Membros vivos sobe de 11 para 12, e os dois registros (`mem_tiago` e `mem_0000ae`) ficam `pendente` "para o mesmo e-mail" em sentido lato (o e-mail do convite é o mesmo nos dois casos, ainda que só `mem_0000ae.invitedIdentity.value` o guarde literalmente).

**Meu julgamento:** este é um achado real e devidamente reproduzido, mas ele cai FORA do texto literal do Critério 5 do ROADMAP e do gap 1 que esta rodada foi encarregada de fechar, por três razões: (1) o gatilho não é "reconvidar um Usuário removido" — é a COMBINAÇÃO de duas ações de convite independentes ao longo do tempo (uma sem `userId`, criando um `pendente` por e-mail; outra com um `userId` que por coincidência de e-mail no Supabase Auth aponta para um Membro `removido` diferente) mais uma reatribuição de e-mail no lado do Auth que este domínio não controla; (2) a ação de reconvite em si, isoladamente, FAZ exatamente o que o critério promete — reativa o Usuário removido como o MESMO Membro, sem criar um Membro novo NESSA chamada; o segundo Membro "vivo" já existia de uma chamada anterior e não nasceu desta operação; (3) nenhum plano da Fase 1 (`01-08`, `01-10`) listou esse cenário composto em `must_haves`, e a tela de convite do `apps/web` hoje só expõe um fluxo de convite por vez, sem o cenário de reatribuição de e-mail no Auth que o dispara. Por isso trato WR-09 como um achado de robustez válido para acompanhamento (ver Anti-Patterns, abaixo), não como reabertura do gap 1 — mas registro que ele documenta uma violação real da invariante mais ampla que RN-ET-11/INV-ET-04 protege (nunca dois Membros vivos para o mesmo e-mail), e recomendo que a correção já desenhada no próprio `01-REVIEW.md` (conferir os dois achados e recusar quando divergem) entre num plano de robustez antes de a Fase 2 abrir convites a mais de um Administrador simultâneo.

### Artefatos Obrigatórios (regressão + novos desta rodada)

| Artefato | Plano | Status | Linhas |
|---|---|---|---|
| `packages/dominio/src/operations/members.ts` | 08, 10 | ✓ VERIFICADO — `porUserId ?? porEmail` na linha 349, comentário cita CR-01 | 684 |
| `packages/dominio/src/operations/members-reconvite.test.ts` | 08, 10 | ✓ VERIFICADO — 9 casos (a)-(i), os três novos ((g)/(h)/(i)) listados nominalmente por mim, verdes | 226 |
| `apps/api/src/servicos/convidar-membro.test.ts` | 08, 10 | ✓ VERIFICADO — caso (e) listado nominalmente por mim, verde contra o Postgres real | 225 |
| `apps/api/src/rotas/esquemas-de-argumentos.ts` | 11 | ✓ VERIFICADO (min 120) — mas ver ressalva no gap (ARGUMENTOS_GENERICOS não barra tipo/enum errado) | 182 |
| `apps/api/src/rotas/esquemas-de-argumentos.test.ts` | 11 | ✓ VERIFICADO (min 60) — 10 casos puros, listados nominalmente por mim, verdes | 117 |
| `apps/api/src/rotas/operacoes.ts` | 04, 11 | ✓ VERIFICADO — mas ver ressalva no gap (`reviverArgumentos` fora do try/catch) | 180 |
| `apps/api/src/rotas/operacoes.test.ts` | 04, 11 | ✓ VERIFICADO — casos (k)-(r) listados nominalmente por mim, verdes (18 casos totais com banco) | 343 |
| Os demais 22 artefatos de `must_haves.artifacts` dos 9 planos originais | 01-09 | ✓ VERIFICADO (regressão) — nenhum arquivo tocado pelos Plans 01-10/01-11 fora dos 8 listados acima (confirmado por `git diff --stat 3ba8b86..HEAD`); `npm run check` verde confirma ausência de regressão funcional | — |

### Verificação de Key Links (Wiring) — foco na rodada

| De | Para | Via | Status |
|---|---|---|---|
| `packages/dominio/src/operations/members.ts` | `state.members` | `porUserId` (condicional a `input.userId`) e `porEmail` (sempre, por `invitedIdentity.value` normalizado), combinados por `??` | ✓ WIRED — confirmado lendo o código; `porEmail` roda incondicionalmente, fechando a lacuna relatada |
| `apps/api/src/rotas/operacoes.ts` | `apps/api/src/rotas/esquemas-de-argumentos.ts` | `esquemaDeArgumentos(nome).safeParse(reviverArgumentos(request.body.args))` antes do despacho | ✓ WIRED, mas a ordem (`reviverArgumentos` antes do `safeParse`, sem try/catch em volta do revive) é o que abre WR-10 |
| `apps/api/src/rotas/operacoes.ts` | `apps/api/src/persistencia/unidade-de-trabalho.ts` | `try { operacao(...) } catch (TypeError) → throw ErroDeEntrada` dentro do callback de `executar()`; `executar()` faz `rollback` e relança | ✓ WIRED — confirmado lendo `unidade-de-trabalho.ts:73-76`: o `catch` externo sempre faz `rollback` antes de relançar, então o `ErroDeEntrada` chega à rota sem nada commitado |

### Reprodução Independente (não aceita por relato)

| Achado | Comando/Script | Resultado | Confirma |
|---|---|---|---|
| CR-01 fechado no cenário reportado | `vitest run --reporter=verbose` em `packages/dominio`, casos (g)/(h)/(i) | 3/3 verdes, nominalmente listados | Gap 1 fechado |
| CR-02 efeito 1 (500 por `TypeError`) fechado | `vitest run --reporter=verbose` em `apps/api`, casos (k)-(r) | 8/8 verdes, nominalmente listados | Efeito 1 fechado |
| WR-09 (dois Membros vivos para o mesmo e-mail) | script `vite-node` chamando `inviteMember` duas vezes contra `buildSeed()` real | `mem_tiago` reativado (pendente) + `mem_0000ae` continua pendente; 11→12 vivos | Achado real, fora do escopo do gap 1 (ver julgamento acima) |
| CR-02 efeito 2 residual (`createGoal`/`saveView`) | script `vite-node` chamando `ARGUMENTOS_GENERICOS.safeParse(...)` com a forma hostil do `01-REVIEW.md` | `success: true` — `esquemaDeArgumentos("createGoal") === ARGUMENTOS_GENERICOS` também confirmado `true` | Gap 2 permanece parcialmente aberto |
| WR-10 (500 por recursão sem limite) | script `vite-node` chamando `reviverArgumentos(JSON.parse(...))` com 200.000 níveis (400.002 bytes) | `RangeError: Maximum call stack size exceeded` | Gap 2 permanece parcialmente aberto (novo caminho para o mesmo efeito 1) |

### Behavioral Spot-Checks

| Comportamento | Comando | Resultado | Status |
|---|---|---|---|
| `npm run check` completo (typecheck+lint+tokens+test, 3 workspaces) | `npm run check` | 379/379 testes verdes (253+73+53) | ✓ PASS |
| Suíte `apps/api` isolada, casos novos por nome | `npx vitest run --reporter=verbose` em `apps/api`, grep por `(k)`-`(r)`, `(e)` | 17 casos novos listados, todos ✓ | ✓ PASS |
| Suíte `packages/dominio` isolada, casos novos por nome | `npx vitest run --reporter=verbose` em `packages/dominio`, grep por reconvite | 9 casos de `members-reconvite.test.ts` listados, todos ✓ (incluindo (g)/(h)/(i)) | ✓ PASS |
| Os 3 arquivos de teste originais do domínio sem diff desde `d713253` | `git diff d713253 -- operations.test.ts seed-produto.test.ts contas-a-receber.test.ts` | saída vazia | ✓ PASS |
| `ARGUMENTOS_GENERICOS` barra `kind`/`anchor` malformados de `createGoal` | script `vite-node` próprio | `safeParse(...).success === true` (deveria ser `false`) | ✗ FAIL (gap, ver acima) |
| `reviverArgumentos` não estoura a pilha com entrada profunda | script `vite-node` próprio, `n=200000` | `RangeError` lançado | ✗ FAIL (gap, ver acima) |

Nenhum servidor HTTP (`npm run dev`, `apps/api`/`apps/web`) foi iniciado por mim nesta verificação; as reproduções chamaram os módulos TypeScript diretamente via `vite-node`. Um comando de teste em background ficou pendurado por erro de sintaxe meu (`vitest run -w @n1/api` interpretado fora de um workspace) e foi encerrado (`kill -9`) sem produzir efeito colateral. Porta 3001 (`apps/web`, pré-existente, não iniciado por mim) e porta 3002 (`apps/api`, livre) confirmadas ao final.

### Requirements Coverage

| Requisito | Plano(s) | Descrição (REQUIREMENTS.md) | Status | Evidência |
|---|---|---|---|---|
| PERS-01 | 09 (regressão) | Repositórios + Unidade de Trabalho | ✓ SATISFIED | Inalterado nesta rodada; `npm run check` confirma sem regressão |
| PERS-02 | 09 (regressão) | `/entrar` autentica por Supabase Auth, Membro resolvido pelo Usuário | ✓ SATISFIED | Inalterado nesta rodada |
| PERS-04 | 01, 02, 03, 04, 09, 11 | Rotas HTTP por operação, UoW, Membro da sessão | ⚠️ SATISFIED COM RESSALVA | Efeito 1 de CR-02 (500 por `TypeError`) fechado pelo Plan 01-11; efeito 2 (jsonb malformado, ~109 operações) e WR-10 (500 por recursão) permanecem abertos — ver Gaps |
| PERS-05 | 03, 07 | `store.ts` troca `run()` local por `POST` | ✓ SATISFIED | Inalterado nesta rodada |
| PERS-06 | 05 | Bootstrap do Espaço "Gestão" sem fixtures | ✓ SATISFIED | Inalterado nesta rodada |
| PERS-07 | 06 | Colunas geradas e índices | ✓ SATISFIED | Inalterado nesta rodada |
| PERS-08 | 09 (documental) | Onde `apps/api` roda | Bloqueado por decisão D11 — inalterado, não é código desta fase | `apps/api/README.md` §5 |
| PERS-09 | 08, 10 | RN-ET-11 — reconvite reativa o mesmo Membro | ✓ SATISFIED | Gap CR-01 fechado pelo Plan 01-10, provado por (g)/(h)/(i)/(e); resíduo WR-09 tratado como achado de robustez fora do critério literal (ver julgamento acima) |

**Nenhum requisito órfão:** todos os 8 IDs de `ROADMAP.md` linha 47 aparecem em pelo menos um `requirements:` de PLAN.md (incluindo `01-10-PLAN.md` → PERS-09 e `01-11-PLAN.md` → PERS-04); nenhum ID adicional em `REQUIREMENTS.md` mapeado para a Fase 1 ficou de fora dos planos.

### Anti-Patterns Found

Origem: `01-REVIEW.md` (re-revisão pós-fechamento, `ecdbea2`, 64 arquivos), com confirmação direta por mim nos achados relevantes a esta rodada.

| Arquivo | Achado | Severidade | Impacto no critério/must-have | Confirmado por mim? |
|---|---|---|---|---|
| `apps/api/src/rotas/esquemas-de-argumentos.ts:163-173` | CR-02 (residual) — `ARGUMENTOS_GENERICOS` não barra tipo/enum errado nem chave a mais em objeto aninhado, para ~109 operações | 🛑 Gap estruturado acima | Ameaça a integridade do `jsonb` compartilhado para operações fora de `tasks`/`financeiro`/`automations` | Sim — reprodução própria com `createGoal`/`saveView` |
| `apps/api/src/rotas/operacoes.ts:125-126` | WR-10 — `reviverArgumentos` roda antes da validação, recursivo sem limite, `RangeError` de um corpo de 400 KB sobe como 500 | 🛑 Gap estruturado acima (novo caminho para o mesmo efeito que CR-02 visava fechar) | Ameaça "não cair em 500 por entrada hostil" do Critério 2 | Sim — reprodução própria (`RangeError` confirmado) |
| `packages/dominio/src/operations/members.ts:346-349` | WR-09 — `porUserId ?? porEmail` escolhe um `removido` sobre um `pendente` vivo quando os dois existem para o mesmo e-mail; reativação por e-mail pode sobrescrever um `userId` já gravado | ⚠️ Warning — achado de robustez, fora do texto literal do Critério 5 (ver julgamento acima) | Não bloqueia esta fase; recomendado para plano de robustez antes da Fase 2 | Sim — reprodução própria (`buildSeed()`, 11→12 Membros vivos) |
| `apps/api/src/rotas/operacoes.ts:143-161` | WR-11 — `TypeError → 400` também se aplica às 23 operações COM schema, onde um `TypeError` pós-validação só pode ser bug (fica marcado como `warn` de entrada inválida, não `error`) | ⚠️ Warning | Não corrompe dado nem gera 500; é um problema de observabilidade (bug escondido atrás de 400 ao cliente), não de segurança/integridade — fora do texto do Critério 2 | Não confirmado por mim linha a linha nesta rodada — aceito o achado do REVIEW, coerente com a leitura que fiz do `catch` único em `operacoes.ts` |
| `packages/dominio/src/operations/registro.ts:457-466` | IN-02 — PARCIALMENTE mitigado: o `reviver` ainda copia `__proto__` por atribuição, mas o zod recria o objeto (`Reflect.ownKeys`) para as operações com schema | ℹ️ Info | Sem impacto demonstrado (o valor passa pelo mesmo `z.string()` que passaria direto) | Não relido linha a linha por mim nesta rodada — aceito o achado do REVIEW |
| WR-01 a WR-08 (exceto WR-06/WR-08 já classificados na rodada anterior), IN-01, IN-03, IN-04 (parcial), IN-05 a IN-11 | Demais achados de `01-REVIEW.md` | ⚠️/ℹ️ Warning/Info | Nenhum corresponde a um `must_haves` de nenhum dos 11 planos nem a um Critério de Sucesso do ROADMAP; classificação "fora de escopo" da rodada anterior mantida — nenhum código novo desta rodada os afeta | Não relidos individualmente por mim — ver `01-REVIEW.md` para o texto completo |

Nenhum marcador de débito (`TBD`/`FIXME`/`XXX`) sem referência de issue encontrado nos 8 arquivos alterados por esta rodada.

### Human Verification Required

Ver frontmatter `human_verification` — os três itens são EXATAMENTE os da rodada anterior, carregados sem alteração: nenhum plano desta rodada (01-10, 01-11) tocou `apps/web` ou o fluxo de navegador. Continuam pendentes de um navegador real: (1) login → criar Conta a pagar pela tela → F5 → persistência; (2) recusa de `changeTaskStatus` sem spinner/sem requisição de rede; (3) `tiago@n1.teste` (removido) vendo "Sem acesso".

## Gaps Summary

Esta rodada fechou por completo o gap 1 (CR-01, Critério 5, PERS-09): a busca de `existing` em `inviteMember` agora casa por `userId` E por `invitedIdentity` em paralelo (`porUserId ?? porEmail`), com três testes novos no domínio e um no serviço (contra o Postgres real) provando literalmente o cenário que a rodada anterior relatou como faltante. Um achado de robustez residual (WR-09) surgiu da própria correção — reproduzido por mim de forma independente — mas julgo que ele cai fora do texto literal do Critério 5 e do escopo do gap 1 (ver "Julgamento sobre WR-09" acima); recomendo tratá-lo como item de robustez para um plano futuro, não como bloqueio desta fase.

O gap 2 (CR-02, Critério 2, PERS-04) fechou parcialmente. O efeito mais grave do relato original — qualquer Membro autenticado derrubando o processo em 500 com uma entrada trivial em qualquer uma das ~130 operações — está fechado para o caminho testado (schema por operação + `TypeError` mapeado para 400 com rollback). Mas dois problemas do mesmo texto de truth continuam abertos, ambos confirmados por reprodução própria (não por aceitação do relato do `01-REVIEW.md`): (a) para as ~109 operações fora das 23 cobertas por `ESQUEMAS`, um Membro autenticado ainda consegue persistir `jsonb` com tipo/enum errado ou chave a mais em campo aninhado — todo o Espaço hidrata esse registro malformado; (b) um corpo HTTP de ~400 KB com arrays profundamente aninhados ainda derruba a requisição em 500 (`RangeError` em `reviverArgumentos`, que roda antes de qualquer validação). Nenhum dos dois é coberto por um `must_haves.truths` de nenhum dos 11 planos como "resolvido por completo" — o próprio `01-11-PLAN.md` já escopava a cobertura para "os módulos que o Espaço 'Gestão' usa" mais um fallback "conservador", e o fallback entregue é mais fraco do que o comentário do próprio arquivo alega.

Como verificador, escalo o gap 2 residual para decisão humana: ou entra como um novo plano de fechamento de lacuna (`/gsd-plan-phase 1 --gaps`, com a correção de baixo custo já desenhada no `01-REVIEW.md` — 404 para operações sem schema próprio, e um `try/catch`/limite de profundidade em `reviverArgumentos`), ou o dono do produto registra um `override` explícito no frontmatter deste arquivo aceitando o risco residual (por exemplo, se a Fase 2 só abre a rota a Membros de confiança e a superfície de ~109 operações "silenciosas" não é exercitada por nenhuma tela até lá).

---

_Verificado em: 2026-09-16T20:16:06Z_
_Verificador: Claude (gsd-verifier)_
