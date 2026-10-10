---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 10
subsystem: web-crm
tags: [next, react, swr, vitest, negocios, quadro, kanban, drag-and-drop, regras-de-encerramento, d-05, d-11, d-14]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-07: useFunis/useFunil (GET /funis/:id com Etapas e Regras de encerramento); 07-08: as 12 rotas REST de Negocio, 409 NEGOCIO_EXIGE_VALOR/NEGOCIO_EXIGE_MOTIVO com campo, D-14 em reabrir, valor como texto decimal; 07-09: SeletorDeRegistro, DialogoNovaEmpresa como molde e os padroes de lista/dialogo pela api; 07-06: chamarCrm/ErroDeApi/invalidarCrm, MensagemDeRecusa, SeletorDeProprietario, usePodeNoCrm, useNomeDoMembro"
provides:
  - "dados/crm/negocios.ts: chaveDeNegocios, useNegocios, chaveDoNegocio, useNegocio e as 10 mutacoes de Negocio (criar, editar, mover, ganhar, perder, reabrir, arquivar, restaurar, lixeira, permanente), invalidando /negocios, /funis, /contatos e /empresas so no sucesso; valorDigitadoParaDecimal"
  - "features/crm/cartao-de-negocio.tsx: CartaoDeNegocio (NegocioResumo sobre CartaoDeQuadro, ActionMenu fora do link, veto de arraste por Papel)"
  - "features/crm/dialogo-de-encerramento.tsx: DialogoDeEncerramento (ganhar/perder/reabrir) com validarGanho/validarPerda/validarReabertura antes do envio e usePodeNoCrm - reusado pela ficha em 07-11"
  - "features/crm/quadro-do-funil.tsx: QuadroDoFunil (colunas por Etapa, mutate otimista + POST /mover com reversao em recusa, menu Abrir/Ganhar/Perder/Mover para, faixa de encerrados com Reabrir), totaisDoQuadro, useNegociosDoQuadro, negociosDoFunil"
  - "features/crm/formulario-de-negocio.tsx: DialogoNovoNegocio (Empresa OU Contato, Funil padrao e Etapa inicial, valor a brasileira), montarNovoNegocio, motivoParaNaoCriar, FUNIS_ATIVOS"
  - "/crm/negocios religado a api: PageHeader com totais declarado/ponderado, Select do Funil, Novo Negocio por ?criar=negocio e ir para a ficha"
affects: [07-11, 07-12, 07-13]

actuals:
  tokens: 31200
  tasks: 2
  commits: 4
plan_head_before: 51fc634e72f5d305538d33f5a43b90ff190cadff
plan_head_after: ec1d52f87c8fc548a5c784df3adc62ac445b41fc
commits: 4

tech-stack:
  added: []
  patterns:
    - "Atualizacao otimista SO no mover do quadro: lista.mutate(otimista, { revalidate: false }) -> moverNegocio (que invalida /negocios no sucesso); na recusa lista.mutate() revalida a chave e o cartao volta. Nunca mutate(key, promise, { optimisticData }): a revalidacao disparada DENTRO da mutacao seria descartada pelo SWR"
    - "A pagina e o quadro leem a mesma chave de SWR (useNegociosDoQuadro): uma ida a api; totaisDoQuadro soma em centavos"
    - "Permissao por acao com um usePodeNoCrm por acao (mover, ganhar, perder, reabrir ganho, reabrir perdido): o que o Papel nao alcanca some do menu/arraste e Reabrir fica desligado com o motivo"
    - "Formulario com padrao derivado, nao efeito: funilId = escolhido valido || padrao da lista; etapaId = escolhida valida || etapaInicial(etapas) - trocar o Funil zera a Etapa"

key-files:
  created:
    - apps/web/src/dados/crm/negocios.ts
    - apps/web/src/dados/crm/negocios.test.ts
    - apps/web/src/features/crm/cartao-de-negocio.tsx
    - apps/web/src/features/crm/dialogo-de-encerramento.tsx
    - apps/web/src/features/crm/dialogo-de-encerramento.test.tsx
    - apps/web/src/features/crm/quadro-do-funil.tsx
    - apps/web/src/features/crm/formulario-de-negocio.tsx
    - apps/web/src/features/crm/quadro-do-funil.test.tsx
  modified:
    - "apps/web/src/app/(shell)/crm/negocios/page.tsx"
    - .planning/WINDOWS.md

