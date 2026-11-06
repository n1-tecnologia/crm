---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 12
subsystem: crm
tags: [canais, filas, caixa-de-entrada, configuracoes, popup, swr, tdd, ucr-05]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-06: useConversas (filaId, atribuidoId, canalId, situacao) e a guarda sem-crm-antigo com CONGELADOS; 15-11: o padrao de lista pelo CRM novo"
provides:
  - "AdicionarCanalDialog { tipo?, open, onClose, jaLigados, onEscolher }: so escolhe entre useCanais e leva a /crm/caixa-de-entrada/configuracoes/canais/conectar (D-15-12)"
  - "useCanal(id) em dados/crm/canais.ts (GET /canais/:id; 404 fica em error)"
  - "ficha do Canal, pagina da Fila e Configuracoes da Caixa lendo Canais e Conversas so por HTTP"
  - "cinco arquivos a menos em CONGELADOS da guarda sem-crm-antigo da web"
affects: [15-21, 15-24, 15-33]

plan_head_before: 200fec5bf0463358fdf793f42a81a22e9ef583ea
plan_head_after: e3a9a1c86a9aa67aaeccd6603f36d1a8222a4dec

actuals:
  tokens: 29800
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "pagina dividida em carga (useCanal: carregando, 404, erro) e ficha (FichaDoCanal / FichaDaFila), para os hooks da ficha nao dispararem para um id que nao existe"
    - "numero na tela = total da api com consulta de uma linha (limite=1) por Fila e por Membro, nunca o tamanho da pagina"
    - "selos do provedor alimentados por um adaptador { channelType, provider, relational: true, simulatedConnection } sobre o Canal novo, sem tocar em selo-do-provedor.tsx"

key-files:
  created:
    - apps/web/src/features/crm/adicionar-canal-dialog.test.tsx
    - apps/web/src/features/crm/configuracoes-da-caixa.test.tsx
  modified:
    - apps/web/src/features/crm/adicionar-canal-dialog.tsx
    - apps/web/src/features/estrutura/canais-de-atendimento.tsx
    - apps/web/src/features/estrutura/container-settings.tsx
    - apps/web/src/features/estrutura/create-container-dialog.tsx
    - apps/web/src/features/estrutura/container-settings.test.tsx
    - apps/web/src/dados/crm/canais.ts
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/filas/[fila]/page.tsx
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx
    - apps/web/src/features/crm/ficha-do-canal.test.tsx
    - apps/web/src/features/crm/conectar-canal.test.tsx
    - apps/web/src/features/crm/conectar-provedor.test.tsx
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md
    - CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "O popup das Listas escolhe com selecao (radio) e confirma em 'Marcar nesta Lista': o ConfirmDialog do projeto exige um botao de confirmar, e assim 'fechar sem escolher' fica provado como nao gravar nada"
  - "Canal desconectado que a Lista ainda nao usa aparece no popup mas nao se escolhe, a mesma regra da secao de Canais de atendimento"
  - "A permissao de conectar fica no link do popup (usePodeNoCrm('criar','canal')), nao em escolher: marcar um Canal ja cadastrado numa Lista e configurar a Lista, que a secao ja protege com 'motivo'"
  - "Configuracoes da Caixa lista Canais ativos e arquivados (duas chamadas a useCanais), para o arquivado seguir alcancavel como no modelo antigo"
  - "A carga por Membro mora na pagina da Fila (as linhas dos elegiveis), com filaId junto de atribuidoId; o plano a descreve como 'Configuracoes da Caixa com dois Membros', mas nessa pagina nao ha linha por Membro"

requirements-completed: []

coverage:
  - deliverable: "o popup 'Adicionar Canal' lista useCanais, escolhe, leva a pagina de conectar e nao grava nada; Canal ja ligado nao e oferecido"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/adicionar-canal-dialog.test.tsx#(1) a (7)", status: pass }
      - { kind: test, ref: "apps/web/src/features/estrutura/container-settings.test.tsx#Modelo e canais pelos Canais da tabela", status: pass }
    human_judgment: false
  - deliverable: "a secao Canais de atendimento das Listas le useCanais"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/adicionar-canal-dialog.test.tsx#(8)", status: pass }
    human_judgment: false
  - deliverable: "a ficha do Canal le GET /canais/:id e salva por PATCH /canais/:id; 404 vira 'Canal nao encontrado.'; Conversas do Canal pelo total"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/ficha-do-canal.test.tsx#(1) a (8)", status: pass }
    human_judgment: false
  - deliverable: "a pagina da Fila e as Configuracoes da Caixa contam por filaId e atribuidoId com o total da api"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/configuracoes-da-caixa.test.tsx#(1) a (6)", status: pass }
    human_judgment: false
  - deliverable: "as tres paginas e o popup ficam visualmente iguais as de antes, menos o que o SUMMARY lista como visivel"
    verification: []
    human_judgment: true
    rationale: "Os testes provam conteudo, URL pedida e gravacao; que o desenho continue o mesmo na tela e juizo visual (fim da fase, human_verify_mode = end-of-phase)."
