---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 17
subsystem: homologacao
tags: [homologacao, pulado, decisao-do-dono, seg-04, seg-08]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-11 scripts e job homologacao no repositório; 09-04 a 009 e o n1_api provados em Postgres local"
provides: []
affects: [09-18, 09-19, 09-20, 09-21, 09-22]

requirements-completed: []

commits: 0
status: skipped
skipped_by: owner
skipped_on: 2026-10-23
completed: null
---

# Plano 09-17 — PULADO por decisão do dono

**Nada deste plano foi executado.** Este arquivo existe só para registrar a decisão e não deixar o plano parecer feito.

## A decisão

Em 2026-10-23, durante `/gsd-execute-phase 9`, o dono respondeu à orquestração, com as palavras: "Nao vou fazer a separacao do banco para homolog agora. Pule essa etapa". O 09-17 é o plano que cria a homologação (projeto Supabase próprio, papel `n1_api`, serviço `n1-crm-api-hml` na VPS, segredos do GitHub, variáveis da Vercel, push da branch `homologacao`). A decisão vale "agora"; não diz que a homologação deixa de existir.

## O que NÃO foi provado por causa disso

- **SEG-08 (homologação no ar): não cumprido.** Não existe ambiente de homologação com banco e Auth próprios.
- **SEG-04 (a `009` e o `n1_api` provados antes de produção): só a parte local.** A `009` e o `banco:conceder` foram provados em Postgres local, com e sem os papéis do Supabase (09-04), e a suíte `seguranca` roda como `n1_api` no CI (09-12). O que o 09-17 ia provar no Supabase real não foi provado: `anon`/`authenticated` sem `USAGE` em `plataforma`, RLS desligada nas 22 tabelas, o comportamento do gatilho `rls_auto_enable()` depois do `revoke`, o `drop table` recusado ao `n1_api`, o cadastro aberto desligado, e a entrada pelo Preview da Vercel.
- **D-06 (a `009` só vai para produção depois de provada em homologação): fica sem cumprir** a menos que o dono decida outra coisa para o 09-20. A `009` é irreversível depois de aplicada (correção é a `010`).
- Os 4 Usuários de teste da homologação, as 50 chamadas de limite de taxa e o `grep` de segredo nos logs do nginx contra a VPS real também não aconteceram.

## Planos que dependiam deste e precisam de decisão

| Plano | O que depende da homologação | Estado |
|---|---|---|
| 09-18 backup em produção | dependência nominal (lê as provas do 09-17); o backup roda contra produção | pode seguir |
| 09-19 Sentry e Evolution | a prova do alerta do Sentry usa a rota de erro de prova ligada SÓ em homologação; a Evolution API na VPS nova não depende | metade bloqueada |
| 09-20 produção | pré-condição D-06; consultas do 09-17 repetidas em produção; `COFRE_CHAVE` "diferente da de homologação" | decisão do dono |
| 09-21 passada exploratória | roda em homologação | bloqueado |
| 09-22 portão final | depende de 09-20 e 09-21 | espera |

## Self-Check: N/A — plano não executado
