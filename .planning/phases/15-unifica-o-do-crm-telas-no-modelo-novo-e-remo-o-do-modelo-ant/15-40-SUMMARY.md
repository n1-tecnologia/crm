---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 40
subsystem: estrutura-listas
tags: [lista, espelho-de-negocios, canais, quadro-conversacional, guardas, tdd, ucr-06]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-13: fichas sem recuo (deal-screen so ficava pela Lista); 15-20: o fio novo; 15-26: Meus negocios virou filtro de /crm/negocios e a rota meus-negocios (que importava dealOfTask) foi apagada; 12/15-12: useCanais e plataforma.canais"
provides:
  - "A pagina da Lista (estrutura/listas/[lista]) nao tem a lente espelhoComercial, dealOfTask, a barra Iniciar conversa nem a ficha antiga de Negocio"
  - "Os Canais da Lista conversacional (selo 'Atende por', aviso de Lista sem Canal e recusa de criar Tarefa) vem de useCanais com canaisDaListaNasTabelas/listaSemCanaisNasTabelas"
  - "deal-card.tsx, deal-screen.tsx e iniciar-conversa-dialog.tsx apagados; quadro-negocios.tsx virou features/estrutura/quadro-conversacional.tsx (quadro da Lista conversacional sem o card de Negocio)"
  - "sem-listas-espelho.test.ts (web): CONGELADOS vazio; sem-crm-antigo.test.ts (web): tres arquivos fora de CONGELADOS"
affects: [15-41, 15-33, 15-43]

plan_head_before: 188f9902d4eb99fc4890998f8fa270fa4446292b
plan_head_after: af88c9cc6b6f644f84b20584a8f9fd4591c89905

actuals:
  tokens: 25200
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "o aviso 'sem canais' so e afirmado com a resposta da api na mao: sem resposta (carregando ou falha) a tela nao afirma, e o servidor continua sendo a barreira"
    - "guarda de congelados que chega a zero: a lista vira uma constante vazia e o teste continua proibindo qualquer citacao nova"

key-files:
  created:
    - apps/web/src/features/estrutura/quadro-conversacional.tsx
  modified:
    - "apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx"
    - apps/web/src/features/estrutura/detalhes-da-lista.tsx
    - apps/web/src/features/estrutura/dialogos-da-lista.tsx
    - apps/web/src/features/estrutura/barra-de-criacao.tsx
    - apps/web/src/features/estrutura/pagina-da-lista-visualizacoes.test.tsx
    - apps/web/src/sem-listas-espelho.test.ts
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md
  deleted:
    - apps/web/src/features/estrutura/quadro-negocios.tsx
    - apps/web/src/features/crm/deal-card.tsx
    - apps/web/src/features/crm/deal-screen.tsx
    - apps/web/src/features/crm/iniciar-conversa-dialog.tsx

key-decisions:
  - "quadro-negocios.tsx NAO foi simplesmente apagado: ele era tambem o quadro da Lista conversacional pura (Pos-venda), que desenha o cartao conversacional. Virou quadro-conversacional.tsx (git mv) sem o DealCard, o dealOfTask, o subtotal em dinheiro e a prop comValor. O nome quadro-negocios.tsx nao existe mais, como a acceptance pede"
  - "A lista congelada de sem-listas-espelho.test.ts ficou VAZIA, nao com um 'sentinela que continua existindo': dialogos-da-lista.tsx deixou de citar iniciar-conversa, entao nao ha mais nenhum arquivo congelado; o sentinela do primeiro teste (nova-tarefa-conversacional-dialog.tsx) ja existia e continua"
  - "O lado Estrutura do filtro da Pasta Meus negocios foi mantido (a Lista mostra so Tarefas que nao nascem de Negocio); a Pasta fixa e a protecao A9 sao do 15-41"
  - "Enquanto GET /canais nao respondeu (ou falha), a pagina nao afirma 'sem canais' e nao desliga o Nova Tarefa por falta de Canal; useCanais fica pausado para Lista nao conversacional (nenhuma ida a api nas outras)"

requirements-completed: [UCR-06]

