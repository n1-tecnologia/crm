---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 15
subsystem: web
tags: [swr, resumo-em-lote, tarefa-conversacional, cartao, tabela, ficha, d-01, corte-da-fase-15]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "14-13 POST /tarefas-conversacionais/resumo e VinculoParaResumo/ResumoDaTarefaConversacional/RESUMO_MAXIMO; vinculosDoCrmDaTarefa do domínio (14-02)"
provides:
  - "dados/crm/tarefas-conversacionais.ts: useResumoDasTarefas, ProvedorDoResumoDasTarefas e useResumoDaTarefa (UMA chamada por Lista, lotes de 200)"
  - "CartaoConversacional, linha da tabela, cartão de Reunião, ficha da Tarefa e a contagem de Contatos da Lista lendo o resumo da api (UNI-14, lado web)"
  - "RostoDoContato e PilulasDoCanal (cartao-conversacional.tsx) e CelulaDoContato/CelulaDoCanal (tabela-de-tarefas.tsx)"
affects: [14-16, 14-17, 14-18, fase-15-telas-no-modelo-novo]

actuals:
  tokens: 13000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Resumo em lote por provedor de contexto: uma busca SWR por Lista; cada cartão/linha lê do mapa, e quem o provedor não cobre faz a própria chamada"
    - "Chave de SWR em array com a assinatura (taskId + contatoId + conversaId + negocioId) de cada Tarefa: trocar de Canal ou de Negócio muda a chave e busca de novo"
    - "Tarefa sem nenhum Vínculo do CRM não vai à api: o resumo vazio dela é montado no cliente"

key-files:
  created:
    - apps/web/src/dados/crm/tarefas-conversacionais.ts
    - apps/web/src/dados/crm/tarefas-conversacionais.test.ts
    - apps/web/src/features/estrutura/cartao-conversacional.test.tsx
    - apps/web/src/features/estrutura/tarefa-completa-resumo.test.tsx
  modified:
    - apps/web/src/features/estrutura/cartao-conversacional.tsx
    - apps/web/src/features/estrutura/tabela-de-tarefas.tsx
    - apps/web/src/features/estrutura/cartao-de-tarefa.tsx
    - "apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx"
    - apps/web/src/features/estrutura/tarefa-completa.tsx

key-decisions:
  - "O provedor envolve a página INTEIRA da Lista (não só as visualizações) e recebe `todas` as Tarefas da Lista conversacional, não as filtradas: filtrar ou buscar não muda a chave, então não refaz a chamada, e a ficha aberta em popup lê da mesma resposta"
  - "A chave de SWR leva os três ids de cada Tarefa, não só o taskId (o plano dizia 'ids ordenados'): sem isso, trocar o Canal ou o Negócio serviria o resumo velho"
  - "Sem ponte (D-01): a Empresa, a temperatura, a qualificação e o estado/Atribuído da Conversa saíram do cartão e da ficha, porque o resumo não os carrega; resumo sem Contato mostra 'Contato indisponível' no cartão e o aviso 'sem Contato' na ficha"
  - "`dadosDoCartaoConversacional` decide 'é conversacional' pelo id do Vínculo (vinculosDoCrmDaTarefa), e quem o Contato é fica com o resumo; por isso quadro-negocios.tsx não precisou mudar"
  - "O rosto do Contato são as iniciais (RostoDoContato): o resumo não traz foto"
  - "useResumoDaTarefa ganhou o parâmetro opcional `pausado` (o cartão de Tarefa comum só pede o resumo quando é Reunião)"

requirements-completed: [UNI-14]

coverage:
  - id: D1
    description: "Abrir uma Lista com 50 Tarefas faz UMA chamada a POST /tarefas-conversacionais/resumo com os Vínculos de vinculosDoCrmDaTarefa; 250 vão em duas (200 + 50); render repetido não refaz a chamada"
    requirement: "UNI-14"
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/tarefas-conversacionais.test.ts#(a) 50 Tarefas fazem uma chamada só"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/crm/tarefas-conversacionais.test.ts#(f) dentro do provedor, cada Tarefa lê do lote: 50 cartões, uma chamada"
        status: pass
    human_judgment: false
  - id: D2
    description: "O cartão conversacional mostra o nome do Contato, o Canal com o selo do provedor e o trecho da última Mensagem do resumo; esqueleto até a resposta; resumo sem Contato não volta à leitura antiga"
    requirement: "UNI-14"
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/cartao-conversacional.test.tsx#CartaoConversacional"
        status: pass
    human_judgment: false
  - id: D3
    description: "A tabela (Contato e Canal) e o cartão de Reunião (título do Negócio) leem o resumo; a página da Lista conta Contatos distintos pelos ids dos Vínculos"
    requirement: "UNI-14"
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/cartao-conversacional.test.tsx#a tabela e o cartão de Reunião leem o resumo"
        status: pass
    human_judgment: false
  - id: D4
    description: "A ficha da Tarefa mostra Contato, Canal, Conversa e Negócio pelo resumo, com os links dos ids novos"
    requirement: "UNI-14"
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/tarefa-completa-resumo.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "Contato, Canal e última Mensagem aparecem na Lista e na ficha com uma chamada só ao resumo no painel de rede, contra a api real num Postgres local"
    requirement: "UNI-14"
    verification: []
    human_judgment: true
    rationale: "O <human-check> da Task 3 (api real + painel de rede) não foi rodado: tudo foi provado com api e estado falsos. Só faz sentido depois do script de migração da Fase 15, quando as Tarefas apontam para ids novos."

