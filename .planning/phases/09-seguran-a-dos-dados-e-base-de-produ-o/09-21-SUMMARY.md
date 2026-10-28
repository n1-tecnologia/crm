---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 21
subsystem: seguranca
tags: [pentest, jwt, cors, rest, storage, auth, idor, acl, derive-visibilidade]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-15 suíte adversarial; 09-09 tabela Quem pode; 09-REVIEW.md (CR-01); banco de homologação montado fora do 09-17 (ver 09-PROVAS.md)"
provides:
  - "09-PENTEST.md: autorização do dono (com desvio registrado da D-16), plano da passada, 8 achados triados, resumo"
  - "CR-01 (crítico) e removeMember (alto) corrigidos com teste, confirmados contra o banco de homologação real"
  - "Residual do CR-01 (ApprovalRequest.object.input) achado NESTA passada, corrigido com teste"
  - "Token malformado (3 partes, base64 inválido) deixou de dar 500 e passou a dar 401"
  - "4 achados médio/baixo/informativo registrados como janela em .planning/WINDOWS.md"
affects: [09-20, 09-22]

requirements-completed: [SEG-12]

actuals:
  tokens: 0
  tasks: 3
  confidence: alta

commits: 10
status: completed
completed: 2026-10-28
---

# Plano 09-21 — Passada exploratória de segurança

## O que foi diferente do plano original

A D-16 pedia a passada contra a homologação na VPS, o Supabase de homologação e a URL de Preview da Vercel (09-17). O 09-17 foi pulado; em 2026-10-28 o dono criou por conta própria só o projeto Supabase de homologação e passou ao agente o acesso ao banco e à API de gerenciamento. A passada rodou contra a `apps/api` no Mac do dono, ligada a esse banco e Auth reais, pelo papel `n1_api` — um desvio registrado no topo do `09-PENTEST.md`. Fica sem passada: o nginx e o limite de taxa da VPS, a porta 3021 por fora da VPS, os cabeçalhos da Vercel e a web de Preview (ver `09-PROVAS.md` e o PT-08).

## Achados e triagem (D-15)

| id | severidade | status |
|---|---|---|
| PT-01 (CR-01) | crítico | corrigido — RED `549359a`, GREEN `c70031e` |
| PT-02 (`removeMember`) | alto | corrigido — RED `94f733f`, GREEN `5c5617e` |
| PT-03 (residual do CR-01, achado nesta passada) | alto | corrigido — RED `aa0b935`, GREEN `a902570` |
| PT-04 (token malformado → 500) | baixo/médio | corrigido — RED `ff8bc4f`, GREEN `4103228` |
| PT-05 (`readRecordIds` vaza id oculto) | médio | janela aberta |
| PT-06 (`childAgentExecutionIds` vaza id oculto) | baixo | janela aberta |
| PT-07 (sem cabeçalho de segurança de resposta) | baixo/informativo | janela aberta |
| PT-08 (rate limit só provado em Docker, não na VPS) | informativo | sem ação — depende do 09-20 |

Nenhum crítico ou alto ficou aberto. PT-01 e PT-02 já estavam registrados (pela revisão de código e pelo verificador) antes desta passada; PT-03 e PT-04 nasceram dela.

## Sondas sem achado

alg:none, HS256 com a chave pública como segredo, assinatura ES256 de chave não confiável (simula outro projeto), CORS com origem falsa, REST do Supabase com a chave publicável e `Accept-Profile: plataforma` (`PGRST106`), cadastro aberto desligado (`signup_disabled`), bucket privado com a chave publicável (RLS nega, com e sem objeto real dentro), segredo de Formulário/Tarefa errado (404 uniforme), Membro suspenso recusado em CRM e Financeiro além de `createTask`.

## Sondas não executadas (sem o alvo)

Sessão expirada (exige a chave privada de assinatura, que o agente não tem); `rls_auto_enable` como `anon` (função ausente no projeto de homologação); IDOR em CRM (tabelas vazias, workspace único); porta 3021 fora da VPS; cabeçalhos da web; enumeração em volume (sem nginx).

## Resultado das suítes (depois dos GREEN)

`npm run test -w @n1/dominio`: 1991 passaram, 0 falhas. `npx vitest run src/seguranca` em `apps/api` (Postgres local como `n1_api`): 114 passaram, 2 `it.fails` esperadas (`spawnNextOccurrence` e uma LACUNA remanescente — nenhuma das duas é deste plano). `npm run typecheck` limpo.

## Limpeza

A API local foi encerrada; os arquivos de sessão com senha, chave e token em `scratchpad/hml/` foram apagados (nenhum segredo apareceu em log). O `n1_api`, a senha do dono do banco de homologação e o token pessoal do Supabase usados nesta sessão ficam a cargo do dono trocar/revogar (ver "Fica com o dono" em `09-PROVAS.md`).

## Self-Check

- [x] `09-PENTEST.md` tem as seis seções, autorização preenchida, achados e resumo.
- [x] Nenhum crítico/alto aberto (D-15).
- [x] 4 janelas (`.planning/WINDOWS.md`, `--kind deviation`, fase 09) para os achados médio/baixo/informativo.
- [x] Suíte de `apps/api/src/seguranca` e de `@n1/dominio` verdes depois dos GREEN.
- [x] Nenhum segredo em `09-PENTEST.md` nem em `09-PROVAS.md`.