coverage:
  - id: D1
    description: "Lista conversacional sem Canal ativo nas tabelas mostra o aviso e recusa criar Tarefa; com Canal das tabelas nomeia o Canal ('Atende por') e libera o Nova Tarefa, sem olhar o Canal antigo do estado"
    requirement: UCR-06
    verification:
      - { kind: unit, ref: "apps/web/src/features/estrutura/pagina-da-lista-visualizacoes.test.tsx#Página da Lista — os Canais da Lista conversacional vêm das tabelas (15-40, 3.4.5)", status: pass }
    human_judgment: false
  - id: D2
    description: "A pagina da Lista nao monta o espelho de Negocios (sem Iniciar conversa, sem 'valor declarado', sem caminho Negocios > Meus negocios do CRM) para nenhum tipo de Lista"
    requirement: UCR-06
    verification:
      - { kind: unit, ref: "apps/web/src/features/estrutura/pagina-da-lista-visualizacoes.test.tsx#Página da Lista — o espelho de Meus negócios saiu (15-40, F14-D-06)", status: pass }
    human_judgment: false
  - id: D3
    description: "Os quatro componentes do espelho nao existem mais e as guardas D-06 e sem-crm-antigo da web refletem isso (nenhum arquivo cita funilDaLista/iniciar-conversa; tres arquivos fora de CONGELADOS)"
    requirement: UCR-06
    verification:
      - { kind: unit, ref: "apps/web/src/sem-listas-espelho.test.ts", status: pass }
      - { kind: unit, ref: "apps/web/src/sem-crm-antigo.test.ts", status: pass }
      - { kind: other, ref: "test ! -e quadro-negocios.tsx deal-card.tsx iniciar-conversa-dialog.tsx deal-screen.tsx", status: pass }
    human_judgment: false
  - id: D4
    description: "O quadro (Visualizacao Quadro) da Lista conversacional, agora quadro-conversacional.tsx, e as telas de Lista continuam como o dono as conhece, sem o card de Negocio"
    requirement: UCR-06
    verification: []
    human_judgment: true
    rationale: "Aparencia e comportamento do quadro da Lista conversacional (arrastar entre colunas, cartoes com rosto, '+' abre Nova Tarefa) em navegador real nao foram exercitados; so teste de componente e tsc"

duration: 50min
completed: 2026-11-06
---

# Phase 15 Plan 40: Meus negócios, parte 2 (o espelho da Lista sai) Summary

**A página da Lista deixou de montar o espelho de Negócios (lente, quadro de cards de Negócio, «Iniciar conversa» e a ficha antiga), lê os Canais de atendimento da Lista conversacional de `GET /canais` e as guardas D-06 da web chegaram a zero.**

## Performance

- **Duration:** ~50 min (inclui ~22 min do `npm run check` em Docker)
- **Completed:** 2026-11-06
- **Tasks:** 2 (Task 1 tracer, Task 2 auto; ambas TDD)
- **Commits:** 4 (2 RED `test(...)`, 2 `feat(...)`)
- **Files:** 4 apagados (um por renomeação), 1 criado por renomeação, 8 alterados

## Accomplishments

- `estrutura/listas/[lista]/page.tsx` sem `espelhoComercial`, `dealOfTask`, `etapaDoStatus`, `noCrm`, `iniciandoConversa`, `negocioAberto`, o caminho «Negócios › Meus negócios» do CRM, a maleta no ícone e o meta «N abertos · R$ em valor declarado». A Lista é conversacional ou não, financeira ou não; nada mais.
- `useCanais({ limite: 200 }, { pausado: não conversacional })` alimenta `listaSemCanaisNasTabelas` (recusa de criar Tarefa e aviso) e `DetalhesDaLista` (`canaisDaListaNasTabelas`, pílulas com `nome`/`tipo`/`identificadorExterno`). O Canal projetado no estado antigo deixou de contar.
- `dialogos-da-lista.tsx` perdeu `IniciarConversaDialog` e `DealScreen` (e as props `espelhoComercial`, `iniciandoConversa`, `negocioAberto`, `caminho`); `barra-de-criacao.tsx` perdeu a lente e o botão «Iniciar conversa».
- Apagados `deal-card.tsx` (119 linhas), `deal-screen.tsx` (968) e `iniciar-conversa-dialog.tsx` (219); `quadro-negocios.tsx` renomeado para `quadro-conversacional.tsx` (ver desvio 1).
- `sem-listas-espelho.test.ts`: `CONGELADOS` vazio (nenhum arquivo da web cita `funilDaLista`/`iniciar-conversa`); `sem-crm-antigo.test.ts`: `deal-card`, `deal-screen` e `iniciar-conversa-dialog` saíram de `CONGELADOS`. `apps/web/CONTEXT.md` registra o corte.