---

# Phase 15 Plan 12: Configurações da Caixa, Filas, Canais e o popup das Listas pelo CRM novo Summary

**O popup "Adicionar Canal" das Listas deixa de criar Canal (só escolhe entre `useCanais` e leva à página de conectar, D-15-12), a ficha do Canal lê `GET /canais/:id` e salva por `PATCH`, e a página da Fila e as Configurações da Caixa contam e listam por `GET /conversas?filaId=` e `?atribuidoId=` com o `total` da api.**

## Performance

- **Tasks:** 3 (1 traçador, 2 auto), todas `tdd="true"`
- **Files:** 2 criados, 14 modificados (13 de web e documentação, mais `.planning/WINDOWS.md`)
- **Commits:** 7 (3 RED, 3 GREEN, 1 docs), medidos de `plan_head_before`
- **Duração:** cerca de 16 min

## Accomplishments

- **Traçador (Task 1):** `AdicionarCanalDialog` não importa mais nada de `@n1/dominio/operations` nem cria Canal. Lista os Canais ativos de `useCanais` que a Lista ainda não usa (com `tipo`, só os daquele tipo), escolhe por radio e devolve o id em `onEscolher`; o botão "Conectar um Canal novo" é um link para `/crm/caixa-de-entrada/configuracoes/canais/conectar` (desligado com o motivo do Papel se `usePodeNoCrm("criar", "canal")` recusa). `CanaisDeAtendimento` lê `useCanais` (Setor e Origem continuam do store). `container-settings.tsx` e `create-container-dialog.tsx` passam `jaLigados` e `onEscolher`; escolher grava com `definirCanaisDaLista` como antes. Um caso de integração em `container-settings.test.tsx` prova o caminho Lista → popup → "marcado nesta Lista".
- **Ficha do Canal (Task 2):** `useCanal` novo em `dados/crm/canais.ts`; a página vira carga (carregando, 404 = "Canal não encontrado.", outro erro com a frase da api) mais `FichaDoCanal`. Salvar Setor/Origem é `editarCanal` (`PATCH`), sem o ramo do Canal do seed nem `configurarCanal`. O número de Conversas do cabeçalho é o `total` de `useConversas({ canalId, limite: 20 })`. Depois de cada escrita ainda chama `rehidratar()`, porque o fio da Conversa lê o espelho do Canal em `GET /estado`.
- **Fila e Configurações (Task 3):** a página da Fila lista `useConversas({ filaId, limite: 20 })` (nome do Contato em `contatoNome`, Atribuído resolvido no store), mostra o `total` no cabeçalho e no "Mostrando N de M", calcula a carga de cada Membro elegível com `useConversas({ filaId, atribuidoId, situacao: "aberta", limite: 1 })` e lista os Canais da Fila de `useCanais` pela `filaPadraoId`. As Configurações da Caixa listam Canais ativos e arquivados de `GET /canais` (com estado de carregando e de erro, sem o falso "Nenhum Canal") e contam as Conversas de cada Fila pelo `total`.
- **Guarda:** cinco arquivos saem de `CONGELADOS` em `apps/web/src/sem-crm-antigo.test.ts`, provado por grep (0 leituras de `contacts|channels` em cada um): `canais-de-atendimento.tsx`, `container-settings.tsx`, `create-container-dialog.tsx`, `canais/[canal]/page.tsx`, `filas/[fila]/page.tsx`, e também `dados/crm/canais.ts` (um comentário citava o campo antigo; reescrito).

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (traçador) | `2dc9068` | `6312b77` |
| 2 | `ee2ad59` | `f4c8206` |
| 3 | `c59d328` | `a286ef0` (+ docs `e3a9a1c`) |

Avaliação do RED:

