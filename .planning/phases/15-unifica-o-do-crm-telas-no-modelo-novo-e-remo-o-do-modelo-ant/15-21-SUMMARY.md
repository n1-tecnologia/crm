---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 21
subsystem: web
tags: [ia, chat, ancora, agentes, automacoes, funil, canal, nomes, tdd, ucr-08]

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-08: createChatSession, configureChatSession e ensaiarAgente leem o nome da Âncora de `nomes` (último argumento); 15-10: POST /crm/nomes e useNomesDoCrm/nomeDe; 15-39: criarAutomacao, escopoExiste e inoperante recebem `funis` por argumento"
provides:
  - "ancora-do-chat.tsx: diálogo da Âncora que lista Negócio, Contato e Conversa pelas rotas de lista (busca como q), useNomeDaEscolha (nome por POST /crm/nomes, null = \"Registro indisponível\"), ancoraDaEscolha e nomesDaEscolha"
  - "Home do Chat e Sessão de Chat mandam `nomes` em createChatSession e configureChatSession"
  - "ensaiar-dialog.tsx: Âncora de Negócio e Contato pela api, nome por POST /crm/nomes, ensaiarAgente com `nomes`"
  - "automacoes/funis-do-escopo.ts: useFunisDoEscopo (GET /funis, ativos e arquivados) e inoperanteComFunis; editor, catálogo e Nova Automação passam os Funis"
  - "Canal da Ação de mensagem por useCanais (CampoSpec.usaCanais); agentes/conversas-do-agente.ts: total de Conversas atribuídas por GET /conversas?atribuidoId="
affects: [15-33, 15-22]

plan_head_before: f103c81dfea1ff17f2d67f270d138a281133c3c2
plan_head_after: c716bb885e2cb9f93579147415dbc2393a88eba4
commits: 4

actuals:
  tokens: 17200
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Escolha com nome levado junto (EscolhaDeAncora.nome): o nome que a tela tem vai em `nomes` na operação e fica fora do pedido da Âncora"
    - "Registro escolhido continua na lista quando a busca o tira da página: o nome vem de POST /crm/nomes (useNomeDaEscolha)"
    - "Hook de lista com `pausado` por família: só a família escolhida, com o diálogo aberto, vai à rede"
    - "inoperanteComFunis: o escopo Funil não é dado como eliminado enquanto a lista de Funis não chegou"

key-files:
  created:
    - apps/web/src/features/ia/ia-no-crm-novo.test.tsx
    - apps/web/src/features/ia/automacoes/funis-do-escopo.ts
    - apps/web/src/features/ia/agentes/conversas-do-agente.ts
  modified:
    - apps/web/src/features/ia/ancora-do-chat.tsx
    - apps/web/src/features/ia/agentes/ensaiar-dialog.tsx
    - apps/web/src/features/ia/agentes/agente-completo.tsx
    - apps/web/src/features/ia/automacoes/automacao-spec.ts
    - apps/web/src/features/ia/automacoes/bloco-form.tsx
    - apps/web/src/features/ia/automacoes/editor-de-automacao.tsx
    - apps/web/src/features/ia/automacoes/nova-automacao-dialog.tsx
    - apps/web/src/features/ia/personalizar/secoes-catalogo.tsx
    - apps/web/src/app/(shell)/ia/chat/page.tsx
    - apps/web/src/app/(shell)/ia/chat/[sessao]/page.tsx
    - apps/web/CONTEXT.md