key-decisions:
  - "O menu do cartao traz 'Mover para {Etapa}' por Etapa de destino alem de Abrir/Ganhar/Perder (delta do UI-SPEC §4 sobre o plano, WCAG 2.5.7): pelo mesmo moverNegocio, sem otimismo diferente do arraste"
  - "Mover zera a probabilidade propria no servidor (RN-NEG-04): o cartao otimista ja mostra a probabilidade padrao da Etapa de destino ate a revalidacao"
  - "A moeda so acompanha o valor no POST /negocios: sem valor o corpo nao leva moeda (o padrao BRL e do banco); Proprietario vazio nao vai no corpo (o backend usa o Membro da sessao, D-11)"
  - "Ao criar, marcarChegada(href, 'Negocio criado.') + router.push para /crm/negocios/:id: o Toast de sucesso viaja com a navegacao em vez de morrer na tela que fecha (UI-SPEC: Toast + ir para a ficha); a ficha de 07-11 o acende"
  - "Totais e subtitulos das colunas somados em BRL (a moeda padrao da 007), como a tela antiga; o cartao e a faixa formatam cada Negocio na moeda dele"
  - "Erros de forma (valor, probabilidade, data) aparecem no Field enquanto se digita; os de envio (titulo, dono, Funil, Etapa) so como motivo do botao e depois da tentativa - o campo nao grita antes de a pessoa chegar nele"

patterns-established:
  - "Stub de ResizeObserver em teste de componente que renderiza RolagemNoTopo (o jsdom nao o tem): vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })"
  - "Regex montada a partir de fmt.money precisa escapar `$` e `.` e trocar o espaco inquebravel do Intl por \\s"

requirements-completed: [CRM-W2, CRM-W1]

duration: 15 min (este executor; o anterior foi cortado por limite da api durante o RED da Task 2)
completed: 2026-10-10
status: complete