- **Task 1:** os 8 casos falharam. O primeiro erro foi `useRun` ausente do mock de `@/dados/store` (o popup antigo chamava `useRun`) e, no caso da seção, `state.channels` indefinido (`Cannot read properties of undefined (reading 'filter')`): falham porque o código antigo lê o store em vez de `useCanais`, que é o comportamento planejado. Registro a diferença: parte da falha vem do mock que reflete o contrato novo, não de uma asserção de valor.
- **Task 2:** os 8 casos falharam por asserção/consulta (a página ainda lia `state.channels`, então nunca mostrava o heading do Canal da api nem pedia `GET /canais/:id`). Na volta ao GREEN um caso (5) precisou de ajuste do próprio teste: `GET` e `PATCH` batem na mesma URL e o teste agora acha o `PATCH` pelo método.
- **Task 3:** 5 de 6 falharam em asserções reais (Conversa não aparecia, total, carga por Membro, Canais); o caso 4 ("Fila não encontrada.") já passava e fica como regressão. Depois do GREEN o "Mostrando 20 de 37" do teste virou "Mostrando 2 de 37": a tela mostra quantas linhas tem, e é isso que prova que o total não é o tamanho da página.
- Plano `type: execute`, então não rodei `gsd check tdd-red-evidence`. Sem REFACTOR separado.

## Verificação

Só `apps/web` mudou; nenhum teste daqui precisa de banco (tudo com `fetch` falso e sessão falsa). Por isso não subi o contêiner `crm-n1-pg-1512`: nada a parar no fim. Nenhum `npm test` puro e nenhuma leitura de `.env`.

