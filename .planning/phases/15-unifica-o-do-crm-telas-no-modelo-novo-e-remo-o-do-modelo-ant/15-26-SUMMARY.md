---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 26
subsystem: crm
tags: [meus-negocios, filtro, quadro-do-funil, rotas-apagadas, tdd, ucr-06]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-13 (fichas sem recuo), 15-14 (Busca/Lixeira/Notificacoes) e 15-20 (fio novo); o quadro do Funil e as rotas REST de Negocio vem da Fase 7"
provides:
  - "Botao Meus no quadro de /crm/negocios: ?meus=1 pede GET /negocios com proprietarioId do Membro da sessao"
  - "GET /negocios?proprietarioId= na api (rota, servico e repositorio), so restringe"
  - "/crm/meus-negocios e /crm/meus-negocios/[lista] apagadas (404 do app); painel do CRM sem a arvore da Pasta; atalho Meus negocios leva a /crm/negocios?meus=1"
  - "Guarda sem-rota-meus-negocios.test.ts"
affects: [15-27, 15-34, 15-40, 15-41]

plan_head_before: fcc80ea929aa873ba191d182ee51cb5d8bc415d7
plan_head_after: 4898dfd053a0817140ab03fb130f2f1639f842a6

actuals:
  tokens: 10640
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "filtro de quadro na URL (?meus=1): a pagina liga, o quadro so recebe proprietarioId; a chave de SWR e a mesma na pagina e no quadro"
    - "Tela do menu com comParametro/semParametro: um href com query acende so com o parametro ligado"

key-files:
  created:
    - apps/web/src/sem-rota-meus-negocios.test.ts
  modified:
    - apps/api/src/rotas/crm/negocios.ts
    - apps/api/src/servicos/crm/negocios.ts
    - apps/api/src/repositorios/crm/negocios.ts
    - apps/api/src/rotas/crm/negocios.test.ts
    - apps/web/src/dados/crm/negocios.ts
    - apps/web/src/features/crm/quadro-do-funil.tsx
    - apps/web/src/features/crm/quadro-do-funil.test.tsx
    - apps/web/src/app/(shell)/crm/negocios/page.tsx
    - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx
    - apps/web/src/features/shell/app-shell.tsx
    - apps/web/CONTEXT.md
    - packages/dominio/CONTEXT.md
  deleted:
    - apps/web/src/app/(shell)/crm/meus-negocios/page.tsx
    - apps/web/src/app/(shell)/crm/meus-negocios/[lista]/page.tsx

key-decisions:
  - "O filtro Meus mora em /crm/negocios, nao em /crm/funis/[funil]: o quadro (QuadroDoFunil) so e desenhado la; a rota do Funil e a ficha"
  - "Atalho Meus negocios do menu = /crm/negocios?meus=1, com Negocios cedendo o destaque quando o filtro esta ligado"
  - "Sem mudanca no dominio: FiltroDeNegocios vive na web e na api, nao em @n1/dominio"

requirements-completed: []

coverage:
  - deliverable: "Meus negocios e o filtro Meus do quadro: ?meus=1 pede a lista com proprietarioId do Membro da sessao e o quadro so mostra os dele"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/quadro-do-funil.test.tsx#(f) com ?meus=1 a lista sai pedida com proprietarioId do Membro da sessao", status: pass }
      - { kind: test, ref: "apps/web/src/features/crm/quadro-do-funil.test.tsx#(f) sem ?meus=1 o parametro nao vai a api", status: pass }
      - { kind: test, ref: "apps/web/src/features/crm/quadro-do-funil.test.tsx#(f) ligar e desligar mexe so na URL", status: pass }
    human_judgment: false
  - deliverable: "Borda UCR-06: o filtro ligado e desligado duas vezes volta ao mesmo quadro (mesma chave de SWR)"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/quadro-do-funil.test.tsx#(f) borda UCR-06: ligado e desligado duas vezes volta ao mesmo quadro", status: pass }
    human_judgment: false
  - deliverable: "GET /negocios?proprietarioId= filtra no banco e na forma (400 para vazio ou longo demais)"
    verification:
      - { kind: test, ref: "apps/api/src/rotas/crm/negocios.test.ts#(b) GET /negocios?proprietarioId= chega ao servico", status: pass }
      - { kind: test, ref: "apps/api/src/rotas/crm/negocios.test.ts#(f) GET /negocios?proprietarioId= devolve so os Negocios do Proprietario (Postgres local)", status: pass }
    human_judgment: false
  - deliverable: "Borda UCR-06: /crm/meus-negocios cai no 404 do app e nada aponta para la; o menu do CRM nao desenha mais a arvore"
    verification:
      - { kind: test, ref: "apps/web/src/sem-rota-meus-negocios.test.ts", status: pass }
      - { kind: command, ref: "test ! -e apps/web/src/app/(shell)/crm/meus-negocios", status: pass }
    human_judgment: false
  - deliverable: "Como o botao Meus e o atalho do menu aparecem e se comportam no navegador real (destaque, posicao no cabecalho)"
    verification: []
    human_judgment: true
    rationale: "So teste de componente com fetch falso; a aparencia no navegador real fica para a conferencia visual do dono."
