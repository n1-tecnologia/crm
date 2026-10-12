---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 10
subsystem: inbox-channels-web
tags: [web, conversation-thread, omnichannel, abas-por-canal, responder-por, vitest, jsdom]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "capacidadesDoCanal (08-02); canaisDoFio, canalPadraoDeResposta, canalDaAbaInicial, canalPadraoDoTipo, marcadoresDeCanal, rotuloDoCanal, textoDoSeparadorDeCanal (08-05); SeloDoProvedor, MarcaDeConexaoSimulada (08-01)"
provides:
  - "SeletorDeCanalDeResposta (\"Responder por\") e SeparadorDeCanal (\"via ...\")"
  - "ConversationThread com a aba por Canal (props canalSelecionado: Id | null, onCanalChange(channelId))"
  - "ContactQuickActions.onCanal(channelId) resolvido por canalPadraoDoTipo"
  - "primeiro teste de componente do fio (conversation-thread.test.tsx)"
affects: [08-11, 08-12, 08-15]

actuals:
  tokens: 12000
  tasks: 3
  commits: 3
plan_head_before: e3c61e71121bb017afa944431122fdb8d19c4326
plan_head_after: 739c52005a75f121ff45b57eb17809e429b680fa

tech-stack:
  added: []
  patterns:
    - "A tela so desenha: abas, padrao de resposta, separador e rotulo vem de derive-conversacional"
    - "Trocar de Canal = startConversation (reutiliza ou abre); nenhuma Conversa muda de channelId"
    - "Sonda de useData + useEffect para o teste ler o estado vivo do store"

key-files:
  created:
    - apps/web/src/features/crm/seletor-de-canal.tsx
    - apps/web/src/features/crm/separador-de-canal.tsx
    - apps/web/src/features/crm/conversation-thread.test.tsx
  modified:
    - apps/web/src/features/crm/conversation-thread.tsx
    - apps/web/src/features/crm/contact-card.tsx
    - apps/web/src/features/crm/deal-screen.tsx
    - apps/web/src/features/crm/legado/ficha-de-contato-legado.tsx
    - apps/web/src/features/crm/legado/ficha-de-empresa-legado.tsx
    - apps/web/src/features/estrutura/tarefa-completa.tsx
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx

key-decisions:
  - "A aba ativa e canalSelecionado ?? canalAtivo ?? canalPadraoDeResposta ?? canalDaAbaInicial: o fio abre no Canal da ultima recebida."
  - "Sem 'Todas': o separador 'via ...' existe e e ligado a renderizacao, mas numa aba por Canal a sequencia e de um Canal so e ele nao aparece (Open Question 2 sinalizada para o dono)."
  - "A barra da regra do Canal virou div flex (icone + nome + SeloDoProvedor + MarcaDeConexaoSimulada + regra de janela) em vez de um <p> de texto corrido, porque os selos sao Pilulas."
  - "ContactQuickActions distingue 'Este Contato nao tem WhatsApp/e-mail.' (sem Identificador ou sem onCanal) de 'Nenhum Canal de WhatsApp/e-mail ativo alcanca este Contato.' (tem Identificador, mas nenhum Canal conectado serve)."
  - "O Canal desconectado que o Contato alcanca continua com aba (habilitada) mas nao e opcao do 'Responder por'."

requirements-completed: [CXE-W2]

