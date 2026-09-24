---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 05
subsystem: infra
tags: [clickup, tenants, cut-over, marcos-paulo, family-office, runbook]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "O roteamento por Empresa (05-04) — TENANT_POR_EMPRESA em produção, pré-requisito da Task 2 deste plano"
provides:
  - "O inventário do corte (05-CORTE-MP-FO.md), com as três Listas, as 24 variáveis MP_CLICKUP_/FO_CLICKUP_, os 10 webhooks a desligar, a ordem/coorte de D-28, o rollback e cinco perguntas abertas — pronto para as Tasks 2 e 3 quando executadas"
affects: [futuro-corte-mp-fo, ten-01]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Inventário de corte com citação arquivo:linha para toda afirmação sobre código — nenhum número inventado (mesmo molde do runbook 04-14)"]

key-files:
  created:
    - .planning/phases/05-contas-a-receber-e-os-outros-tenants/05-CORTE-MP-FO.md
  modified: []

key-decisions:
  - "Execução PARCIAL por decisão explícita do usuário: 'Deixar aberto, seguir fase (Recomendado)' — resposta verbatim à pergunta do orquestrador sobre como seguir com o corte de MP/FO. O plano 05-05 fica preparado e aberto, como 04-14, e a fase continua com 05-08 e 05-09..05-12."
  - "Tasks 2 e 3 (ambas checkpoint:human-verify, gate=blocking-human) NÃO foram executadas nesta sessão — nenhum webhook foi desligado, nenhuma Lista foi arquivada, nada foi tocado em produção, no ClickUp ou no repositório `financeiro-tria`."
  - "TEN-01 permanece em aberto. Este SUMMARY não marca a requirement como concluída — isso é responsabilidade do orquestrador (STATE.md/ROADMAP.md/REQUIREMENTS.md intocados por esta sessão)."

patterns-established:
  - "Pergunta aberta declarada em vez de resposta assumida: as cinco perguntas da seção 6 do inventário (destino de 901109642267, integrações fora do automation/, endpoints agrupados x individuais, host de produção, Tarefas abertas hoje) ficam registradas, não resolvidas por suposição."

requirements-completed: []

# Metrics
duration: ~15min
completed: 2026-09-24
---

# Phase 5 Plan 5: Corte de Marcos Paulo e Family Office — PARTIAL Summary

**Inventário do corte escrito e commitado (271 linhas, `0956658`) — as duas Listas do ClickUp seguem ativas, os 10 webhooks ligados, e nada foi arquivado; o corte de verdade fica para quando o usuário decidir avançar.**

## Escopo desta execução — LEIA ANTES DE ASSUMIR QUE O PLANO ESTÁ FEITO

O plano 05-05 (`autonomous: false`) tem três tasks. Apenas a Task 1
(`type="auto"`) foi executada: o inventário do corte, escrito e commitado.
As Tasks 2 e 3 são `checkpoint:human-verify` com `gate="blocking-human"` —
desligar os 10 webhooks do ClickUp e, só depois, arquivar as duas Listas
(`901109642259` e `901111928443`).

O orquestrador apresentou o estado do plano ao usuário e perguntou como
seguir. A resposta, verbatim: **"Deixar aberto, seguir fase (Recomendado)"**
— ou seja: 05-05 continua preparado e aberto, exatamente como 04-14 ficou
na Fase 4, e a Fase 5 segue adiante com 05-08 e 05-09..05-12 em vez de
bloquear nas Tasks 2/3 deste plano.

**Nenhuma das três tasks do plano está totalmente concluída — só a Task 1.**
Este SUMMARY documenta o que foi preparado, não o fechamento do plano.
`TEN-01` continua aberta.

## O que foi feito

1. **`.planning/phases/05-contas-a-receber-e-os-outros-tenants/05-CORTE-MP-FO.md`**
   (271 linhas, commit `0956658`) — o inventário completo do corte, em seis
   seções:
   - **As Listas** — `901109642259` (Solicitações FO), `901111928443`
     (Contas a pagar FO **e** Solicitações MP, a mesma Lista nos dois
     `config.ts`, confirmando D5-07: um só gesto aposenta os dois tenants),
     e `901109642267` (Contas a receber FO, fora do escopo de TEN-01,
     registrada como achado). Confirmado contra
     `apps/api/exportacoes/MANIFESTO.md`: nenhuma das três foi exportada na
     Fase 0.
   - **As variáveis de ambiente** — as 24 `MP_CLICKUP_*`/`FO_CLICKUP_*`
     (11 de Marcos Paulo, 13 de Family Office), cada uma com default e
     arquivo:linha, todas marcadas como mortas depois do corte, nenhuma
     alterada.
   - **Os webhooks a desligar** — os 10 endpoints (5 por tenant) sob
     `/webhooks/marcos-paulo/*` e `/webhooks/family-office/*`, montados no
     Team `9011658148` do ClickUp, com o roteiro literal para a Task 2
     (`clickup-webhooks.ps1 list`, não executado nesta sessão).
   - **A coorte e a ordem** — os três passos de D-28: desligar os 10
     webhooks primeiro, confirmar silêncio de 48h corridas nas duas Listas,
     só então arquivar. Coorte por origem, não por data.
   - **O rollback** — reabrir webhook vale só para pedidos novos; o ponto
     sem volta é o arquivamento de `901111928443` (Task 3, passo 3), que
     vem por último.
   - **Cinco perguntas abertas** — destino de `901109642267`, integrações
     fora do `automation/` escrevendo nas Listas, endpoints agrupados x
     individuais no painel, host de produção do webhook, e a contagem de
     Tarefas abertas hoje nas duas Listas.

   Todas as afirmações sobre código citam arquivo e linha; nenhum número foi
   inventado.

