---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 07
subsystem: web-crm
tags: [next, react, swr, vitest, funis, etapas, d-07, d-13, d-14]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-04: as rotas REST de Funil e Etapa (padrao, ordem, remapear, migrar-negocios) e os 409 com bloqueios; 07-06: AbasDeEstado, AcoesDeCicloDeVida, MensagemDeRecusa (com acao), usePodeNoCrm e o molde de dados/crm/contatos.ts"
provides:
  - "dados/crm/funis.ts: chaveDeFunis, useFunis (com pausado), chaveDoFunil, useFunil e as 13 mutacoes de Funil/Etapa; remapear e migrar invalidam /funis e /negocios"
  - "features/crm/formulario-de-funil.tsx: DialogoNovoFunil, montarNovoFunil, InterruptorRotulado (Toggle com rotulo) e CORES_DE_FUNIL (tokens)"
  - "features/crm/etapas-do-funil.tsx: EtapasDoFunil (renomear e probabilidade no lugar, subir/descer com a permutacao inteira, remover, adicionar)"
  - "features/crm/ficha-de-funil.tsx: FichaDeFunil (padrao, ciclo de vida, Regras de encerramento, leitura para quem nao administra)"
  - "RemoveStageDialog e MigrateFunnelDialog sobre POST /etapas/:id/remapear e POST /funis/:id/migrar-negocios, com os mesmos hooks e parametros de URL"
  - "/crm/funis (abas, Funil padrao marcado, Novo Funil) e /crm/funis/[funil] pela api, com 404 que explica o Funil do cadastro anterior"
affects: [07-08, 07-09, 07-10, 07-11, 07-12, 07-13]

actuals:
  tokens: 33900
  tasks: 3
  commits: 6
plan_head_before: 6fc81b5435cbc3ed69ad26a77fb66a74c9d5b51d
plan_head_after: fa3f495e8088e3cccb982ec716a2a088c26d0bf9
commits: 6

tech-stack:
  added: []
  patterns:
    - "Mutacao = gravar(caminho, verbo, corpo, tambemInvalida?): chamarCrm -> invalidarCrm('/funis') (+ '/negocios' quando Negocios mudam de Etapa/Funil) -> dados; a recusa sobe como ErroDeApi e nada invalida"
    - "Dialogo de D-07 fechado nao le a api: useFunil(undefined) e useFunis({pausado}) usam chave nula"
    - "Mapeamento de migracao = sugestao derivada (mesmo nome sem caixa, senao Etapa inicial) + trocas da pessoa por cima; sem efeito, sem estado duplicado"
    - "agir(acao, sucesso, tratar?): tratar assume a recusa que pertence a um campo (FUNIL_NOME_EM_USO) e o resto vai para MensagemDeRecusa"

key-files:
  created:
    - apps/web/src/dados/crm/funis.ts
    - apps/web/src/dados/crm/funis.test.ts
    - apps/web/src/features/crm/formulario-de-funil.tsx
    - apps/web/src/features/crm/formulario-de-funil.test.tsx
    - apps/web/src/features/crm/etapas-do-funil.tsx
    - apps/web/src/features/crm/ficha-de-funil.tsx
    - apps/web/src/features/crm/ficha-de-funil.test.tsx
    - apps/web/src/features/crm/dialogos-de-funil.test.tsx
  modified:
    - "apps/web/src/app/(shell)/crm/funis/page.tsx"
    - "apps/web/src/app/(shell)/crm/funis/[funil]/page.tsx"
    - apps/web/src/features/crm/remove-stage-dialog.tsx
    - apps/web/src/features/crm/migrate-funnel-dialog.tsx