key-decisions:
  - "O diálogo da Âncora ganhou um campo \"Buscar registro\" (e o do ensaio também): o Select não tem busca no servidor, então o texto digitado vai à api como `q` e a lista traz até 30 registros; o Select de CRM deixa de ser `searchable` (a busca é a do campo), o de Tarefa e Documento continua"
  - "EscolhaDeAncora ganhou `nome?`: o nome do registro do CRM vai em `nomes` (nomesDaEscolha) e a Âncora do pedido leva só tipo e id (ancoraDaEscolha); Tarefa e Documento não levam nomes"
  - "useFunisDoEscopo lê duas listas (ativos e arquivados, até 200 cada): Funil na lixeira conta como eliminado, como o domínio já decide em escopoExiste; Nova Automação só busca quando o escopo é Funil (pausado) e só manda `funis` nesse escopo"
  - "inoperanteComFunis não acusa \"escopo eliminado\" para escopo Funil enquanto as listas não chegaram ou se a api as recusou: a lista vazia de quem não carregou não prova que o Funil sumiu"
  - "A contagem de Conversas atribuídas ao Agente (RN-AGE-20) vem de GET /conversas?atribuidoId= com limite 1 e lê só o total; sem resposta o texto diz \"as Conversa(s)\", sem número inventado"
  - "O campo Canal da Ação de mensagem usa o Canal ativo de GET /canais (id novo, nome, conexão); o aviso de Canal do modelo antigo some junto com o store"

requirements-completed: [UCR-08]

coverage:
  - id: D1
    description: "A Âncora do Chat num Negócio novo mostra o título que POST /crm/nomes devolveu; sem nome da api mostra \"Registro indisponível\"; Tarefa continua do store"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/ia/ia-no-crm-novo.test.tsx#(a), (b), (c)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O diálogo da Âncora lista os Negócios da api (store vazio), a busca vai como q e a escolha entrega o nome; createChatSession e configureChatSession saem com `nomes` e a Âncora sem o nome"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/ia/ia-no-crm-novo.test.tsx#(d), (e), (f), (g)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O ensaio de Agente lista Contatos da api, mantém o nome do escolhido por POST /crm/nomes quando a busca o tira da página, mostra \"Registro indisponível\" sem nome e manda `nomes`"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/ia/ia-no-crm-novo.test.tsx#(h), (i)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O escopo Funil das Automações usa os Funis de GET /funis: ativo não é inoperante, ausente é eliminado, arquivado é arquivado, carregando não pisca aviso; Nova Automação lista os Funis e manda `funis`"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/ia/ia-no-crm-novo.test.tsx#(k), (l), (m), (n)"
        status: pass
    human_judgment: false
  - id: D5
    description: "O Canal da Ação de mensagem e o total de Conversas do Agente vêm da api, não do store"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/ia/ia-no-crm-novo.test.tsx#(j), (o)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Prohibition UCR-08 (privacidade): a tela da IA nunca mostra o nome de um registro que a api não devolveu"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/ia/ia-no-crm-novo.test.tsx#(b), (i)"
        status: pass
    human_judgment: true
    rationale: "A prohibition é verification: judgment no plano; os casos provam o texto \"Registro indisponível\" quando a api devolve null, mas a revisão de que nenhum outro caminho da tela da IA mostra nome de registro do CRM fica com o revisor"
  - id: D7
    description: "Aparência e uso reais do diálogo da Âncora, do ensaio e da Nova Automação no navegador (campo de busca, lista de 30, aviso de escopo)"
    verification: []
    human_judgment: true
    rationale: "Teste de componente com fetch falso; a conferência visual fica para a UAT de fim de fase (human_verify_mode = end-of-phase)"

duration: 14min
completed: 2026-11-06
status: complete
---

# Phase 15 Plan 21: A IA escolhe e mostra o CRM novo Summary

**A Âncora do Chat e do ensaio de Agente lista Negócios, Contatos e Conversas pela api e nomeia o escolhido por `POST /crm/nomes` ("Registro indisponível" quando a api não devolve nome), e o escopo Funil das Automações e o Canal da Ação passam a vir de `GET /funis` e `GET /canais`, com as operações mandando `nomes` e `funis` do navegador.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-06T13:42:00Z (aprox.)
- **Completed:** 2026-11-06T13:56:00Z
- **Tasks:** 2 (a 1 é traçador TDD)
- **Files modified:** 14 (3 criados, 11 alterados), mais WINDOWS.md

