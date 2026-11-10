---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 36
subsystem: web
tags: [sucessao, membros, conversas, d-15-08, vitest, react]

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-03: SucessaoNoCrm { contatos, empresas, negocios, conversasPassadas } em @n1/dominio/crm/sucessao e a api passando as Conversas ao Sucessor"
provides:
  - "dados/crm/sucessao.ts importa e reexporta SucessaoNoCrm do domínio (a web não declara mais a forma)"
  - "Diálogo de remover Membro: Conversas (conversasPassadas) no grupo 'Passa ao Sucessor', texto sem 'é liberado'"
  - "Página do Membro: Contatos, Empresas, Negócios e Conversas por useSucessaoNoCrm; Agentes, Automações etc. por previewSuccession"
  - "removeMember/previewSuccession do modelo antigo (Conversa de Grupo) com a mesma regra: Atribuído passa ao Sucessor, Atividade 'Conversa passada ao Sucessor'"
affects: [3.5.4 desligamento do modelo antigo de Conversa, 15-21]

actuals:
  tokens: 5300
  tasks: 2
  commits: 6

plan_head_before: 6347878bc4f6d98336d07a331ba2e9e65f43c2f5
plan_head_after: c748d12e7e19d9e04e75f496734e65c073a696c6
commits: 6

tech-stack:
  added: []
  patterns:
    - "Tipo de resposta da api importado do domínio e reexportado pelo cliente web"
    - "Hook de leitura chamado antes do return antecipado, com id undefined quando a tela não deve consultar (quem não governa, Membro removido)"

key-files:
  created:
    - apps/web/src/features/shell/membro-sucessao-no-crm.test.tsx
  modified:
    - apps/web/src/dados/crm/sucessao.ts
    - apps/web/src/dados/crm/sucessao.test.ts
    - apps/web/src/app/(shell)/configuracoes/membros/page.tsx
    - apps/web/src/app/(shell)/configuracoes/membros/[membro]/page.tsx
    - apps/web/src/features/shell/membros-sucessao-no-crm.test.tsx
    - apps/web/CONTEXT.md
    - packages/dominio/src/operations/members.ts
    - packages/dominio/src/operations/members-remocao.test.ts

key-decisions:
  - "Atender uma Conversa passa ao Sucessor na remoção mas não é propriedade: um helper registrosPossuidos (members.ts) exclui o tipo conversation das duas checagens de rebaixamento a Convidado (alterarPapelDoMembro e a exclusão de Papel em lote), para não bloquear o que antes não bloqueava"
  - "A página do Membro só chama a api quando quem vê governa (Administrador ou Proprietário) e o Membro não está removido; senão passa undefined ao hook (a api devolve 403 aos demais)"
  - "removeMember grava 'Conversa passada ao Sucessor' com after = nome do Sucessor; repetir não muda nada porque o Membro removido volta cedo"

requirements-completed: [UCR-02]

coverage:
  - id: D1
    description: "O diálogo de remover Membro mostra Conversas no grupo 'Passa ao Sucessor' com a contagem de conversasPassadas e diz que as Conversas que ele atendia passam ao Sucessor; 'é liberado' não aparece"
    requirement: UCR-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/shell/membros-sucessao-no-crm.test.tsx#(a) e (a2)"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/crm/sucessao.test.ts#lê GET /membros/:id/sucessao-no-crm e devolve as quatro contagens"
        status: pass
    human_judgment: false
  - id: D2
    description: "A página do Membro conta Contatos, Empresas, Negócios e Conversas das tabelas (não do estado), Agentes e o resto de previewSuccession; só quem governa e Membro não removido consulta a api; carregando e recusa aparecem"
    requirement: UCR-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/shell/membro-sucessao-no-crm.test.tsx#(a) a (e)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Conversa de Grupo (modelo antigo): removeMember passa o Atribuído ao Sucessor com Atividade; Agente e outro Membro não mudam; repetir não muda nada; previewSuccession a conta como transferência; atender Conversa não impede rebaixar a Convidado"
    requirement: UCR-02
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/members-remocao.test.ts#removeMember — Conversa de Grupo passa ao Sucessor (D-15-08)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Aparência do diálogo e da página do Membro no navegador real"
    verification: []
    human_judgment: true
    rationale: "Verificação visual fica para o fim da fase (human_verify_mode = end-of-phase); só teste de componente com api falsa"