## Task Commits

1. **Task 1 (tracer): a página da Lista lê os Canais das tabelas e sai do espelho**
   - RED `51b0b26` (`test`): 3 casos novos falham nas asserções-alvo (aviso ausente porque o estado antigo ainda enxergava `chn_wpp`; «Atende por» ausente com Canal só das tabelas; botão «Iniciar conversa» presente sob `/crm/`).
   - GREEN `cf38fc0` (`feat`).
2. **Task 2: os componentes saem, a barra perde o perfil, guardas atualizadas**
   - RED `6c6e67e` (`test`): com os três arquivos ainda no disco, `sem-crm-antigo` e `sem-listas-espelho` falham nomeando `deal-card`, `deal-screen` e `iniciar-conversa-dialog`.
   - GREEN `af88c9c` (`feat`).

**Plan metadata:** commit `docs(15-40)` seguinte a este arquivo.

## TDD Gate Compliance

RED antes de GREEN nas duas tarefas (`test(15-40)` precede `feat(15-40)` no `git log`). Sem REFACTOR. O RED foi inspecionado à mão (não passou pelo classificador de relatório): o alvo rodou e falhou na asserção planejada, não em import/sintaxe. Duas asserções do próprio teste novo foram corrigidas no commit GREEN `cf38fc0` (8 linhas): `getByText` do aviso virou `getAllByText` (o aviso aparece também como motivo do botão desligado) e a checagem do caminho passou de `link «Meus negócios»` (a Pasta continua no caminho da Estrutura) para «nenhum link `/crm/negocios`».

## Verification

- `npx vitest run src/features/estrutura/pagina-da-lista-visualizacoes.test.tsx`: 14/14. `npx tsc --noEmit` (web): limpo. `eslint .` (web): 0 erros (2 avisos antigos fora do plano).
- Aceitação: `grep -c dealOfTask page.tsx` = 0; `grep -c NasTabelas detalhes-da-lista.tsx` = 2; `test ! -e` nos quatro arquivos sai 0; `grep -c espelhoComercial barra-de-criacao.tsx` = 0.
- Suíte web completa (`vitest run --maxWorkers=3 --testTimeout=30000`): 132 arquivos, 1298/1298 testes.
- `npm run check` em Postgres Docker local (`crm-n1-pg-1540`, porta 55740, 001–012 aplicadas, as duas URLs explícitas): typecheck dos três workspaces, lint, `verificar:tokens`, `verificar:contratos` passaram; testes da api **187 arquivos / 2285 testes passaram**, do domínio **128 / 2456 passaram**, da web **117 arquivos passaram e 15 falharam com 59 testes**, TODOS por `Test timed out in 5000ms` (56) ou por efeito dele em `arvore-arrastavel`/`arvore-menu` (2 asserções) com as 3 suítes rodando em série e a máquina cheia. Os mesmos 15 arquivos, rodados depois isoladamente com o timeout padrão de 5 s, passam: `arvore-arrastavel` 18/18, `arvore-menu` 20/20, `mover-conteiner-dialog` 23/23, `auditoria-do-crm` 5/5, `ficha-de-contato` 27/27, `quadro-do-funil` 20/20, `inicio-no-crm-novo` 13/13, e os quatro restantes (`tarefa-completa-gestos`, `tarefa-completa-resumo`, `tarefa-salvando`, `formulario`) 45/45. Nenhum desses arquivos importa o que o plano apagou. O sinal é carga (disco a 98%, ~5 GiB livres), não regressão; mesmo assim o `npm run check` literal NÃO saiu 0 nesta máquina, e a evidência de que passa é a suíte web completa com `--maxWorkers=3 --testTimeout=30000`.
- Contêiner `crm-n1-pg-1540` parado ao fim; nenhum `.next`/build criado; nada tocado em `supabase_*_rede-social*`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `quadro-negocios.tsx` era também o quadro da Lista conversacional pura**
- **Found during:** Task 1 (leitura de `page.tsx`, ramo `view === "quadro" && conversacional`)
- **Issue:** o plano manda apagar `QuadroNegocios`, mas o arquivo desenha o quadro de cartões com rosto da Lista conversacional (Pós-venda), não só o card de Negócio do espelho. Apagá-lo sem substituto tiraria a Visualização Quadro dessas Listas (ou a faria cair no quadro de Tarefas comum, sem os cartões conversacionais).
- **Fix:** `git mv quadro-negocios.tsx quadro-conversacional.tsx`; `QuadroConversacional` sem `DealCard`, `dealOfTask`, `negocioDaTarefa`, a prop `comValor` e o subtotal em dinheiro. O nome `QuadroNegocios` e o arquivo `quadro-negocios.tsx` não existem mais (acceptance cumprida). Comentários de `crm/negocios/page.tsx` e `quadro-do-funil.tsx` que citavam o arquivo apontam para o novo.
- **Files modified:** `quadro-conversacional.tsx`, `page.tsx`, `negocios/page.tsx`, `quadro-do-funil.tsx`
- **Commit:** `cf38fc0`, `af88c9c`
- **Registrado em:** WINDOWS.md (linha da Fase 15, 15-40).