## Accomplishments

- **Âncora do Chat (traçador).** `ancora-do-chat.tsx` não lê mais `state.deals`, `state.contacts` nem `state.conversations`: o diálogo lista pelas rotas de lista com a busca indo como `q` (30 por busca, só a família escolhida com o diálogo aberto vai à rede), e `useNomeDaEscolha` dá o nome por `POST /crm/nomes`. Nome `null` da api vira `NOME_INDISPONIVEL` ("Registro indisponível"); enquanto a resposta não chega vale o nome da escolha. Tarefa e Documento de Conhecimento seguem do store.
- **`nomes` do navegador.** A home do Chat chama `createChatSession(…, { …, anchor }, nomes)` e a Sessão chama `configureChatSession(…, input, nomes)`; a Âncora do pedido leva só `type` e `id` (`ancoraDaEscolha`) e o nome vai em `nomes` (`nomesDaEscolha`, vazio para Tarefa e Documento). Isso encerra o comportamento provisório do 15-08 (WINDOWS #13).
- **Ensaio de Agente.** `ensaiar-dialog.tsx` lista Negócios e Contatos da api com campo "Buscar registro", mantém o registro escolhido na lista quando a busca o tira da página (nome por `useNomeDaEscolha`) e chama `ensaiarAgente(…, nomes)` só quando a Âncora é do CRM.
- **Escopo Funil das Automações.** `funis-do-escopo.ts` (`useFunisDoEscopo`, `inoperanteComFunis`) lê Funis ativos e arquivados de `GET /funis`; o editor, o catálogo de Automações e a Nova Automação passam os Funis ao domínio, e `criarAutomacao` sai com `funis` quando o escopo é Funil. Encerra o comportamento provisório do 15-39 (WINDOWS #16).
- **Canal e Conversas do Agente.** O campo Canal da Ação de mensagem usa `useCanais` (`CampoSpec.usaCanais`, `ContextoDaSpec.canais`); a ficha do Agente conta as Conversas atribuídas por `GET /conversas?atribuidoId=` (`conversas-do-agente.ts`).
- **Verificação do plano.** Zero leituras de `contacts|companies|deals|funnels|channels` em `features/ia` (a soma do `awk` do plano é 0, exit 0); `useFunis` aparece 2x em `editor-de-automacao.tsx` (via `useFunisDoEscopo`, ver desvio abaixo); suíte inteira da web 127 arquivos / 1221 testes; `tsc --noEmit`, `eslint` dos arquivos tocados (0 erros) e `verificar:tokens` limpos.

## TDD

- **RED 1** (`5536fc2`): 7 casos da Âncora; falharam por `ancoraDaEscolha`, `nomesDaEscolha`, `useNomeDaEscolha` e `NOME_INDISPONIVEL` ainda não existirem. É um RED de API ausente (TypeError), não de asserção; o diálogo, que existia, só ficou provado pela asserção depois. `workflow.tdd_mode` é `false`; o classificador `check tdd-red-evidence` não foi usado.
- **GREEN 1** (`1b05fbb`): 7/7, `tsc` limpo. Gate do traçador (modo `end-of-phase`, `<verify>` só automatizado): reexecutado ponta a ponta (vitest + `tsc`) e passou, expansão liberada.
- **RED 2** (`f53013c`): 8 casos novos com esqueletos que só compilam (`conversas-do-agente.ts` devolvia `undefined`, `funis-do-escopo.ts` devolvia lista vazia e `pronto: false`). Falharam pelas asserções planejadas: lista de Contatos do ensaio vazia (store vazio), `expected undefined to be 7`, `expected 'escopo eliminado (Funil)' to be 'sem motivo'`, Funil de Vendas ausente da Nova Automação, Canais ausentes do campo. Uma falha inicial de teste (`getByLabelText("Pedido")` sem aceitar o asterisco de obrigatório) foi corrigida antes de o RED valer.
- **GREEN 2** (`c716bb8`): 15/15 no arquivo; web inteira verde.
- **REFACTOR:** nenhum.

## Task Commits

1. **Task 1 (traçador): Âncora do Chat no CRM novo** — `5536fc2` (test, RED), `1b05fbb` (feat, GREEN)
2. **Task 2: Agentes e Automações no CRM novo** — `f53013c` (test, RED), `c716bb8` (feat, GREEN; inclui o `CONTEXT.md` da web)

**Plan metadata:** commit `docs(15-21)` seguinte (SUMMARY e WINDOWS), mais o de STATE e ROADMAP.

## Files Created/Modified

- `apps/web/src/features/ia/ancora-do-chat.tsx` — diálogo da Âncora, `useNomeDaEscolha`, `ancoraDaEscolha`, `nomesDaEscolha`, `NOME_INDISPONIVEL`.
- `apps/web/src/app/(shell)/ia/chat/page.tsx` e `[sessao]/page.tsx` — mandam `nomes` e o nome da Âncora vem do hook.
- `apps/web/src/features/ia/agentes/ensaiar-dialog.tsx`, `agente-completo.tsx`, `conversas-do-agente.ts` — ensaio, contagem de Conversas.
- `apps/web/src/features/ia/automacoes/funis-do-escopo.ts` (novo), `editor-de-automacao.tsx`, `nova-automacao-dialog.tsx`, `automacao-spec.ts`, `bloco-form.tsx` e `personalizar/secoes-catalogo.tsx` — Funil e Canal.
- `apps/web/src/features/ia/ia-no-crm-novo.test.tsx` — 15 casos com `fetch` falso e o store do seed sem as coleções do CRM antigo.
- `apps/web/CONTEXT.md` — onde a IA lê o CRM novo.

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: o diálogo ganhou um campo de busca que vai à api como `q`; a escolha leva o nome para `nomes` e fica fora do pedido da Âncora; a lista de Funis é lida em dois estados e não dá aviso enquanto não chega; o Canal e a contagem de Conversas vêm da api.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `secoes-catalogo.tsx` também chamava `inoperante` sem os Funis**
- **Found during:** Task 2
- **Issue:** o plano lista o editor, mas o catálogo de Automações (`personalizar/secoes-catalogo.tsx`) calcula o mesmo aviso "inoperante" para cada cartão; sem os Funis, toda Automação de escopo Funil apareceria como "escopo eliminado" ali (era o que o WINDOWS #16 descrevia).
- **Fix:** `AutomacoesCatalogo` usa `useFunisDoEscopo` e `inoperanteComFunis`.
- **Files modified:** `apps/web/src/features/ia/personalizar/secoes-catalogo.tsx` (fora de `files_modified`)
- **Verification:** `tsc` limpo, web inteira verde
- **Committed in:** `c716bb8`

**2. [Rule 3 - Blocking] Dois módulos pequenos novos, fora de `files_modified`**
- **Found during:** Task 2
- **Issue:** a leitura dos Funis (duas listas, `pronto`, `inoperanteComFunis`) é usada pelo editor, pelo catálogo e pela Nova Automação, e a contagem de Conversas precisa de hook antes do `return` antecipado da ficha do Agente.
- **Fix:** `automacoes/funis-do-escopo.ts` e `agentes/conversas-do-agente.ts`, em vez de repetir a leitura em três arquivos.
- **Files modified:** os dois arquivos novos
- **Committed in:** `f53013c` (esqueleto) e `c716bb8`

**3. [Rule 2 - Missing Critical] `inoperanteComFunis` não acusa "escopo eliminado" antes da lista chegar**
- **Found during:** Task 2
- **Issue:** passar a lista vazia de quem ainda não carregou faria o aviso "inoperante: escopo eliminado (Funil)" piscar em toda abertura do editor e do catálogo, e ficar para sempre se a api recusasse.
- **Fix:** `pronto` falso (carregando ou erro) → sem aviso para escopo Funil. Caso `(m)` do teste.
- **Files modified:** `automacoes/funis-do-escopo.ts`
- **Committed in:** `c716bb8`

**4. [Critério do plano] `grep -c "useFunis"` em `editor-de-automacao.tsx` conta o hook novo, não `useFunis` direto**
- O critério pede `useFunis` >= 1 no editor; o editor chama `useFunisDoEscopo` (que chama `useFunis` em `funis-do-escopo.ts`). O grep de substring dá 2 (importação e chamada), o critério passa; a leitura direta de `useFunis` mora no módulo compartilhado. A `key_link` do frontmatter do plano (`editor-de-automacao.tsx` → `funis.ts` via `useFunis`) passa por esse módulo.

### Decisões que mudam comportamento visível (nenhuma nova entra em WINDOWS.md)

- O diálogo da Âncora e o do ensaio ganharam o campo "Buscar registro"; a lista de Negócios, Contatos e Conversas traz até 30 por busca (antes eram todos os do store). Um Espaço com mais de 30 registros que casem com o texto digitado precisa afinar a busca.
- O escopo "na lixeira" de Funil continua sendo "escopo eliminado" (consequência de `escopoExiste` do 15-39, parte do que o WINDOWS #16 descrevia): é a regra do domínio, não da tela, e não muda aqui.
- Sem resposta da api para a contagem, a ficha do Agente diz "as Conversa(s)" em vez de um número.

**Total deviations:** 3 auto-fixed (2 Rule 3, 1 Rule 2), 1 nota de critério. **Impact:** nenhum no contrato do plano; o arquivo extra e os dois módulos são o mínimo para o escopo Funil e a contagem funcionarem.

## WINDOWS.md

- **#13 (15-08, Âncora do Chat/ensaio nomeada pelo id até o 15-21 mandar `nomes`): marcado `fixed`.** A home, a Sessão e o ensaio mandam `nomes`.
- **#16 (15-39, escopo Funil como "escopo eliminado" até o 15-21 passar os Funis): marcado `fixed`.** O editor, o catálogo e a Nova Automação passam os Funis de `useFunis`; a parte "Funil na lixeira vira eliminado" é regra do domínio e fica.
- Nenhuma linha nova aberta.

## Issues Encountered

- Nenhum banco foi necessário (testes de web com `fetch` falso); nenhum contêiner foi iniciado.
- `src/sem-crm-antigo.test.ts` mantém os cinco arquivos de `features/ia` na lista `CONGELADOS`: a lista é esvaziada no 15-33 (regra do próprio teste, para planos paralelos não disputarem o arquivo). Este plano provou por grep que eles saíram do regex.

## Known Stubs

Nenhum. Os esqueletos de `conversas-do-agente.ts` e `funis-do-escopo.ts` do RED foram substituídos no GREEN.

## Threat Flags

Nenhum além do `<threat_model>`. T-15-53 (nome de registro sem permissão na âncora): `POST /crm/nomes` devolve `null` sem permissão e a tela mostra "Registro indisponível" (casos `(b)` e `(i)`); o `nomes` e o `funis` que o navegador manda continuam sendo descartados e relidos no servidor (15-08, 15-39).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- A tela da IA (3.4.9) está no CRM novo; o que falta da IA no modelo antigo é Grupo e Flow (Sessões 6 e 7).
- 15-33 esvazia a lista `CONGELADOS` e liga a metade "a lista só encolhe" do `sem-crm-antigo.test.ts`.
- Nenhum contêiner Docker foi usado; nada a parar.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivos criados conferidos no disco (`ia-no-crm-novo.test.tsx`, `funis-do-escopo.ts`, `conversas-do-agente.ts`); commits `5536fc2`, `1b05fbb`, `f53013c` e `c716bb8` presentes no ramo.