## O que NÃO foi feito, e quem faz cada parte

| Pendência | Task do plano | Dono |
|---|---|---|
| Deploy do `automation/` em produção com o roteamento de 05-04 (commits irmãos `9a7e723`/`25716c1`) e a rota de 05-08 | pré-requisito da Task 2 | Dono do produto |
| Criar duas Solicitações de teste (Marcos Paulo, EXO Loteamento) na plataforma e confirmar `tenantId` correto no log do `automation/` | 2, passo 1 | Executor/dono do produto (acesso ao log de produção) |
| Desligar, um por vez com hora registrada, os 10 webhooks do ClickUp (`clickup-webhooks.ps1 list` ou painel) | 2, passo 2 | Dono do produto (acesso ao painel do ClickUp) |
| Confirmar 48h de silêncio nas duas Listas, com contagem antes/depois | 2, passo 3 | Dono do produto |
| Verificação de gêmeas: nenhuma Tarefa aberta nas duas Listas com correspondente já lançado pela plataforma | 3, passo 2 | Executor/dono do produto |
| Arquivar `901109642259`, depois `901111928443` — o ponto sem volta | 3, passo 3 | Dono do produto (acesso ao painel do ClickUp) |
| Solicitação de teste da Tria pós-arquivamento (`tenantId: "tria"`) | 3, passo 4 | Executor |
| Responder as cinco perguntas abertas da seção 6 do inventário | — | Dono do produto (painel do ClickUp) |

## Verificação de que o escopo foi respeitado

```
$ git -C ../financeiro-tria status --short
```
Vazio — nenhuma linha alterada no repositório vizinho por esta sessão (o
plano declara explicitamente que `financeiro-tria` não é tocado; a Task 1 só
lê com `grep`/`git show HEAD:<arquivo>`).

Nenhum comando de ClickUp, `clickup-webhooks.ps1`, ou chamada à API do
ClickUp foi executado nesta sessão. Nenhuma Lista foi consultada, desligada
ou arquivada.

## Task Commits

Apenas a Task 1 foi concluída por inteiro. As Tasks 2 e 3
(`checkpoint:human-verify`, `gate="blocking-human"`) permanecem pendentes —
nenhum commit de "conclusão de plano" foi feito para elas.

1. **Inventário do corte** (`05-CORTE-MP-FO.md`) — `0956658` (docs) —
   `docs(05-05): inventário do corte de Marcos Paulo e Family Office`

## Files Created/Modified

- `.planning/phases/05-contas-a-receber-e-os-outros-tenants/05-CORTE-MP-FO.md` — o inventário completo do corte (Listas, env vars, webhooks, coorte, rollback, perguntas abertas)

## Decisions Made

- **Escopo PARCIAL**, decidido pelo usuário em resposta direta à pergunta do
  orquestrador ("Como seguimos com o corte de MP/FO (05-05)?"): **"Deixar
  aberto, seguir fase (Recomendado)"**. O plano 05-05 fica no mesmo estado
  que 04-14 ficou na Fase 4 — preparado, documentado, aberto — e a Fase 5
  segue com 05-08 e 05-09..05-12 em vez de bloquear aqui.
- **Nada foi tocado em produção, no ClickUp, ou no repositório vizinho**
  por esta sessão. As Tasks 2 e 3 exigem acesso que o executor não tem
  (painel do ClickUp, log de produção do `automation/`) e uma decisão de
  timing (quando declarar o silêncio de 48h) que é do dono do produto.
- **`901109642267` (Contas a receber FO) permanece como pergunta aberta**,
  registrada na seção 6 do inventário — não é resolvida nem assumida por
  este plano nem por este fechamento parcial.

## Deviations from Plan

Nenhum desvio de regra 1-4. O plano original previa três tasks completas
nesta execução; a execução real cobre a Task 1 inteira (o inventário, sem
nada omitido das seis seções exigidas) e nenhuma fração das Tasks 2 e 3 —
ambas ficam integralmente pendentes, por decisão explícita do usuário
documentada acima, não por correção automática do executor.

## Known Stubs

Nenhum. O arquivo criado é documentação (inventário operacional), sem UI
nem dado renderizado.

## Threat Flags

Nenhum. Esta sessão não introduziu superfície nova — o inventário só
documenta superfície já existente e mapeada no `threat_model` do plano
(T-5-15, T-5-16, T-5-17, T-5-SC), cujas mitigações (coorte por origem,
ordem desligar-antes-de-arquivar, trilha com hora registrada) seguem sem
aplicação prática até as Tasks 2/3 rodarem.

## Self-Check: PASSED

- `.planning/phases/05-contas-a-receber-e-os-outros-tenants/05-CORTE-MP-FO.md` — FOUND (271 linhas)
- Commit `0956658` — FOUND em `git log --oneline`
- `git -C ../financeiro-tria status --short` — CONFIRMADO vazio (repositório vizinho intocado)
- `grep -c "901111928443" 05-CORTE-MP-FO.md` — presente (Listas, env vars, seção 4, seção 5)