**2. [Rule 1 - Bug de redação do plano] «lista congelada perde os dois arquivos apagados e o sentinela passa a ser um que continua existindo»**
- **Issue:** `dialogos-da-lista.tsx` não foi apagado; ele só deixou de citar `iniciar-conversa`. A lista fica vazia, não com um arquivo-sentinela; o sentinela de leitura do primeiro teste (`nova-tarefa-conversacional-dialog.tsx`) já existia.
- **Fix:** `CONGELADOS: readonly string[] = []`, comentário do cabeçalho atualizado, nome do caso mudado. A guarda continua barrando qualquer citação nova.
- **Commit:** `6c6e67e`

**3. [Rule 2 - Cobertura] `espelhoComercial` ainda aparecia na página como ramo morto**
- **Issue:** o 15-26 já tornara o ramo inalcançável (`noCrm` sempre falso na página da Estrutura), mas ele carregava `Briefcase`, `fmt.money`, `isTerminalCategory`/`statusCategory`, `criacaoRecusada` por `pathname.startsWith("/crm/")` e o `etapaDoStatus`. Tudo removido junto, e o filtro da Pasta `Meus negócios` foi reescrito sem `noCrm` (`task.provenance?.kind !== "deal"`, equivalente ao de antes com `noCrm=false`).
- **Commit:** `cf38fc0`

**Total deviations:** 3 (1 bloqueio, 1 redação do plano, 1 limpeza obrigatória). **Impact:** nenhuma funcionalidade fora do espelho foi tirada; o plano tinha o nome `QuadroNegocios` onde o conteúdo era maior que o espelho.

## Known Stubs

Nenhum stub novo. Em produção o aviso/linha «Atende por» e a recusa por falta de Canal dependem de `Lista.canaisDeAtendimento` apontar para ids que existem em `plataforma.canais` (ver WINDOWS.md).

## Threat Flags

Nenhum. T-15-94 (volta de um caminho que cria Negócio/Conversa no modelo antigo pela Lista) mitigado: os componentes foram apagados e as duas guardas atualizadas na mesma mudança falham se alguém voltar a citá-los.

## Issues Encountered

- O `git add` com um caminho inexistente (`quadro-negocios.tsx` já renomeado) abortou o stage inteiro e o commit seguinte levou só a renomeação pura; corrigido na hora com `git commit --amend` (commit local, ainda não publicado) antes de qualquer outro passo.
- `npm run check` literal não saiu 0 por timeouts de 5 s na web sob carga (ver Verification). Não é o baseline conhecido (`colunas-geradas`, `outbox-worker`), que nesta rodada passou.

## Windows (WINDOWS.md)

- Aberta: linha `deviation` da Fase 15, 15-40 (Canal só afirmado com a resposta de `GET /canais`; ids de Canal antigo em `canaisDeAtendimento`; quadro conversacional mantido em vez de apagado).
- Nenhuma linha existente resolvida por este plano (as linhas 44/45, de 15-26, continuam abertas; a protecao A9 e a Pasta fixa sao do 15-41).

## Next Phase Readiness

Pronto para o 15-41 (Pasta fixa e proteções A9). O espelho da Lista saiu por inteiro da web; restam no modelo antigo Grupo e Flow (Sessões 6 e 7).

## Self-Check: PASSED