coverage:
  - id: D1
    description: "Abas do fio por Canal (dois WhatsApps = duas abas), aba de Canal sem Identificador desligada dizendo o que falta, aba inicial no Canal da ultima recebida"
    requirement: CXE-W2
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(1) uma aba por Canal ativo"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(2) abre na aba do Canal da ultima recebida"
        status: pass
    human_judgment: false
  - id: D2
    description: "'Responder por': padrao = Canal da ultima recebida, opcoes so de Canais conectados que alcancam o Contato; trocar abre/reutiliza a Conversa sem mudar channelId de nenhuma existente (INV-CXE-04)"
    requirement: CXE-W2
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(3) o Responder por vale o Canal da ultima recebida"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(4) trocar o Responder por muda a aba"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mensagem sai pelo Canal da aba, nunca pelo primeiro Canal ativo do tipo (T-08-41)"
    requirement: CXE-W2
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(6) a Mensagem sai pelo Canal da aba"
        status: pass
    human_judgment: false
  - id: D4
    description: "Barra da regra do Canal (icone + nome + selo do provedor + conexao simulada) e separador 'via ...' ligado a renderizacao das Mensagens"
    requirement: CXE-W2
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(2) abre na aba do Canal da ultima recebida"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(5) nenhum separador via numa aba de um Canal so"
        status: pass
    human_judgment: true
    rationale: "O desenho (barra com selos, separador, 'Responder por' no topo do compositor, abas com rotulo longo 'Nome · Provedor') e uma leitura visual que nenhum teste de jsdom julga; vai para a UAT de fim de fase. O separador 'via ...' nao tem prova positiva porque nenhuma tela mistura Canais hoje."
  - id: D5
    description: "Todos os chamadores (Caixa de Entrada, Negocio, ficha legada de Contato e de Empresa, Tarefa conversacional) controlam a aba por id de Canal; acoes rapidas levam ao Canal padrao do tipo"
    requirement: CXE-W2
    verification:
      - kind: integration
        ref: "npm run typecheck (3 workspaces) + vitest run apps/web (59 arquivos, 542 testes)"
        status: pass
    human_judgment: true
    rationale: "Os atalhos WhatsApp/E-mail das fichas levando a aba certa com dois WhatsApps nao tem teste de tela; conferir na UAT de fim de fase."
---

# Phase 8 Plan 10: Fio da Conversa por Canal Summary

**`ConversationThread` passa de chave por tipo para chave por Canal: uma aba por Canal ativo do Espaço (dois WhatsApps = duas abas), aba inicial e "Responder por" no Canal da última recebida, barra do topo com ícone + nome + selo do provedor + conexão simulada, separador "via …" ligado às Mensagens, e envio sempre pelo id do Canal da aba.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-10-12T18:15Z
- **Tasks:** 3
- **Files modified:** 10 (3 criados, 7 alterados)

## Accomplishments

- `SeletorDeCanalDeResposta` ("Responder por", `Field` + `Select size="sm"`, opções de `canaisDeResposta` com `rotuloDoCanal`; sem opção, desabilitado com "Nenhum Canal conectado alcança este Contato.") e `SeparadorDeCanal` (`role="separator"`, `textoDoSeparadorDeCanal`, ícone do tipo, filetes `var(--linha)`).
- `ConversationThread`: removidos `CHANNEL_OF_IDENTIFIER`, `ORDEM_DOS_CANAIS`, `channelsOf` e `canalAtivoId`; abas iteram `canaisDoFio` (contador por `channelId`, aba desligada com o motivo "Este Contato não tem <Identificador>."); a Conversa da aba é a do Canal, nunca a de outro do mesmo tipo; `capacidadesDoCanal` lê o Canal da aba; `abrirAtendimento`, título do `ConfirmDialog` e "Nenhuma Conversa em …" usam `canal.id`/`rotuloDoCanal`.
- Trocar "Responder por" chama `startConversation` (reutiliza ou abre), muda a aba, limpa rascunho adotado e avisa "Respondendo por <Canal>."; em falha mostra a frase do domínio.
- Tarefa conversacional por Canal: filtro de Lista e criação comparam `ch.id === canal?.id`; recusa "Esta Lista não atende por “<nome>”.".
- Chamadores (`[conversa]/page.tsx`, `deal-screen.tsx`, fichas legadas, `tarefa-completa.tsx`) controlam a aba por `Id`; `temCanal` das fichas legadas vem de `canaisDoFio(...).some(alcancavel)`; `ContactQuickActions.onCanal(channelId)` resolve por `canalPadraoDoTipo`, com as frases "Nenhum Canal de WhatsApp/e-mail ativo alcança este Contato.".
- `git grep channelsOf|ORDEM_DOS_CANAIS` em `apps/web/src` vazio; `CHANNEL_ICON` segue exportado igual.

## Task Commits

1. **Task 1: componentes "Responder por" e separador** - `c86c045` (feat)
2. **Task 2: ConversationThread por Canal e chamadores** - `37eada4` (feat)
3. **Task 3: fio provado com dois WhatsApps** - `739c520` (test)

**Plan metadata:** commit `docs(08-10)` seguinte a este arquivo.

## TDD Gate Compliance

