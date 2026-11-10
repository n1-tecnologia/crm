---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 35
subsystem: producao
tags: [corte, producao, migracao, deploy, ucr-09, ucr-10]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-CORTE.md (roteiro), migrar:crm-antigo (15-27, 15-28, 15-44), ensaio sobre a copia de 2026-11-05 (15-30, 15-34, 15-44), codigo final (15-43)"
provides:
  - "Corte em producao executado e verificado em 2026-11-07: migracao 012 aplicada, CRM antigo guardado nos 18 Espacos de teste e no ws_n1, API 20b4d01 no ar, web na main do n1"
  - "15-PROVAS.md: secao 'Corte em producao' com decisoes, hora e resultado de cada passo, contagens antes/depois, como voltar atras e os limites"
affects: []

plan_head_before: 20b4d01484476b4db46a63c97c8276d352903590
commits: 1

actuals:
  tasks: 3
  commits: 1

key-files:
  modified:
    - .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-PROVAS.md
    - .planning/WINDOWS.md

key-decisions:
  - "Quem executou: o assistente, a pedido do dono ('pode fazer tudo isso ai e fazer o corte', 2026-11-07), e nao o dono como o plano previa. Desvio registrado; a autorizacao explicita do dono o cobre. O passo 1 (avisar a equipe) nao foi feito pelo assistente."
  - "Funil do ws_n1: --funil=guardar. O Funil antigo era o Padrao do bootstrap (1 Etapa, 0 Negocios); migrar acrescentaria um terceiro Funil vazio; nenhum codigo de producao le mais o defaultFunnelId."
  - "Pasta Meus negocios: regra unica D-15-14. 16 dos 18 Espacos de teste a mantem (Tarefa em 4 Listas); nada apagado a mao."
  - "Credencial: o hook de protecao bloqueou a leitura do .env e foi respeitado; tudo usou as CLIs do projeto e dois scripts descartaveis que usam o carregador do projeto sem imprimir URL, usuario ou senha."

requirements-completed: [UCR-09, UCR-10]

coverage:
  - id: D1
    description: "Backup do schema plataforma restaurado em Docker com as mesmas contagens de producao"
    requirement: UCR-10
    verification: "pg_restore em postgres:16: registros=24233, espacos=19, migracoes=11, 2128 nas nove colecoes, 10 tabelas do CRM novo; iguais as lidas em producao"
  - id: D2
    description: "A 012 aplicada em producao e nenhuma migracao pendente"
    requirement: UCR-10
    verification: "migrar: aplicada 012 (818 ms); banco:conceder aplicado; migrar --seco: 0 pendentes"
  - id: D3
    description: "O CRM antigo saiu de registros e esta guardado, conferido por --verificar"
    requirement: UCR-09
    verification: "--verificar 19 de 19 com saida 0 e 19 'igual' contra o --seco; registros 24233 -> 22119 (2114 linhas); sobraram so as 14 Conversas de Grupo"
  - id: D4
    description: "API e web publicadas"
    requirement: UCR-10
    verification: "REVISION 20b4d01 na VM, /saude 200, servico active; main do n1 49f1b54..20b4d01, deployment da Vercel success"
  - id: D5
    description: "Nenhum navegador antigo gravou CRM antigo na janela"
    requirement: UCR-09
    verification: "--verificar de novo apos o deploy: 19 de 19 com saida 0, registros ainda em 22119"
  - id: D6
    description: "As telas em producao funcionam para quem usa o CRM"
    requirement: UCR-10
    verification: "NAO VERIFICADO: nenhuma tela foi aberta em navegador autenticado; a API recusa sem token (401, sem 500). Fica com o dono (provas manuais de 15-PROVAS.md)."
    human_judgment: true
---

# Phase 15 Plan 35: o corte de produção

O corte foi executado e verificado em 2026-11-07. O registro completo (decisões, hora e resultado de cada
passo, contagens, como voltar atrás e o que não foi provado) está em `15-PROVAS.md`, seção "Corte em
produção".

## Em uma frase

A `012` foi aplicada, o CRM antigo dos 18 Espaços de teste e do `ws_n1` foi copiado para
`registros_crm_antigo` e saiu de `plataforma.registros` (2114 linhas; ficam só as 14 Conversas de Grupo),
a API `20b4d01` está no ar (`/saude` 200) e a web foi para a `main` do `n1` com deploy verde na Vercel;
o `--verificar` deu 19 de 19 antes e depois do deploy.

## O que ficou com o dono

- **Conferir as telas num navegador autenticado** (nenhuma foi aberta durante a fase nem no corte).
- **Guardar o backup** `~/n1-corte/backup-plataforma-pre-15-20261107-0816.dump` e `registros_crm_antigo`: são a
  única memória do CRM antigo.
- **Rever `DATABASE_SSL_INSECURE=true`** na configuração local (desliga a verificação do certificado nas
  conexões feitas do computador a produção).
- As decisões que `15-PROVAS.md` lista como pendentes (por exemplo #61 e #73).

## Desvios

- O plano reservava a execução ao dono; foi o assistente, por pedido explícito do dono.
- O passo 1 (avisar a equipe) não foi executado pelo assistente.