coverage:
  - id: D1
    description: "Mutacoes e hooks de Negocio por HTTP: mover/ganhar/perder/reabrir/lixeira nas rotas e verbos do contrato, reabrir sem corpo e sem content-type, invalidacao de /negocios, /funis, /contatos e /empresas so no sucesso; valorDigitadoParaDecimal (1.234,56 / 1234,5 / 1234.50 / R$ 2.500 e as recusas)"
    requirement: CRM-W2
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/negocios.test.ts (caso a + valorDigitadoParaDecimal)"
        status: pass
    human_judgment: false
  - id: D2
    description: "DialogoDeEncerramento aplica as Regras do Funil antes do envio (D-05): exigeValorGanho desliga Confirmar com a frase de validarGanho ate digitar o valor (1.234,56 -> 1234.56); exigeMotivoPerda idem com validarPerda e envia { motivoPerda, notaEncerramento }; reabrir ganho desligado para base membro (RN-NEG-10) e 403/409 da api por MensagemDeRecusa sem fechar; Funil arquivado pede Funil ativo e Etapa (RN-FUN-14)"
    requirement: CRM-W2
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/dialogo-de-encerramento.test.tsx (casos b, c, d - 9 testes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Quadro de /crm/negocios pela api (D-04/D-05): abre no Funil padrao, uma ColunaDeQuadro por Etapa na ordem inclusive vazia, cartoes abertos na Etapa deles, ganho/perdido so na faixa de encerrados; totais declarado e ponderado e 'N abertos' no cabecalho; sem Funil ativo o estado vazio leva a /crm/funis"
    requirement: CRM-W2
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/quadro-do-funil.test.tsx (casos a, c, d)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Arrastar e mover (T-07-32): soltar noutra coluna move o cartao na hora e chama POST /negocios/:id/mover com { etapaId }; 409 devolve o cartao a coluna de origem e mostra a frase; soltar na propria coluna nao chama a api; menu com Abrir/Ganhar/Perder/Mover para (mesmo POST); Abrir leva a ficha; Convidado nao arrasta e so tem Abrir (D-14)"
    requirement: CRM-W2
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/quadro-do-funil.test.tsx (caso b - arrastar e mover, 6 testes)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Encerrar e reabrir pelo quadro: Perder abre o dialogo com a Regra do Funil e, ao confirmar, POST /perder e Toast 'Negocio marcado como perdido.'; a faixa de encerrados reabre um perdido por qualquer Membro (POST /reabrir, 'Negocio reaberto.') e desliga Reabrir do ganho com a frase de RN-NEG-10 para quem nao administra; Administrador reabre o ganho"
    requirement: CRM-W2
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/quadro-do-funil.test.tsx (caso b - encerrar e reabrir, 3 testes)"
        status: pass
    human_judgment: false
  - id: D6
    description: "DialogoNovoNegocio (D-11): sem titulo ou sem Empresa/Contato Criar fica desligado; Contato pela busca da api, Funil padrao e Etapa inicial vindos da api, envia POST /negocios com { titulo, contatoId, funilId, etapaId } e o quadro revalida; valor a brasileira vai como texto decimal com moeda e um valor ilegivel trava no campo; SEM_FUNIL_PADRAO aparece com 'Ir para Funis' e o dialogo continua aberto"
    requirement: CRM-W1
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/quadro-do-funil.test.tsx (caso e - 3 testes)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Aparencia e sensacao do quadro em navegador real: opacidade do cartao em arraste, realce data-recente ao mudar de coluna, barra de rolagem no topo, faixa de encerrados e o dialogo Novo Negocio no layout de duas colunas"
    verification: []
    human_judgment: true
    rationale: "Nenhum teste de componente ve o CSS nem o arraste nativo do navegador; a verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) e esta registrada em WINDOWS.md (unrun-verify #3)"
---

# Phase 07 Plan 10: Quadro de Negócios religado à api e o Novo Negócio Summary

**O kanban de `/crm/negocios` lê as Etapas de `GET /funis/:id` e os Negócios de `GET /negocios?funilId=…`, arrastar faz `POST /negocios/:id/mover` com atualização otimista e reversão em recusa, Ganhar/Perder/Reabrir passam pelo `DialogoDeEncerramento` com as Regras do Funil aplicadas antes do envio, e o Novo Negócio cria por `POST /negocios` com Empresa OU Contato.**

## Performance

- **Duration:** 15 min neste executor (o anterior foi cortado por limite da api no meio do RED da Task 2; o tempo dele não ficou registrado)
- **Started:** 2026-10-10T22:35:58Z (retomada)
- **Completed:** 2026-10-10T22:52:00Z
- **Tasks:** 2 (as duas `tdd="true"`: RED → GREEN, sem REFACTOR)
- **Files modified:** 10 (8 criados, `page.tsx` reescrita, `WINDOWS.md`)

## Accomplishments

- `dados/crm/negocios.ts`: os hooks e as 10 mutações de Negócio por `chamarCrm`, invalidando `/negocios`, `/funis` (contagens por Etapa), `/contatos` e `/empresas` só no sucesso; `valorDigitadoParaDecimal` converte o que a pessoa digita ("1.234,56", "1234,5", "R$ 2.500") no texto decimal da api.
- `CartaoDeNegocio` e `DialogoDeEncerramento`: o cartão do quadro sobre `CartaoDeQuadro` (menu fora do link, veto de arraste por Papel) e o diálogo de três modos que chama `validarGanho`/`validarPerda`/`validarReabertura` — as mesmas funções do serviço — e deixa Confirmar desligado com a frase delas; 409 `NEGOCIO_EXIGE_VALOR`/`NEGOCIO_EXIGE_MOTIVO` de uma tela velha cai no campo.
- `QuadroDoFunil`: uma `ColunaDeQuadro` por Etapa (inclusive vazias, subtítulo "N% padrão · valor", sem rodapé de Requisitos — D-02), cartões abertos na Etapa deles, `ganho`/`perdido` na faixa recolhível com `Pilula` e "Última Etapa"; soltar move na hora e uma recusa devolve o cartão (T-07-32); menu Abrir/Ganhar/Perder/"Mover para …"; Reabrir de `ganho` desligado para quem não administra (D-14); Convidado só lê.
- `DialogoNovoNegocio`: `Segmentos` Empresa/Contato com `SeletorDeRegistro`, Funil (padrão = o do quadro ou o padrão do Espaço) e Etapa (padrão = `etapaInicial`), valor, moeda, probabilidade, data prevista (DD/MM/AAAA ou AAAA-MM-DD), origem, Proprietário; `validarNovoNegocio` antes de `criarNegocio`; `SEM_FUNIL_PADRAO` com "Ir para Funis".
- `/crm/negocios` reescrita: mesmo `PageHeader` (meta "N abertos", totais declarado/ponderado, `Select` do Funil com os ativos, "Novo Negócio" por `?criar=negocio`), estado vazio sem Funil, `QuadroDoFunil` no `CorpoDeTela`; `moveDealToStage` e o store antigo saem da tela; `features/estrutura/quadro-negocios.tsx` e `/crm/meus-negocios` intocados (D-15).

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: Mutações de Negócio, o cartão e o diálogo de encerramento** — executor anterior
   - RED `247f454` (test) — GREEN `fc0bca6` (feat)
2. **Task 2: O quadro de Negócios religado e o formulário de Novo Negócio** — este executor
   - RED `78dca15` (test) — GREEN `ec1d52f` (feat)

**Plan metadata:** commit de docs ao final (SUMMARY, STATE, ROADMAP, REQUIREMENTS, WINDOWS).

Sem commit de REFACTOR: nada a limpar depois do GREEN em nenhuma das duas tarefas.

## Files Created/Modified

- `apps/web/src/dados/crm/negocios.ts` — `chaveDeNegocios`, `useNegocios`, `chaveDoNegocio`, `useNegocio`, as mutações e `valorDigitadoParaDecimal`.
- `apps/web/src/dados/crm/negocios.test.ts` — caso (a) e a conversão do valor.
- `apps/web/src/features/crm/cartao-de-negocio.tsx` — `CartaoDeNegocio`.
- `apps/web/src/features/crm/dialogo-de-encerramento.tsx` — `DialogoDeEncerramento` (ganhar/perder/reabrir).
- `apps/web/src/features/crm/dialogo-de-encerramento.test.tsx` — casos (b)–(d) da Task 1.
- `apps/web/src/features/crm/quadro-do-funil.tsx` — `QuadroDoFunil`, `totaisDoQuadro`, `useNegociosDoQuadro`, `negociosDoFunil`, `NEGOCIOS_POR_FUNIL`.
- `apps/web/src/features/crm/formulario-de-negocio.tsx` — `DialogoNovoNegocio`, `montarNovoNegocio`, `motivoParaNaoCriar`, `dataDigitadaParaCivil`, `FUNIS_ATIVOS`.
- `apps/web/src/features/crm/quadro-do-funil.test.tsx` — casos (a)–(e) da Task 2 (15 testes).
- `apps/web/src/app/(shell)/crm/negocios/page.tsx` — a página religada.
- `.planning/WINDOWS.md` — janela `unrun-verify` #3 (quadro não exercitado em navegador real).

## Decisions Made

As de `key-decisions` no cabeçalho. A que mais pesa: a atualização otimista do mover é `lista.mutate(otimista, { revalidate: false })` seguida de `moverNegocio`, e NÃO `mutate(chave, promessa, { optimisticData })` — com a mutação em voo o SWR descarta a revalidação que `invalidarCrm("/negocios")` dispara de dentro dela, e o quadro ficaria com a posição otimista sem nunca ouvir o servidor. Do jeito feito, o sucesso revalida pela própria mutação e a recusa revalida a chave explicitamente (o cartão volta), que é o que o plano e T-07-32 pedem.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Regex dos totais no teste (c) não escapava `R$`**
- **Found during:** Task 2 (GREEN)
- **Issue:** o teste herdado montava `new RegExp(fmt.money(...) + ".*declarado")` sem escapar: o `$` de "R$" virava âncora de fim e o `.` de "3.500,50" virava curinga — a asserção nunca casaria, embora o cabeçalho renderize "R$ 3.500,50 em valor declarado".
- **Fix:** helper `literal()` que escapa os especiais de regex e troca o espaço inquebrável do `Intl` por `\s`.
- **Files modified:** `apps/web/src/features/crm/quadro-do-funil.test.tsx`
- **Verification:** caso (c) verde.
- **Committed in:** `ec1d52f`

**2. [Rule 3 - Blocking] `ResizeObserver` inexistente no jsdom**
- **Found during:** Task 2 (GREEN)
- **Issue:** `RolagemNoTopo` (barril do shell, usada pelo quadro) cria um `ResizeObserver` no efeito; o jsdom não o tem, a exceção derrubava a árvore inteira e os 11 testes do quadro não achavam "Contrato Ana". Nenhum teste anterior renderizava `RolagemNoTopo`.
- **Fix:** `vi.stubGlobal("ResizeObserver", …)` no `beforeEach` do teste (infra de teste; nada muda em `design/tela.tsx`).
- **Files modified:** `apps/web/src/features/crm/quadro-do-funil.test.tsx`
- **Verification:** os 15 testes verdes.
- **Committed in:** `ec1d52f`

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3), as duas no arquivo de teste.
**Impact on plan:** nenhum escopo novo; o código de produção segue o plano e o UI-SPEC.