- `apps/web`: suíte inteira 1116/1116 (116 arquivos), `tsc --noEmit` limpo, `eslint src` sem erros (2 avisos antigos fora dos arquivos tocados: `rotulos.ts`, `app-shell.tsx`), `verificar:tokens` 0 falhas.
- Verificações do plano: `adicionar-canal-dialog.test.tsx` + `container-settings.test.tsx` (Task 1), `ficha-do-canal.test.tsx` (Task 2), `configuracoes-da-caixa.test.tsx` + `sem-crm-antigo.test.ts` mais o `awk` do plano com soma 0 (Task 3), todos verdes.
- Critérios de aceitação: `@n1/dominio/operations` em `adicionar-canal-dialog.tsx` = 0; link de conectar = 2 (>= 1); `state.channels` em `canais-de-atendimento.tsx` = 0; `state.(channels|conversations)|configurarCanal` na ficha do Canal = 0; `useConversas` na página da Fila = 3 (>= 1); `filaId` = 9 e `atribuidoId` = 7 no teste novo. Nenhum componente da web chama mais `criarCanal`/`configurarCanal` antigos (o `criarCanal` que sobra é o HTTP de `dados/crm/canais`, usado por `conectar-provedor.tsx`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dois testes antigos liam a lista de Canais do store**
- **Found during:** Task 3, suíte inteira
- **Issue:** `conectar-canal.test.tsx` e `conectar-provedor.test.tsx` renderizam as Configurações da Caixa e esperavam os Canais de `state.channels` (o Canal do seed marcado "demo", o Canal novo vindo de `rehidratar`). Com a lista vinda de `GET /canais`, o primeiro mostrava dois botões "Conectar Canal" (estado vazio) e o segundo não achava o Canal novo.
- **Fix:** os dois ganharam um `fetch` falso que responde `GET /canais`; o segundo acrescenta o Canal novo ao responder o `POST` e revalida pelo `mutate` do cache isolado (mesmo molde de `inbox-columns.test.tsx`). A afirmação do selo "demo" saiu: todo Canal da lista é da tabela.
- **Files modified:** `apps/web/src/features/crm/conectar-canal.test.tsx`, `apps/web/src/features/crm/conectar-provedor.test.tsx`
- **Commit:** `a286ef0`

**2. [Rule 2 - Missing critical] Estados de carregando e de erro nas Configurações da Caixa**
- **Found during:** Task 3
- **Issue:** com a lista vinda de uma consulta, enquanto ela carrega (ou falha) a seção de Canais mostraria "Nenhum Canal configurado." e um segundo botão de conectar, o que é falso.
- **Fix:** "Carregando os Canais…" e "Não foi possível carregar os Canais." com a frase da api; a contagem do topo mostra "—" até chegar.
- **Files modified:** `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx`
- **Commit:** `a286ef0`

**3. [Plano diverge do contrato] A "carga por Membro" não está nas Configurações da Caixa**
- O plano descreve as linhas de carga por Membro em `configuracoes/page.tsx` (~145) e testa "Configurações da Caixa com dois Membros". Essa página tem a carga por **Fila** (~145) e não tem linha por Membro; as linhas por Membro são as dos elegíveis na **página da Fila**. Implementei as duas coisas onde elas existem: a Fila conta por `filaId=<fila>&limite=1` nas Configurações e o Membro conta por `atribuidoId=<membro>&situacao=aberta&limite=1` (mais `filaId`, para manter a semântica "nesta Fila") na página da Fila. Os dois estão no teste novo.

### Visíveis (abertas em `.planning/WINDOWS.md`, ids 20 e 21)

- **Mensagens de modelo e "N modelo(s) aprovado(s)":** `plataforma.canais` não guarda modelos (só o Canal do seed tinha), então a seção da ficha mostra sempre "Nenhuma Mensagem de modelo sincronizada." e o cartão da Configuração da Caixa deixou de dizer "N modelo(s) aprovado(s)". O Canal do seed (demo) ficou sem ficha: `configurarCanal` saiu, como o plano manda.
- **Proprietário padrão de Contato do Canal fica só leitura:** o `<behavior>` da Task 2 cita "Proprietário padrão", mas `PATCH /canais/:id` (`EDICAO_DE_CANAL`, `.strict()`) só aceita `nome`, `filaPadraoId` e `origemPadraoId`. Não abri campo novo na api (fora do plano). Como na tela antiga, ele já era só leitura.
- **Navegar para "Conectar um Canal novo" perde um diálogo de criar Lista meio preenchido:** o link sai da tela (D-15-12 não deixa o popup criar). Nas Configurações da Lista não há perda.
- **A carga por Membro agora conta só Conversas abertas da Fila** (`situacao=aberta`, como o plano pede); antes contava todas as ativas, resolvidas inclusive.
- **O selo "cadastrado" aparece em todo Canal** e "demo" não aparece mais; `selo-do-provedor.tsx` não mudou (lê a forma antiga por um adaptador).

### Escolhas do executor

- **Popup com radio e confirmação**, em vez de "um botão por Canal que escolhe de uma vez": o `ConfirmDialog` do projeto exige o botão de confirmar; com a seleção, "fechar sem escolher" é o caso testado e não grava.
- **`tipo?` opcional no popup** (o plano lista só `{ open, onClose, jaLigados, onEscolher }`): a linha "Adicionar WhatsApp" continua mostrando só contas de WhatsApp.
- **Canal arquivado nas Configurações** vem de uma segunda chamada a `useCanais({ estado: "arquivado" })`, para a lista não perder os arquivados que o modelo antigo mostrava.
- **`rehidratar()` mantido** na ficha do Canal depois de cada escrita (o plano só fala em `PATCH`): o fio da Conversa e a Caixa ainda leem o espelho de `GET /estado`.
- **Arquivos fora da lista `files_modified`:** `container-settings.test.tsx` já estava; entraram `conectar-canal.test.tsx`, `conectar-provedor.test.tsx`, `sem-crm-antigo.test.ts`, os dois `CONTEXT.md` (raiz e web) e `.planning/WINDOWS.md`. Nenhum código de produção fora do plano.

**Total deviations:** 1 Rule 3, 1 Rule 2, 1 plano diverge do contrato, 2 linhas abertas em WINDOWS.md. **Impact:** a Caixa configura e conta toda pelo CRM novo; os itens abertos são sobre o que o modelo novo não guarda (modelos de mensagem), um campo que a api não aceita e a navegação para a página de conectar, sem perda de dado.

## WINDOWS.md

Nenhuma linha aberta da Fase 15 era resolvida por este plano (as de id 12 a 19 pertencem a outros planos); deixadas como estavam. Abri os ids 20 e 21 acima.

## Known Stubs

Nenhum. A seção "Mensagens de modelo" da ficha é um estado vazio deliberado (dito no `CONTEXT.md` da web e no id 20 do WINDOWS.md), não um espaço à espera de dado.

## Threat Flags

Nenhum. T-15-33 (edição de Canal sem permissão): a tela só esconde/desliga pelo `usePodeNoCrm` e a api barra (403), como antes; T-15-34 (Canal `conectada` fora da página de conectar): o popup não importa mais a operação antiga nem a HTTP de criar, provado por grep e pelo teste (nenhuma requisição ao abrir, escolher ou fechar).

## Observações para os planos seguintes

1. `requirements.ready-ids` decide o `UCR-05` (vários planos da fase o declaram): ver o fechamento do plano abaixo.
2. O fio da Conversa, a ficha da Conversa (`[conversa]/page.tsx`) e o `iniciar-conversa-dialog.tsx` seguem lendo `state.channels`/`state.conversations` (15-20, 15-24); por isso a ficha do Canal ainda re-hidrata o espelho.
3. 15-33 pode esvaziar o resto de `CONGELADOS`; os seis arquivos deste plano já saíram.

## Self-Check: PASSED

Arquivos criados presentes em disco (`adicionar-canal-dialog.test.tsx`, `configuracoes-da-caixa.test.tsx`); os sete commits do plano (`2dc9068`, `6312b77`, `ee2ad59`, `f4c8206`, `c59d328`, `a286ef0`, `e3a9a1c`) são ancestrais de `HEAD`.