---

# Phase 15 Plan 26: "Meus negocios" vira o filtro Meus do quadro Summary

**"Meus negocios" deixou de ser rota e arvore: e o botao Meus do quadro de Negocios (`?meus=1` -> `GET /negocios?proprietarioId=<Membro>`), e as duas paginas de `/crm/meus-negocios` e o grupo "Pastas de Negocios" do menu do CRM foram apagados.**

## Performance

- **Tasks:** 2 (1 tracer `tdd="true"`, 1 auto)
- **Arquivos:** 1 criado, 12 modificados, 2 apagados
- **Commits:** 3 medidos de `plan_head_before` (RED, GREEN do tracer, tarefa 2)

## Accomplishments

- **Api:** `GET /negocios` aceita `proprietarioId` (`ID` de 1 a 64 caracteres; vazio ou longo e 400). O servico repassa e o repositorio acrescenta `and n.proprietario_id = $n` na lista FIXA de colunas (o indice `negocios_proprietario_idx` ja existia na 007). O filtro so restringe: Papel, Espaco e a permissao de ler continuam sendo os da rota.
- **Web, tracer:** `FiltroDeNegocios.proprietarioId` entra na chave de SWR; `useNegociosDoQuadro(funilId, proprietarioId?)` e `QuadroDoFunil({ proprietarioId? })` repassam; a pagina `/crm/negocios` le `?meus=1`, passa `memberId` da sessao e soma os totais do cabecalho com a MESMA chave do quadro. O botao **Meus** (`aria-pressed`) so mexe na URL (`router.replace`), preservando os outros parametros.
- **Rotas e arvore:** `crm/meus-negocios/**` apagadas. `app-shell.tsx` perdeu `MeusNegociosNoPainel`, o campo `comMeusNegocios` e o grupo "Pastas de Negocios" (que estava desenhado DUAS vezes, bloco duplicado de antes do plano). O menu ganhou "Meus negocios" -> `/crm/negocios?meus=1`; `Tela.comParametro`/`semParametro` fazem so um dos dois itens (Negocios, Meus negocios) acender.
- **Guarda:** `sem-rota-meus-negocios.test.ts` prova, lendo o codigo, que nao ha arquivo de rota sob `meus-negocios`, que nenhum arquivo de producao cita `/crm/meus-negocios`, que o menu nao tem mais a arvore e que o atalho aponta para `?meus=1`.
- **CONTEXT:** o da web ganhou o paragrafo de "Meus negocios e um filtro" (e perdeu `/crm/meus-negocios` da "Limitacao aceita"); o do dominio tirou a mesma citacao.

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (tracer) | `d47e063` | `39c65ba` |

Avaliacao semantica do RED: na api o teste novo falhou com 400 onde esperava 200 (a query `.strict()` ainda nao conhecia `proprietarioId`); na web quatro dos cinco casos novos falharam pela razao planejada (a lista saia sem o filtro, o botao "Meus" nao existia, "Renovacao Beta" continuava no quadro). O quinto (403 da api mostra o erro) ja passava e fica como protecao. Plano `type: execute`: nao rodei `check tdd-red-evidence`. A Task 2 e `auto` sem `tdd`; a guarda `sem-rota-meus-negocios` entrou no mesmo commit da mudanca. Sem REFACTOR separado.

Tracer gate (modo end-of-phase, `<verify>` so automatizado): o `<automated>` da Task 1 foi re-executado de ponta a ponta depois do GREEN (web 20/20, tsc web e api, api 14 passados + 3 de banco pulados) e passou; seguiu para a Task 2.

## Verificacao

- Contêiner `crm-n1-pg-1526` (porta 55726, as duas URLs explicitas), migracoes 001-012 aplicadas, `npm run check` completo da raiz: tipos, lint (2 avisos pre-existentes, 0 erros), tokens (405 arquivos, 0 falhas), `@n1/api` 186 arquivos / 2283 testes passados, `@n1/web` 130 arquivos / 1277 testes, `@n1/dominio` 127 arquivos / 2430 testes.
- Unica falha: `colunas-geradas.test.ts` (2 casos: ordenacao e planejador), flake de baseline conhecido. Rodado ISOLADO num contêiner NOVO (recriado e migrado): 8/8 passam. Nada de `outbox-worker` nem `lote-contas-a-pagar (d)` falhou nesta rodada.
- O caso de banco novo `(f)` de `rotas/crm/negocios.test.ts` rodou contra o Postgres local (17/17 passam com banco).
- Contêiner parado ao fim. Nenhum banco remoto, nenhum `.env`.
- Acceptance da Task 1: `grep -c proprietarioId quadro-do-funil.tsx` = 8. Da Task 2: `test ! -e "apps/web/src/app/(shell)/crm/meus-negocios"` sai 0; `grep -c "/crm/meus-negocios" app-shell.tsx` = 0 (e a web inteira so cita a rota apagada em comentario da guarda).