### Registros (não são correções de código)

1. **Retomada.** O executor anterior foi cortado por limite da api durante o RED da Task 2, com o teste (420 linhas) e os dois esqueletos no disco sem commit e registros de RED velhos em `.planning/red-tmp/`. Este executor leu o teste contra o `<behavior>` do plano e o manteve (cobre (a)–(e), mais os itens "Mover para …" do UI-SPEC §4 e o atalho de `SEM_FUNIL_PADRAO`), acrescentou o helper `botao()` para que o alvo do RED falhasse numa asserção de uma linha, apagou o `red-tmp` velho e seguiu RED → GREEN.
2. **Evidência de RED.** Alvo "sem título ou sem Empresa/Contato, Criar Negócio fica desligado" (o prefixo "(e) " fica fora do `-t`, que é regex), isolado com `--reporter=tap`, falhando em `o botão "Criar Negócio" está na tela: expected null not to be null`; classificador `RED_EVIDENCE_OK` (`target_test_failed`, 15 testes, 1 falha, os demais SKIP). O registro ficou em `.planning/red-tmp/red-criar.json` (dentro do projeto, como o classificador exige) e foi apagado antes do commit. A Task 1 teve o mesmo tratamento no executor anterior (`red-mover`, `red-perder`, `red-valor`).
3. **Aceitação da Task 1 reconferida** (não havia REFACTOR): `negocios.test.ts` e `dialogo-de-encerramento.test.tsx` verdes na rodada final (34 testes nos três arquivos do plano); `validarGanho` (3) e `validarPerda` (3) em `dialogo-de-encerramento.tsx`; `git log 51fc634..HEAD -- deal-card.tsx deal-screen.tsx quadro-negocios.tsx` vazio.
4. **Guarda de branch protegida.** Como em 07-01..07-09, os commits foram feitos em `main` por decisão do orquestrador (`branching_strategy: none`).
5. **Verificação além do plano:** `npm run build` (web) passou após o GREEN (`/crm/negocios` compilada); a suíte inteira de `apps/api` não foi rodada (`lote-contas-a-pagar.test.ts` falha fora do escopo, como registrado em 07-09).