duration: 25min
completed: 2026-11-04
status: complete
plan_head_before: b9c3d861dee695af931039817a52f82367e6e0ed
plan_head_after: ea419f54e6740f7b3c0fea8e9dd6c477eb1ae187
commits: 5
---

# Phase 14 Plan 15: Telas da Tarefa conversacional leem o resumo da api Summary

**`useResumoDasTarefas`/`ProvedorDoResumoDasTarefas`/`useResumoDaTarefa` buscam Contato, Canal, última Mensagem e Negócio de toda a Lista em `POST /tarefas-conversacionais/resumo` numa chamada só (lotes de 200), e o cartão, a tabela, o cartão de Reunião, a ficha da Tarefa e a contagem de Contatos deixam de ler `contatoDaTarefa`, `canalDaTarefa`, `ultimaMensagemDaTarefa` e `negocioDaTarefa`.**

## Só no deploy da Fase 15

Este plano é CORTE (D-01). Os cinco commits abaixo ficam no ramo `fase-13-gravacao-em-menos-idas-e-voltas` e **não podem subir antes do script de migração da Fase 15**. A fronteira de deploy aditiva é o commit `b9c3d86` (fim do 14-14); tudo depois dele, deste plano em diante, é corte:

| Commit | O que é |
|---|---|
| `29ca833` | RED do cliente do resumo (só teste) |
| `44e2e9b` | `tarefas-conversacionais.ts` (web) |
| `ef1ebd1` | RED do cartão, tabela e cartão de Reunião (só teste) |
| `3221865` | cartão, tabela, cartão de Reunião e página da Lista |
| `ea419f5` | ficha da Tarefa |

Por quê: uma Tarefa cujo Vínculo ainda aponta para um id do modelo antigo volta do resumo com Contato, Canal e Negócio `null`. Em produção, hoje, todas as Tarefas conversacionais estão assim, então este código sem a migração mostraria cartões "Contato indisponível" e fichas sem Contato (T-14-39). Nenhum arquivo do `apps/api`, do domínio ou de migração mudou neste plano.

## Performance

- **Duration:** 25 min (20:01 a 20:26 UTC)
- **Tasks:** 3 (Tasks 1 e 2 em RED/GREEN; Task 3 `auto`)
- **Files modified:** 9 (4 novos, 5 alterados)

## Accomplishments

- **Cliente do resumo.** Os Vínculos saem de `vinculosDoCrmDaTarefa(state, task)` (a Subtarefa lê a raiz). 50 Tarefas = 1 chamada; 250 = 2 (200 + 50, `Promise.all`). Erro da api fica em `erro` com `porTarefa` vazio; 4xx não tenta de novo, rede e 5xx sim. `keepPreviousData` evita o cartão piscar quando uma Tarefa nova entra.
- **Cartão conversacional.** Nome do Contato (rosto com iniciais), pílula do Canal com o selo do provedor (`oficial`, `não oficial`, `IMAP/SMTP`), destaque com o trecho da última Mensagem e o "há quanto tempo". Esqueleto no rosto, no título e no destaque até a resposta chegar.
- **Tabela.** Duas células novas, `CelulaDoContato` e `CelulaDoCanal`, cada uma com o hook (são componentes porque a linha é desenhada dentro de um `.map`).
- **Cartão de Reunião.** O subtítulo "Reunião · <título do Negócio>" vem do resumo; o hook fica `pausado` em todo cartão que não é de Reunião, então um cartão de Tarefa comum não faz chamada.
- **Página da Lista.** `ProvedorDoResumoDasTarefas` em volta da página inteira, com as Tarefas da Lista quando ela é conversacional; a contagem "N Contatos" usa `new Set(vinculosDoCrmDaTarefa(...).contatoId)`, sem chamar a api.
- **Ficha da Tarefa.** A seção CRM e o aviso "Tarefa conversacional sem Contato" leem o resumo. Link do Contato para `/crm/contatos/<id>`, do Negócio para `/crm/negocios/<id>`, da Conversa para `/crm/caixa-de-entrada/<conversaId>` (id do Vínculo).

