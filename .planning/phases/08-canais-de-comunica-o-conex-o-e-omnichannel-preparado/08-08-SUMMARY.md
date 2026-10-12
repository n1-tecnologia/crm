---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 08
subsystem: ui
tags: [nextjs, react, crm, canais, omnichannel, vitest]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "08-01 criarCanal/ConectarProvedor/SeloDoProvedor/[provedor] page; 08-02 capacidadesDoCanal; 08-03 POST /canais com filaPadraoId/origemPadraoId"
provides:
  - "ORIENTACAO_DO_PROVEDOR (quandoUsar, passos, espacoReservado por provedor)"
  - "Tela /configuracoes/canais/conectar com os quatro cartões de provedor"
  - "Botão Conectar Canal nas Configurações da Caixa (desabilitado com a frase de B35)"
  - "Página de orientação completa: passos, espaço reservado do QR/token, formulário com Fila e Origem padrão"
affects: [08-09, 08-10, 08-11]

actuals:
  tokens: 14000
  tasks: 3
  commits: 3
plan_head_before: 71689b9cd764605f4963d6aae2d67ed3b16aebd0
plan_head_after: 68a0218452a67fae9acdc7bdfdbb11998f72ef7c

tech-stack:
  added: []
  patterns:
    - "Link com classes btn quando permitido, Button desabilitado com disabledReason quando usePodeNoCrm devolve motivo"
    - "Espaço reservado de integração futura: borda tracejada var(--linha), fundo var(--superficie-2), Pilula neutra"

key-files:
  created:
    - apps/web/src/features/crm/conectar-canal.ts
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/page.tsx
    - apps/web/src/features/crm/conectar-canal.test.tsx
  modified:
    - apps/web/src/features/crm/conectar-provedor.tsx
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx
    - apps/web/src/features/shell/rotas.test.ts

key-decisions:
  - "O mesmo elemento botaoConectar serve de action da Section Canais e do EmptyState sem Canais"
  - "Erros 409 por campo (nome, identificador, filaPadraoId, origemPadraoId) vão para o Field correspondente; outros vão para p role=alert; bloqueios.canais[0] vira o link ver o Canal"
  - "rotas.ts não mudou: só rotas.test.ts ganhou asserções (Pitfall 7)"

patterns-established:
  - "Texto de orientação por provedor mora no web (conectar-canal.ts, sem JSX), não no domínio"

requirements-completed: [CXE-W1]

coverage:
  - id: D1
    description: "Botão Conectar Canal na seção Canais das Configurações da Caixa, desabilitado com a frase de B35 para Membro/Convidado (D-05)"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conectar-canal.test.tsx#as Configurações da Caixa têm o botão Conectar Canal"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tela com exatamente quatro cartões de provedor, ícone, selo, frase de uso e Conectar levando a …/conectar/<provedor> (D-06)"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conectar-canal.test.tsx#mostra exatamente os quatro provedores"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/conectar-canal.test.tsx#Membro: os quatro Conectar ficam desabilitados com a frase de B35"
        status: pass
    human_judgment: false
  - id: D3
    description: "Página de orientação por provedor: passos, espaço reservado marcado como disponível quando a integração chegar, formulário com Nome, identificador, Fila e Origem padrão (D-07)"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conectar-canal.test.tsx#mostra os passos e o espaço reservado"
        status: pass
    human_judgment: false
  - id: D4
    description: "Conectar cria o Canal por POST /canais com filaPadraoId/origemPadraoId opcionais, re-hidrata e abre a ficha; 409 fica na tela; slug inválido dá notFound (D-08, T-08-33)"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conectar-canal.test.tsx#Conectar cria o Canal com a Fila"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/conectar-canal.test.tsx#409 de conta em uso"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/conectar-canal.test.tsx#um slug que não é provedor vira notFound()"
        status: pass
    human_judgment: false
  - id: D5
    description: "Rotas novas reconhecidas como tabela por formaDe, sem mudar rotas.ts (Pitfall 7)"
    verification:
      - kind: unit
        ref: "apps/web/src/features/shell/rotas.test.ts#reconhece cada família pelo prefixo"
        status: pass
    human_judgment: false
  - id: D6
    description: "Aparência e adequação do mockup (hierarquia visual dos cartões, do bloco de passos e do espaço reservado tracejado) no navegador"
    verification: []
    human_judgment: true
    rationale: "Juízo visual/UX que nenhum teste de componente afirma; vai para o UAT de fim de fase."

duration: 14min
completed: 2026-10-12
status: complete
---

# Phase 08 Plan 08: Jornada de conexão de Canal Summary