## CONGELADOS (`sem-crm-antigo.test.ts`)

Nenhum arquivo deste plano estava em `CONGELADOS` e nenhum casa o regex (`grep -nE "meus-negocios|app-shell|quadro-do-funil|crm/negocios/page" apps/web/src/sem-crm-antigo.test.ts` sai 1, sem linhas; contagem do regex nos quatro arquivos tocados = 0). As paginas apagadas liam `state.folders/lists/tasks`, nao o CRM antigo em ingles. Nada a tirar da lista.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] O quadro do Funil nao esta em `/crm/funis/[funil]`**
- **Found during:** Task 1 (leitura do codigo)
- **Issue:** o plano e F14-D-06 mandam o filtro Meus para "o quadro de `/crm/funis/[funil]`", mas essa rota e a `FichaDeFunil` (configuracao) e nao desenha quadro; `QuadroDoFunil` so e usado por `app/(shell)/crm/negocios/page.tsx`.
- **Fix:** botao Meus, `?meus=1` e totais na pagina `/crm/negocios`; atalho do menu = `/crm/negocios?meus=1` (o plano ainda dizia "`/crm/funis`", que seria so a lista de Funis e nao mostraria Negocio nenhum). `funis/[funil]/page.tsx` ficou intacta (estava em `files_modified`). Linha `deviation` aberta no `WINDOWS.md` para o dono decidir se quer tambem um quadro na ficha do Funil.
- **Files modified:** `apps/web/src/app/(shell)/crm/negocios/page.tsx`, `apps/web/src/features/shell/app-shell.tsx`
- **Commits:** `39c65ba`, `4898dfd`

**2. [Rule 1 - Bug] Link para a rota apagada na pagina da Lista**
- **Found during:** Task 2
- **Issue:** `estrutura/listas/[lista]/page.tsx` ainda linkava `/crm/meus-negocios` no ramo `espelhoComercial` (que so era alcancavel por `/crm/meus-negocios/[lista]`, agora apagada, e sai inteiro no 15-40).
- **Fix:** o link aponta para `/crm/negocios?meus=1` e o comentario diz que o ramo ja nao e alcancavel; nada mais foi mexido (o espelho da Lista e do 15-40).
- **Files modified:** `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`
- **Commit:** `4898dfd`

**3. [Rule 3 - Blocking] Tipos gerados do Next apontando para as rotas apagadas**
- **Found during:** Task 2 (`tsc --noEmit`)
- **Issue:** `apps/web/.next/dev/types/validator.ts` (gitignored, gerado) ainda importava as duas paginas apagadas e quebrava o `tsc` local.
- **Fix:** `next typegen` para `.next/types` e remocao do `validator.ts` de `.next/dev/types` (o `next dev` o recria). Nada versionado. Quem tiver `.next` antigo vai ver o mesmo erro ate rodar `next dev`/`next build` de novo.

**Total deviations:** 3 auto-fixed (1 de comportamento visivel registrada no WINDOWS, 1 bug, 1 de ambiente). **Impact:** a posicao do filtro mudou da letra do plano (`/crm/funis/[funil]`) para onde o quadro realmente mora; o resto segue o plano.

## WINDOWS.md

- Duas linhas `deviation` abertas, fase 15: (1) o filtro Meus e o atalho moram em `/crm/negocios`, nao em `/crm/funis/[funil]`; (2) o painel do CRM perdeu o grupo "Pastas de Negocios" para todos os Espacos e favoritos de `/crm/meus-negocios` caem no 404 (T-15-63 aceito).
- #22 (links para ids do modelo antigo): continua ABERTA. O item "/crm/meus-negocios" dela esta resolvido (a rota nao existe), mas a Caixa de Entrada ainda produz esses links.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. O unico filtro novo atravessa a fronteira ja prevista (T-15-62): `proprietarioId` so restringe a lista; a rota segue exigindo `ler` Negocio pelo Papel e o repositorio segue limitado ao Espaco da sessao. T-15-63 (favorito quebrado) aceito: 404 do app.

## Next Phase Readiness

Pronto para o 15-27. O 15-40 pode apagar o espelho da Lista (quadro de Status, cartao, dialogo de iniciar conversa, `deal-screen`) sem mais nenhum chamador da pagina `meus-negocios`; o 15-41 tira o tratamento especial da Pasta fixa na arvore da Estrutura (as protecoes A9 de `app-shell.tsx` ficaram como estavam).

## Self-Check: PASSED

- Arquivos: `apps/web/src/sem-rota-meus-negocios.test.ts` existe; `apps/web/src/app/(shell)/crm/meus-negocios` nao existe.
- Commits `d47e063`, `39c65ba` e `4898dfd` sao ancestrais de HEAD.