A Task 3 é `tdd="true`, mas o plano ordena o teste DEPOIS do componente (Task 2 reescreve o `ConversationThread`; a Task 3 é "a rede"). O RED honesto não existia: os 5 dos 6 testes passaram de primeira contra o componente já pronto (o 6º falhou só por eu ter buscado `role="dialog"` em vez de `alertdialog`, erro do teste). Não fabriquei RED; provei que os testes não são vácuos com mutações temporárias no componente, restauradas por `git checkout -- <arquivo>` antes do commit (nada da mutação foi commitado):

- Mutação A (remover `canalPadraoDeResposta` da escolha da aba): falham (2), (3) e (6).
- Mutação B (Conversa da aba por tipo de Canal em vez de por id): falham (2), (4) e (6).
- O teste (5) (nenhum separador "via …") só tem prova negativa: nenhuma tela mistura Canais hoje, então não há mutação razoável que o faça falhar sem inventar a aba "Todas".

Há um único commit `test(08-10)` (sem `feat` posterior): o `feat` do componente é o commit da Task 2, anterior. Sem etapa REFACTOR.

## Files Created/Modified

- `apps/web/src/features/crm/seletor-de-canal.tsx` - "Responder por"
- `apps/web/src/features/crm/separador-de-canal.tsx` - separador "via …"
- `apps/web/src/features/crm/conversation-thread.tsx` - o fio por Canal
- `apps/web/src/features/crm/conversation-thread.test.tsx` - 6 testes (jsdom, `StoreProvider` real + `transporteEmMemoria`)
- `apps/web/src/features/crm/contact-card.tsx` - `ContactQuickActions.onCanal(channelId)`
- `apps/web/src/features/crm/deal-screen.tsx`, `legado/ficha-de-contato-legado.tsx`, `legado/ficha-de-empresa-legado.tsx`, `estrutura/tarefa-completa.tsx`, `app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx` - chamadores por `Id`

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: aba ativa pelo Canal da última recebida; barra da regra virou `div` com selos; as ações rápidas distinguem "sem Identificador" de "sem Canal conectado"; Canal desconectado alcançável mantém aba mas não é opção de resposta.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste lia uma variável de módulo reatribuída durante a renderização**
- **Found during:** Task 3 (eslint `react-hooks/globals`)
- **Issue:** a sonda do teste atribuía `dadosDoStore` dentro do corpo do componente.
- **Fix:** a sonda grava num objeto em `useEffect`, lido por `dadosDoStore()`.
- **Files modified:** `conversation-thread.test.tsx`
- **Committed in:** `739c520`

### Acréscimos dentro do escopo

- Um 6º teste (envio pelo Canal da aba, com o diálogo de confirmação dizendo o Canal) cobre a proibição "o fio nunca envia pelo primeiro Canal ativo do tipo" (T-08-41), que o plano marcava `verification: test` mas não listava como comportamento.

**Total deviations:** 1 auto-fixed (Rule 1). **Impact:** nenhum no escopo.

## Issues Encountered

None.

## Known Stubs

None.

## Open Questions para o dono

- **Aba "Todas" (Open Question 2):** uma aba com as Conversas do Contato misturadas — onde o separador "via …" de fato apareceria — não existe e não foi inventada. A pergunta deve ir para `08-PROVAS.md` (ainda inexistente; plano 08-15). Hoje o separador está ligado à renderização mas nunca aparece.

## Threat Flags

None. `dangerouslySetInnerHTML` não é usado; `content`, `subject` e `name` seguem como texto React (T-08-39); a troca de Canal só chama `startConversation` (T-08-40, provado no teste 4); a aba e o compositor usam o id do Canal (T-08-41, teste 6).

## Verificação

- `npm run typecheck` (api, web, dominio): verde.
- eslint nos arquivos tocados: verde.
- `npm run verificar:tokens -w @n1/web`: 0 falhas.
- `vitest run` de `@n1/web`: 59 arquivos, 542 testes passando (6 novos).

## Next Phase Readiness

Fio por Canal pronto para a UAT de fim de fase (itens `human_judgment`: desenho da barra/abas/"Responder por" e atalhos WhatsApp/E-mail com dois WhatsApps). Nada bloqueia 08-11.

## Self-Check: PASSED

- Criados: `seletor-de-canal.tsx`, `separador-de-canal.tsx`, `conversation-thread.test.tsx` existem.
- Commits `c86c045`, `37eada4`, `739c520` presentes em `main`; `git rev-list --count` desde `plan_head_before` = 3.

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*