## Task Commits

1. **Task 1: cliente do resumo em lote** — `29ca833` (test, RED), `44e2e9b` (feat, GREEN)
2. **Task 2: cartão, tabela, cartão de Reunião e página da Lista** — `ef1ebd1` (test, RED), `3221865` (feat, GREEN)
3. **Task 3: ficha da Tarefa** — `ea419f5` (feat; inclui `tarefa-completa-resumo.test.tsx`)

**Plan metadata:** commits `docs(14-15)` seguintes (SUMMARY, STATE e ROADMAP).

## TDD Gate Compliance

- **Task 1 (RED):** o teste foi provado contra um esqueleto inerte dos três exports, fora do commit: 9 de 10 casos falharam na asserção do comportamento planejado (o 10º, "pausado não chama a api", passa também no esqueleto, como esperado). O commit RED traz só o arquivo de teste, então, sozinho, ele falha no import do módulo que ainda não existe. Avaliação semântica: as falhas são as do plano (chamadas contadas, lotes, chave, erro), não de sintaxe nem de fixture.
- **Task 2 (RED):** sem o esqueleto, as falhas vieram do código antigo lendo `state.contacts`/`state.channels`/`state.deals` do estado falso (que só tem Vínculos) e dos exports que ainda não existiam (`CelulaDoContato`, `CelulaDoCanal`). É RED mais fraco que o da Task 1: prova que o código antigo ainda lia o CRM em memória, mas várias falhas são de fixture. Aceito por ser tela.
- GREEN de cada tarefa passa; a Task 3 não é `tdd` e foi entregue com o teste junto.

## Deviations from Plan

**1. [Interpretação] Chave de SWR com os ids, não só os `taskId`**
- O plano pede "chave estável pelos ids ordenados". A chave leva `taskId|contatoId|conversaId|negocioId` de cada Tarefa, em ordem. Sem isso, trocar o Canal (muda `conversaId`) ou ligar um Negócio serviria o resumo antigo até a próxima revalidação. Teste (i). Nenhum custo: Tarefas iguais seguem dando a mesma chave.

**2. [Interpretação] Tarefa sem nenhum Vínculo do CRM não vai à api**
- O resumo dela é `{ contato: null, canal: null, ultimaMensagem: null, negocio: null }`, montado no cliente (é a mesma resposta que a api daria). Evita chamada à toa na ficha de uma Tarefa operacional e deixa a ficha distinguir "carregando" (`undefined`) de "sem Contato" (`contato: null`).

**3. [Interpretação] `useResumoDaTarefa(taskId, { pausado })` e `cobre`**
- A interface do plano tinha só `taskId`. O parâmetro `pausado` evita uma chamada por cartão de Tarefa comum. O provedor também expõe o conjunto das Tarefas que cobre; quem ele não cobre faz a própria chamada em vez de ficar `undefined` para sempre.

**4. [Interpretação] O provedor cobre `todas` e a página inteira**
- Em volta da página (não só da div das visualizações), para o popup da ficha também ler dele; e com `todas`, não as filtradas, para que busca e filtro não refaçam a chamada. Uma Lista com mais de 200 Tarefas faz um lote por 200 na abertura.

**5. [Rule 2 - Correção] Perdas conscientes por não haver ponte (D-01)**
- A Empresa, a temperatura e a qualificação do Contato, e o estado e o Atribuído da Conversa, saíram do cartão e da ficha. O resumo não os carrega, e ler `state.contacts`/`state.conversations` por id seria a ponte que a D-01 proíbe. A linha "Empresa" da ficha foi removida; a de Conversa virou só o link "Abrir na Caixa de Entrada". Se o dono quiser de volta, o caminho é a api devolver esses campos no resumo (plano novo no `apps/api`), não ler o estado.

**6. [Escopo] `quadro-negocios.tsx` não mudou**
- Está fora de `files_modified` e não precisou: `dadosDoCartaoConversacional(state, task)` mantém a assinatura e o retorno `| undefined`, só que agora decide pelo id do Vínculo.

**Total deviations:** 6 (4 interpretações, 1 perda consciente por decisão do plano, 1 de escopo evitado). **Impact:** nenhum arquivo fora de `files_modified` além dos testes novos, SUMMARY, STATE e ROADMAP.

## O que ficou na leitura antiga (para o 14-16 tirar)

Em `tarefa-completa.tsx`, `contato`, `canal` e `negocio` (de `contatoDaTarefa`, `canalDaTarefa`, `negocioDaTarefa`) seguem existindo, só para:

1. **O fio de Mensagens** (`ConversationThread contact={contato}`, `canalSelecionado`) e a decisão `fichaConversacional` que muda o layout (colunas, rolagem). Depois da migração, com ids novos, essas leituras voltam `undefined`: a ficha mostra a seção CRM, mas **não** o fio nem o layout de três colunas. Quem entrega o fio no modelo novo é a Fase 15 (Caixa e Conversas); o 14-16 não o toca.
2. **Os três gestos de escrita**: o `Select` de trocar Canal (`trocarCanalDaTarefa`, opções de `canaisDaListaQueAlcancam`), o `Select` de ligar Negócio (`vincularNegocioATarefa`, opções de `state.deals`) e o diálogo "Criar Negócio a partir desta Tarefa" (`criarNegocioDaTarefa`), mais os `disabledReason` do menu que dependem de `contato` e `negocio`. É o escopo do 14-16.

Os dois `Select` mostram o valor atual pelo id antigo (`canal?.id`, `negocio?.id`); com ids novos o valor fica em branco até o 14-16 trocar as opções pelas das tabelas.

## Issues Encountered

- Nenhuma falha. Suíte inteira do `apps/web`: 102 arquivos, 991 testes passam. `tsc --noEmit` limpo. `eslint .`: 0 erros, 2 avisos antigos (`rotulos.ts`, `app-shell.tsx`), nenhum de arquivo meu. `verificar:tokens`: 0 falhas.
- O `<human-check>` da Task 3 (api real num Postgres local, painel de rede) não foi rodado: foi provado com `fetch`, estado e resumo falsos. Faz sentido refazer depois do script de migração.

## Known Stubs

Nenhum. O cartão mostra esqueleto enquanto o resumo não chega: é estado de carregamento, não dado falso.

## Threat Flags

Nenhuma superfície nova. T-14-38 (XSS pelo trecho da Mensagem): o trecho entra como texto React; há teste com `<img onerror>`. T-14-39 (publicar o corte antes da migração): ver a seção "Só no deploy da Fase 15"; o fechamento (14-18) registra a fronteira em `14-PROVAS.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **14-16** (web, gestos de escrita): troque os três gestos da ficha pelas rotas `POST /tarefas-conversacionais/:taskId/canal`, `/negocio`, `/negocio/novo` (14-14) e tire `contato`, `canal`, `negocio` e os imports `contatoDaTarefa`, `canalDaTarefa`, `negocioDaTarefa` de `tarefa-completa.tsx`. Depois do gesto, o resumo se atualiza sozinho: a chave de SWR leva os ids do Vínculo, que o gesto muda. O hook não é invalidado por `invalidarCrm` (a chave é array, não string); se uma tela precisar refazer a busca sem mudar Vínculo (nova Mensagem chegou), chame `mutate` com a chave do módulo ou acrescente uma função `invalidarResumoDasTarefas` aqui.
- **14-17** (corte do modelo antigo): `contatoDaTarefa`, `canalDaTarefa`, `ultimaMensagemDaTarefa` e `conversaDaTarefa` ainda são importados por `tarefa-completa.tsx` (14-16 tira); `negocioDaTarefa` também por `quadro-negocios.tsx` (`dealOfTask`, para o cartão de Negócio espelho) e `deal-card`: não são deste plano.
- **Fase 15:** o fio da ficha (`ConversationThread`) segue no modelo antigo (ver acima). Se o dono quiser Empresa, temperatura e estado da Conversa de volta na ficha e no cartão, o resumo da api precisa devolvê-los.
- `apps/web/CONTEXT.md` ainda não cita `dados/crm/tarefas-conversacionais.ts` (fora dos `files_modified`); uma linha na seção da "segunda fronteira" resolve.

## Self-Check: PASSED

- Arquivos criados existem: `tarefas-conversacionais.ts` e `.test.ts` (dados/crm), `cartao-conversacional.test.tsx`, `tarefa-completa-resumo.test.tsx`.
- Commits `29ca833`, `44e2e9b`, `ef1ebd1`, `3221865`, `ea419f5` são ancestrais de HEAD; `commits: 5` medido de `plan_head_before` a `plan_head_after`.
- Critérios de aceitação: Task 1 (`export function` x3 = 3, `vinculosDoCrmDaTarefa` = 4); Task 2 (`useResumoDaTarefa` nos três arquivos soma 8 linhas, `ProvedorDoResumoDasTarefas` na página = 3, `contatoDaTarefa|canalDaTarefa|ultimaMensagemDaTarefa` em `cartao-conversacional.tsx` = 0); Task 3 (`useResumoDaTarefa` em `tarefa-completa.tsx` >= 1).
- `<verification>` do plano: `tsc --noEmit` e `vitest run src/dados src/features/estrutura` verdes (44 arquivos, 443 testes na rodada de Task 3; suíte inteira 102 arquivos, 991 testes).

---
*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Completed: 2026-11-04*