**Do botão "Conectar Canal" nas Configurações da Caixa até a ficha do Canal novo: quatro cartões de provedor, passo a passo com espaço reservado do QR/token e formulário real com Fila e Origem padrão, tudo gravando por `POST /canais`.**

## Performance

- **Duration:** 14 min
- **Completed:** 2026-10-12T17:47:44Z
- **Tasks:** 3
- **Files modified:** 6 (3 criados, 3 alterados)

## Accomplishments

- `ORIENTACAO_DO_PROVEDOR` com o texto exato do plano para os quatro provedores.
- `/crm/caixa-de-entrada/configuracoes/canais/conectar`: `ul.grade-solta` com um `li.item-solto` por provedor (ícone de `CHANNEL_ICON`, selo, quando usar, Conectar).
- Botão "Conectar Canal" na `Section` Canais e no `EmptyState` sem Canais; sem permissão, `Button` desabilitado com a frase de B35.
- `ConectarProvedor` ganhou "Como conectar", o espaço reservado tracejado (ícone por provedor, pílula "disponível quando a integração chegar"), os `Select` Setor (Fila padrão) e Origem padrão, `router.push` para a ficha do Canal criado, erros por campo e link "ver o Canal" no 409.
- 8 testes de componente em `conectar-canal.test.tsx` e asserções novas em `rotas.test.ts`; suíte `@n1/web` inteira: 522 testes verdes.

## Task Commits

1. **Task 1: textos de orientação, cartões e botão** - `4d21109` (feat)
2. **Task 2: orientação completa com Fila e Origem** - `565c4a3` (feat)
3. **Task 3: testes da jornada e rotas** - `68a0218` (test)

**Plan metadata:** commit docs(08-08) após este SUMMARY.

## Files Created/Modified

- `apps/web/src/features/crm/conectar-canal.ts` - textos de orientação por provedor
- `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/page.tsx` - os quatro cartões
- `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx` - botão Conectar Canal
- `apps/web/src/features/crm/conectar-provedor.tsx` - passos, espaço reservado, Fila e Origem
- `apps/web/src/features/crm/conectar-canal.test.tsx` - testes de componente da jornada
- `apps/web/src/features/shell/rotas.test.ts` - rotas novas

## Decisions Made

- Um único elemento `botaoConectar` alimenta a `Section` e o `EmptyState`.
- Erros por campo vão ao `Field` (que já tem `role="alert"`); só os sem campo conhecido usam o `p role="alert"` solto.
- `rotas.ts` intacto (verificado: nenhum commit do plano o toca).

## Deviations from Plan

None - plan executed exactly as written.

Dois ajustes de execução sem impacto de escopo: o token `--raio-md` não existe (`verificar:tokens` acusou), trocado por `--raio-superficie` ainda na Task 2; e o reindent do bloco do formulário após envolvê-lo em `div.grid`.

## TDD Gate Compliance

A Task 3 (`tdd="true"`) é, por desenho do plano, a prova de componente de telas implementadas nas Tasks 1-2; por isso o teste nasceu já verde e não há RED genuíno nem commit `feat` posterior. Para provar que os testes não são vacuosos, mutei temporariamente o código (`filaPadraoId` renomeado em `conectar-provedor.tsx` e `disabledReason` trocado no cartão) e rodei a suíte: 2 testes falharam ("Membro: os quatro Conectar…" e "Conectar cria o Canal com a Fila…"). Os dois arquivos foram restaurados do HEAD (`git checkout -- <arquivo>`) antes do commit. Sequência de commits: `test(08-08)` único, sem RED/GREEN separados.

## Issues Encountered

None.

## Known Stubs

O bloco "espaço reservado" (QR/token, autorização, servidores) é um stub intencional de D-07: texto e pílula "disponível quando a integração chegar", sem campo e sem clique. Será trocado quando a integração com os provedores existir (fase posterior); não impede o objetivo do plano.

## Threat Flags

None - sem superfície nova além do modelo de ameaças do plano (T-08-33 coberto por `notFound` testado; T-08-34 segue no `POST /canais`).

## Next Phase Readiness

A ficha `/configuracoes/canais/<id>` (destino do `router.push`) é entregue por 08-09, com "Simular conexão". Pendente de UAT de fim de fase: o juízo visual do mockup (D6).

## Self-Check: PASSED

- Arquivos criados presentes: conectar-canal.ts, canais/conectar/page.tsx, conectar-canal.test.tsx.
- Commits `4d21109`, `565c4a3`, `68a0218` presentes em `main`.
- `npm run typecheck`, eslint nos arquivos tocados, `verificar:tokens` e a suíte `@n1/web` (522 testes) verdes.

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*