key-decisions:
  - "A lista de Funis segue o UI-SPEC e nao o plano: Nome carrega as Pilulas 'Funil padrao' e 'Privado'; colunas Etapas, Negocios abertos (some em tela estreita) e Estado. O plano listava Padrao e Privado como colunas a parte"
  - "Migrar Negocios perdeu o Select de escopo (abertos/todos) do dialogo antigo: a rota /migrar-negocios move todos os Negocios do Funil. O dialogo mostra os totais do Funil inteiro"
  - "O destino da migracao e o mapeamento nascem sugeridos (Etapa de mesmo nome sem caixa, senao a inicial do destino, via chaveDeNome/etapaInicial) e a pessoa troca; so as Etapas de origem COM Negocios entram no corpo (T-07-25)"
  - "Remover Etapa sem Negocios chama DELETE direto (com Toast); com Negocios abre ?remapear-etapa=. Se a api recusar por corrida (ETAPA_COM_NEGOCIOS), a recusa traz o botao 'Remapear Negocios'"
  - "A ficha mostra a probabilidade como texto 'Probabilidade padrao N%' para quem le e como campo numerico no lugar do numero para quem edita; nome e probabilidade gravam ao sair do campo (blur/Enter) depois de validarNomeDeEtapa/validarProbabilidadeDeEtapa"
  - "Sem permissao ou com o Funil fora de ativo, os botoes de escrita ficam desabilitados com o motivo (a frase de podeNoCrm ou 'Restaure o Funil antes de editar.'), nunca somem; a linha 'So Administrador e Proprietario alteram Funis e Etapas.' vai em details sob o PageHeader"
  - "Cor do Funil e um Select de tokens (neutra, azul, verde, amarela, vermelha, roxa) gravados como var(--...): a verificacao de tokens proibe hex no TSX"
  - "Plural real nas mensagens de contagem ('1 Negocio', '3 Negocios', '4 Negocios remapeados') em vez do 'N Negocio(s)' dos planos, como o UI-SPEC manda"

patterns-established:
  - "Dialogo de URL (?parametro=) que le a ficha pela api so enquanto aberto"
  - "InterruptorRotulado: Toggle com rotulo visivel e nota ligada por aria-describedby"

requirements-completed: [CRM-W1]

coverage:
  - id: D1
    description: "Mutacoes de Funil e Etapa por HTTP, com a rota certa por funcao e a invalidacao de /funis (e /negocios em remapear e migrar) so no sucesso"
    requirement: CRM-W1
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/funis.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lista /crm/funis pela api (abas, Funil padrao, Lixeira) e o dialogo Novo Funil com Etapas e pre-validacao do dominio"
    requirement: CRM-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/formulario-de-funil.test.tsx"
        status: pass
    human_judgment: true
    rationale: "A pagina de lista (abas, Pilulas, Lixeira com Restaurar/Excluir permanentemente, Mostrar mais) so foi conferida por tipos e lint; layout e leitura da tabela pedem olho humano"
  - id: D3
    description: "Ficha de Funil com editor de Etapas, Regras de encerramento, Definir como padrao, ciclo de vida e leitura para quem nao administra"
    requirement: CRM-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/ficha-de-funil.test.tsx"
        status: pass
    human_judgment: true
    rationale: "O comportamento esta provado nos 17 casos, mas o layout Etapas a esquerda / atributos a direita, a edicao no lugar e o estado desabilitado com motivo sao de adequacao visual (UI-SPEC 3 e 9)"
  - id: D4
    description: "RemoveStageDialog e MigrateFunnelDialog religados a POST /etapas/:id/remapear e POST /funis/:id/migrar-negocios, com as mesmas URLs, contagens, mapeamento sugerido e recusa no dialogo"
    requirement: CRM-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/dialogos-de-funil.test.tsx"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-10-10
status: complete
---

# Phase 7 Plan 07: Funis e Etapas no web Summary

**Funis e Etapas religados ao backend: lista com o Funil padrao marcado, Novo Funil com Etapas, ficha com editor de Etapas e Regras de encerramento, e os dialogos de remapear Etapa e migrar Negocios (D-07) sobre `POST /etapas/:id/remapear` e `POST /funis/:id/migrar-negocios`, tudo so por HTTP.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-10T03:13:00Z (aproximado, a partir do primeiro commit)
- **Completed:** 2026-10-10T03:34:00Z
- **Tasks:** 3 (todas `tdd="true"`: RED -> GREEN, sem REFACTOR)
- **Files modified:** 12 (8 criados, 4 reescritos)

## Accomplishments

- `dados/crm/funis.ts` cobre as 13 mutacoes e as leituras; remapear e migrar tambem invalidam `/negocios`, porque os Negocios mudaram de lugar.
- A lista `/crm/funis` deixou de ler `state.funnels`: abas Ativos/Arquivados/Lixeira, Pilula "Funil padrao" e "Privado" no Nome, "Novo Funil" so para quem pode (D-14), Restaurar e Excluir permanentemente na Lixeira com a recusa visivel.
- `DialogoNovoFunil` pre-valida com `validarNovoFunil`, avisa que o primeiro Funil vira o padrao (D-13) e leva `FUNIL_NOME_EM_USO` ao campo Nome sem fechar o dialogo.
- A ficha configura Etapas (nome e probabilidade no lugar, subir/descer enviando a permutacao inteira, adicionar com posicao, remover) e as duas Regras de encerramento; Requisitos e Transicoes nao aparecem (D-02).
- D-07 de ponta a ponta: excluir/arquivar um Funil com Negocios mostra a contagem e o botao "Migrar Negocios" que abre `?migrar-negocios=`; remover uma Etapa com Negocios abre `?remapear-etapa=`.
- Para Membro e Convidado a ficha continua legivel e nenhum botao de escrita fica habilitado, com a frase de `podeNoCrm` como motivo (D-14).