duration: 8min
completed: 2026-11-06
status: complete
---

# Phase 15 Plan 36: Sucessão de Membros nas telas e em Grupo Summary

**O diálogo de remover Membro e a página do Membro dizem e contam as Conversas que passam ao Sucessor (tipo `SucessaoNoCrm` do domínio, lido das tabelas), e `removeMember` do modelo antigo passa o Atribuído das Conversas de Grupo ao Sucessor, a mesma regra do 15-03.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-06T10:11:00Z (aprox.)
- **Completed:** 2026-11-06T10:20:00Z
- **Tasks:** 2
- **Files modified:** 9 (1 criado, 8 alterados; mais WINDOWS.md)

## Accomplishments

- `dados/crm/sucessao.ts` não declara mais a interface: importa `SucessaoNoCrm` de `@n1/dominio/crm/sucessao` e a reexporta. `conversasLiberadas` tem zero ocorrências em `apps/api/src`, `apps/web/src` e `packages/dominio/src`.
- Diálogo de remover Membro (`configuracoes/membros/page.tsx`): a linha "Conversas" foi para o grupo "Passa ao Sucessor" (o total do título soma `conversasPassadas`), o texto diz que as Conversas que ele atendia passam ao Sucessor e que só Tarefas e itens de Checklist ficam sem Responsável; "Fica sem Responsável" deixou de depender da resposta da api.
- Página do Membro (`[membro]/page.tsx`): `useSucessaoNoCrm` para Contatos, Empresas, Negócios e Conversas; `previewSuccession` só para o que mora em `registros`; mostra "Contando o que está no CRM…" e a recusa da api; a frase de fechamento não conta Conversas como sem Responsável. O hook é chamado antes do `return` antecipado, sem mudar a leitura de `params`.
- Modelo antigo (`members.ts`): `removeMember` passa o Atribuído da Conversa de Grupo ao Sucessor e grava "Conversa passada ao Sucessor"; `previewSuccession` a conta em `transfers`. Repetir não passa nada de novo.
- `apps/web/CONTEXT.md` descreve a prévia da remoção com `conversasPassadas`, o tipo do domínio e o que sobra sem Responsável.

## TDD

- **RED 1** (`6f508a1`): teste do cliente tipado pelo domínio e do diálogo; 2 casos de componente falhando (texto antigo "é liberado" e a contagem no grupo errado). O caso do cliente passa em tempo de execução (só tipo).
- **GREEN 1** (`4581498`): 10/10 nos dois arquivos; `tsc` da web com 0.
- **RED 2** (`a0079e3`): 2 casos de domínio falhando (Atribuído removido em vez de passado; Conversa em `releases`); replay, Agente e outro Membro já passavam e ficam como guarda.
- **GREEN 2** (`591c340`): 13/13; o caso de rebaixamento a Convidado (descoberto ao mover a Conversa para `transfers`, ver desvio 1) falhou antes do helper e passa depois.
- **RED 3** (`28825b9`): teste novo da página do Membro, 5/5 falhando pelas asserções (a página lia só `previewSuccession`).
- **GREEN 3** (`c748d12`): 5/5 passando.
- **REFACTOR:** nenhum.

## Task Commits

1. **Task 1 (traçador): diálogo de remover Membro** — `6f508a1` (test) e `4581498` (feat)
2. **Task 2: Grupo e página do Membro** — `a0079e3` (test), `591c340` (feat: domínio), `28825b9` (test), `c748d12` (feat: página)

O traçador foi re-verificado de ponta a ponta (vitest dos dois arquivos mais `tsc`) antes da Task 2.

## Verificação