## Issues Encountered

- O plano foi retomado depois de o primeiro executor ser cortado por limite da api no RED da Task 2 (registro 1 acima). Nada do trabalho dele se perdeu: os commits da Task 1 estavam íntegros e os arquivos da Task 2 estavam no disco.
- Os dois achados de teste (regex sem escape e `ResizeObserver`) estão nas deviations.

## Known Gaps

- **"Mostrando 200 de N"** vai no rodapé de cada coluna quando o Funil passa de 200 Negócios (UI-SPEC §9, literal); nenhum teste exercita o caso — é uma linha condicional sobre `total > itens.length`.
- **Realce `data-recente`** do cartão que mudou de coluna é um estado local limpo no próximo arrasto (a animação CSS é de uma vez só); não usa `useRecente` do store antigo.
- **Probabilidade do cartão otimista** assume a padrão da Etapa de destino (RN-NEG-04); a revalidação confirma.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: as telas ficam dentro do limite "tela → `/negocios/*`" do threat model do plano. T-07-32 (otimismo só de tela, servidor é a verdade) está coberto pelo caso (b) de recusa; T-07-33 (Reabrir `ganho`) pela tela desabilitar por `usePodeNoCrm` enquanto o serviço aplica D-14.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-11 (ficha de Negócio) importa `useNegocio`, as mutações e `DialogoDeEncerramento` (props `modo`, `negocio`, `funil`, `etapas?`, `onClose`, `onConcluido`) e pode reaproveitar `DialogoNovoNegocio` com `valorInicial.empresa`/`contato`; a ficha que abre em `/crm/negocios/:id` deve ler `lerChegada` para acender "Negócio criado.".
- Verificação visual do quadro (arraste nativo, opacidade, rolagem no topo) fica para o fim da fase — janela `unrun-verify` #3 em `WINDOWS.md`.
- Sem bloqueios.

---
*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Completed: 2026-10-10*

## Self-Check: PASSED

- Os 9 arquivos de codigo listados existem no disco.
- Os 4 commits de tarefa (`247f454`, `fc0bca6`, `78dca15`, `ec1d52f`) sao ancestrais de HEAD; `commits: 4` medido por `git rev-list --count 51fc634..HEAD`.
- Criterios de aceitacao reexecutados: casos (a)-(e) e (a)-(d) verdes (34 testes nos 3 arquivos; 153 em `src/dados/crm src/features/crm`); `QuadroDoFunil` na page (4); `moveDealToStage` soma 0; `validarGanho`/`validarPerda` (3 cada); `git log 51fc634..HEAD` vazio para os arquivos de D-15 das duas tarefas; `npm run typecheck`, `npm run lint` (0 erros, 3 avisos pre-existentes), `npm run verificar:tokens` (0 falhas) e `npm run build` verdes.