## Task Commits

1. **Task 1: Mutacoes de Funil, lista com o padrao e formulario Novo Funil** - RED `cacbe91` (test) -> GREEN `3087e1b` (feat)
2. **Task 2: Ficha de Funil com o editor de Etapas e as Regras de encerramento** - RED `adf7a48` (test) -> GREEN `eab3e39` (feat)
3. **Task 3: Dialogos de remapear Etapa e migrar Negocios sobre a api (D-07)** - RED `353bb79` (test) -> GREEN `fa3f495` (feat)

**Plan metadata:** commit `docs(07-07)` seguinte a este SUMMARY (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `apps/web/src/dados/crm/funis.ts` - leituras e mutacoes de Funil/Etapa sobre `chamarCrm`
- `apps/web/src/dados/crm/funis.test.ts` - rota certa, corpo, invalidacao e recusa (11 casos)
- `apps/web/src/features/crm/formulario-de-funil.tsx` / `.test.tsx` - `DialogoNovoFunil`, `montarNovoFunil`, `InterruptorRotulado`
- `apps/web/src/features/crm/etapas-do-funil.tsx` - editor de Etapas
- `apps/web/src/features/crm/ficha-de-funil.tsx` / `.test.tsx` - `FichaDeFunil` e 17 casos
- `apps/web/src/features/crm/remove-stage-dialog.tsx`, `migrate-funnel-dialog.tsx` - religados; `dialogos-de-funil.test.tsx` com 9 casos
- `apps/web/src/app/(shell)/crm/funis/page.tsx`, `[funil]/page.tsx` - lista e ficha pela api

## Decisions Made

Ver `key-decisions` no cabecalho. As que mais pesam para os proximos planos: o `InterruptorRotulado` e o `agir(acao, sucesso, tratar?)` servem Empresas e Negocios; o mapeamento sugerido da migracao nao precisa de efeito; `useFunis(filtro, { pausado })` e o jeito de um seletor de Funil ler a api so quando aberto (o quadro de 07-10 usa `useFunis({ estado: "ativo" })`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Lista de Funis conforme o UI-SPEC, nao o plano**
- **Found during:** Task 1
- **Issue:** o plano pedia colunas Nome, Etapas, Padrao, Privado, Negocios abertos, Estado; o UI-SPEC (binding) pede Nome com as Pilulas "Funil padrao" e "Privado" e a coluna de Negocios abertos recolhivel em tela estreita.
- **Fix:** colunas do UI-SPEC.
- **Files modified:** `apps/web/src/app/(shell)/crm/funis/page.tsx`
- **Committed in:** 3087e1b

**2. [Rule 1 - Bug] Escopo "so os abertos" do dialogo de migracao nao existe na api**
- **Found during:** Task 3
- **Issue:** o dialogo antigo oferecia migrar so os abertos ou todos; `POST /funis/:id/migrar-negocios` move todos os Negocios do Funil. Manter o Select mentiria sobre o que a rota faz.
- **Fix:** o Select saiu; o painel mostra os totais do Funil inteiro (abertos, ganhos, perdidos, arquivados, na Lixeira).
- **Files modified:** `apps/web/src/features/crm/migrate-funnel-dialog.tsx`
- **Committed in:** fa3f495

**3. [Rule 2 - Missing critical] Contagem sem plural e texto de "Requisitos" nos dialogos**
- **Found during:** Task 3
- **Issue:** "N Negocio(s)" nos dialogos e a nota "O remapeamento nao avalia exigencias de entrada" mencionavam o que a 007 nao guarda (D-02); a nota de probabilidade ajustada dependia de uma contagem que a api nao devolve.
- **Fix:** plural real ("1 Negocio", "4 Negocios remapeados") e nota unica "A probabilidade ajustada a mao de cada Negocio e preservada."
- **Files modified:** `remove-stage-dialog.tsx`, `migrate-funnel-dialog.tsx`
- **Committed in:** fa3f495

**4. [Rule 2 - Missing critical] Teste do dialogo Novo Funil e opcao `pausado` em useFunis**
- **Found during:** Task 1 e Task 3
- **Issue:** a pre-validacao e o 409 inline do Novo Funil nao tinham teste no plano; e um dialogo fechado na ficha disparava `GET /funis` a toa.
- **Fix:** `formulario-de-funil.test.tsx` (6 casos, fora da lista de arquivos do plano) e `useFunis(filtro, { pausado })`.
- **Files modified:** `apps/web/src/features/crm/formulario-de-funil.test.tsx`, `apps/web/src/dados/crm/funis.ts`
- **Committed in:** 3087e1b, fa3f495

**5. [Rule 3 - Blocking] A ficha monta os dialogos antes de a Task 3 renomear as props**
- **Found during:** Task 2
- **Issue:** `FichaDeFunil` (Task 2) monta `RemoveStageDialog`/`MigrateFunnelDialog`, cujas props novas (`funilId`, `etapaId`) sao da Task 3. Entre `eab3e39` e `353bb79` a ficha montava os dialogos com as props antigas (`funnelId`, `stageId`), ainda sobre o modelo antigo, so para o tipo compilar; o RED da Task 3 trocou os nomes na ficha junto com os esqueletos.
- **Fix:** `ficha-de-funil.tsx` entrou no commit RED da Task 3 (`353bb79`), alem dos arquivos que a Task 3 lista.
- **Files modified:** `apps/web/src/features/crm/ficha-de-funil.tsx`
- **Committed in:** 353bb79

---

**Total deviations:** 5 auto-fixed (1 bug, 3 missing critical, 1 blocking)
**Impact on plan:** nenhuma muda o contrato; todas aproximam a tela do UI-SPEC e do que a api faz de fato. Nao ha escopo novo alem de um arquivo de teste.

## Issues Encountered

- **Evidencia de RED.** Como em 07-02/07-03/07-06, a pagina inteira de falhas de uma suite de componentes nao serve ao classificador; cada fase usou um alvo cuja falha e uma asserção de uma linha, rodado com `-t`: Task 1 "(a) criarFunil manda POST..." (fetch 0 vezes), Task 2 "(a) lista as Etapas na ordem..." e Task 3 "(a) mostra as contagens da Etapa..." (ambos com `vi.waitFor` sobre `textContent`, `expected '' to contain ...`). Os tres deram `RED_EVIDENCE_OK` com `format: tap` e nenhum `report_errors`. O registro temporario ficou dentro do projeto e foi apagado antes de cada commit.
- **RED com esqueleto.** Os RED levam esqueletos que compilam e erram (funcoes devolvendo `undefined as never`; componentes devolvendo `null`); o GREEN os substitui.
- **Lint.** 0 erros nos arquivos tocados; os 3 avisos de `no-unused-vars` do `eslint .` (`app-shell.tsx`, `rotulos.ts`) sao anteriores e estao fora do escopo.

## User Setup Required

None - no external service configuration required. Nenhum pacote novo; nao houve Postgres nem container neste plano.

## Next Phase Readiness

- 07-10 (quadro de Negocios) ja pode criar Funis pela tela e ler `useFunis({ estado: "ativo" })`; o `DialogoNovoNegocio` usa `useFunil(id)` para as Etapas e `etapaInicial` do dominio.
- Limitacao aceita (D-15): ids de Funil do modelo antigo (ficha antiga de Negocio, editor de Automacao) caem em "Funil nao encontrado" com a explicacao ate a unificacao.
- `RemoveStageDialog`/`MigrateFunnelDialog` nao tem mais consumidores do store antigo; `removeStage` e `migrateDealsToFunnel` de `@n1/dominio/operations` ficam sem uso na tela e podem sair na fase de unificacao.

## Self-Check: PASSED

- Arquivos criados e reescritos existem; commits `cacbe91`, `3087e1b`, `adf7a48`, `eab3e39`, `353bb79`, `fa3f495` presentes na `main`.
- `npx vitest run` no web: 45 arquivos, 408 testes verdes; `npm run typecheck`, `npm run verificar:tokens` e `npx eslint` nos arquivos tocados sem erro.
- Criterios de aceitacao: `useFunis` na lista (3), `useData` na lista (0), `validarNovoFunil` no formulario (4), `requirement|allowedTransition` nas fichas (0), `removeStage|useRun` nos dialogos (0), `REMOVE_STAGE_PARAM`/`MIGRATE_DEALS_PARAM` exportados (1 cada).