- `cd apps/web && npx vitest run src/features/shell/membros-sucessao-no-crm.test.tsx src/dados/crm/sucessao.test.ts && npx tsc --noEmit`: 10/10, tsc 0.
- `cd packages/dominio && npx vitest run src/operations/members-remocao.test.ts && npx tsc --noEmit && cd ../../apps/web && npx tsc --noEmit`: verde.
- Suíte completa da web (113 arquivos, 1074 testes) e do domínio (124 arquivos, 2368 testes): verdes. `tsc` de `apps/api`: 0.
- Postgres local `crm-n1-pg-1536` (porta 55736, migrações 001-012, as duas URLs explícitas): `rotas/operacoes.test.ts`, `rotas/crm/sucessao.test.ts` e `servicos/crm/sucessao.test.ts`, 56/56 (cobrem `removeMember` pela api e a sucessão nas tabelas). Contêiner parado no fim.
- Critérios de aceite: `@n1/dominio/crm/sucessao` em `sucessao.ts` (2), "passam ao Sucessor" em `membros/page.tsx` (5), `conversasLiberadas` fora das três camadas (0), `conversasPassadas` em `apps/web/CONTEXT.md` (1), "Conversa passada ao Sucessor" em `members.ts` (1), `useSucessaoNoCrm` em `[membro]/page.tsx` (3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rebaixar a Convidado passaria a ser bloqueado por atender Conversa**
- **Found during:** Task 2 (ao mover a Conversa de `releases` para `transfers`)
- **Issue:** `alterarPapelDoMembro` e a exclusão de Papel em lote tratam `previewSuccession().transfers` como propriedade (C32 alternativa b). Com a Conversa em `transfers`, quem apenas atende uma Conversa deixaria de poder ser rebaixado a Convidado, o que não acontecia antes.
- **Fix:** helper `registrosPossuidos` em `members.ts` exclui o tipo `conversation` nas duas checagens; a página do Membro faz o mesmo na mensagem de rebaixamento. Teste novo (`mem_walter` só atendendo uma Conversa é rebaixado).
- **Files modified:** `packages/dominio/src/operations/members.ts`, `members-remocao.test.ts`, `[membro]/page.tsx`
- **Commit:** `591c340`, `c748d12`

**2. [Rule 2 - Missing critical] Teste de componente da página do Membro**
- **Found during:** Task 2
- **Issue:** a página do Membro não tinha teste algum, e o plano só pedia o teste do domínio para a Task 2; trocar a fonte da contagem sem teste deixaria D-15-08 e T-15-87 sem prova nessa tela.
- **Fix:** `membro-sucessao-no-crm.test.tsx` (5 casos: contagens das tabelas, Agente do estado, frase de fechamento, carregando e recusa, quem consulta a api).
- **Commit:** `28825b9`

**3. [Plano] Assinatura de `removeMember`**
- O `<behavior>` do plano escreve `removeMember(state, admin, M, { sucessorId: S })`; a assinatura real é `removeMember(state, admin, memberId, successorId)` e foi a usada nos testes. Sem mudança de comportamento.

**Total deviations:** 3 (1 bug, 1 teste faltante, 1 ajuste de assinatura do plano). **Impact:** nenhum no escopo; mais um arquivo de teste e um helper de cinco linhas.

### Registrado em WINDOWS.md (open)

- `deviation` em `configuracoes/membros/page.tsx`: o diálogo e a página do Membro filtram o tipo `conversation` de `previewSuccession` (só contam as Conversas das tabelas). As Conversas de Grupo do modelo antigo passam ao Sucessor em `removeMember`, mas não entram nessa contagem até o 3.5.4 tirar o modelo antigo. É o mesmo comportamento que as Conversas liberadas já tinham antes; agora a tela nem a promessa errada faz.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. T-15-87 (tela prometendo liberar o que o banco passa) fechado pelo tipo único do domínio, pelos testes de texto e contagem e pelo grep sem `conversasLiberadas`; T-15-88 (Sucessor inválido) mantido: a troca do Atribuído vem depois da validação do Sucessor que já existia, e repetir não muda nada (teste).

## Next Phase Readiness

Pronto para o próximo plano da onda. O texto das telas, o contrato (15-03), a api e o modelo antigo de Grupo dizem a mesma coisa sobre a Conversa do Membro removido.

## Self-Check: PASSED

- Arquivos criados e alterados existem (conferido com `[ -f ]`); `membro-sucessao-no-crm.test.tsx` presente.
- Commits `6f508a1`, `4581498`, `a0079e3`, `591c340`, `28825b9`, `c748d12` são ancestrais de HEAD; `git rev-list --count 6347878..HEAD` = 6.
