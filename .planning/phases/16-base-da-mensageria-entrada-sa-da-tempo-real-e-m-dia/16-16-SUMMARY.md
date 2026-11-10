---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 16
subsystem: prova-ao-vivo
tags: [producao, whatsapp, evolution, tempo-real, audio, prova-ao-vivo]

requires:
  - phase: 16-15
    provides: o pré-voo respondido, o comando tempo-real:provar e o roteiro da prova
provides:
  - "16-PROVAS.md: o registro da prova ao vivo (pré-voo, passo a passo, tempos medidos no servidor, decisão do áudio, o que fica para a Sessão 4)"
  - "mensageria em produção: API e web em 74554ab, 013 aplicada, workers ligados, Canal ligado à instância de teste"
  - "texto, áudio, imagem e figurinha entram do celular e viram Mensagem sozinhos; texto e imagem respondidos pela Caixa chegam ao celular"
  - "decisão do áudio (Open Question 1): aceitar até 3 s só para áudio"
affects: [verificação da fase 16, Sessão 4, Fase 13 passo 3]

actuals:
  tokens: 0
  tasks: 3
  commits: 1
plan_head_before: 74554abb1e08274415c0d0995cdff5ea1c11857f
plan_head_after: 74554abb1e08274415c0d0995cdff5ea1c11857f

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia/16-PROVAS.md
  modified:
    - .planning/phases/16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia/16-PROVA-AO-VIVO.md
    - .planning/phases/16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia/deferred-items.md

key-decisions:
  - "Open Question 1: o áudio passou de 2 s (2,28 s no servidor, 1,04 a 1,09 s o texto); o dono escolheu aceitar até 3 s só para áudio (2026-11-10). A ordem 'baixar antes da transação' (D-16-08) não muda"
  - "A prova mediu o tempo de recebido_em a processado_em em webhooks_recebidos, porque o journal do usuário de deploy é limitado a 80 linhas e as linhas mensageria.etapas não couberam"

requirements-completed: [MSG-03, MSG-04, MSG-06]

coverage:
  - id: D1
    description: "Texto, áudio e imagem do celular entram na Caixa de Entrada sozinhos, e a resposta escrita na Caixa chega ao celular"
    verification:
      - kind: other
        ref: "16-PROVAS.md passos 18, 19, 21 e 22: 5 webhooks processado em 1 tentativa, 0 ignorado, 0 falhou; Ping e Pong na captura de tela do dono; chegada no celular confirmada pelo dono"
        status: pass
    human_judgment: true
    rationale: "Chegar ao celular e o áudio tocar só o dono vê; o relato dele é a prova"
  - id: D2
    description: "Texto e áudio aparecem em outra aba em menos de 2 s, sem recarregar (Pronto quando (b) da fase)"
    verification:
      - kind: other
        ref: "não cronometrado na tela: servidor processa em 1,04 a 1,09 s (texto) e 2,28 s (áudio) e a estimativa ponta a ponta é ~2 s e ~3 s"
        status: unknown
    human_judgment: true
    rationale: "A latência até a aba e a via do tempo real (SSE, e não a releitura de 5 s) só se medem na tela do dono, com cronômetro e o DevTools"
  - id: D3
    description: "O pooler de produção entrega LISTEN/NOTIFY (A9)"
    verification:
      - kind: other
        ref: "tempo-real:provar em produção: papel=n1_api porta=5432 recebido_em_ms=52, 53, 52"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nenhuma chamada ignorada por falta de número (@lid) com a Evolution 2.4.0"
    verification:
      - kind: other
        ref: "psql em plataforma.webhooks_recebidos, últimas 3 horas: 5 linhas, todas estado processado e resultado vazio; zero ignorado:sem_numero"
        status: pass
    human_judgment: false

duration: n/d
completed: 2026-11-10
status: complete
---

# Phase 16 Plan 16: Prova ao vivo em produção Summary

**A mensageria está em produção e funciona com um WhatsApp real: texto, áudio, imagem e figurinha entram sozinhos pela Evolution 2.4.0 e viram Mensagem na Caixa, e a resposta escrita na Caixa chega ao celular. Dois pontos da prova ficam com o dono: o cronômetro de 2 s nas duas abas e o fluxo `/eventos` atrás do nginx.**

## Accomplishments

- **Produção no ar.** API e web em `74554ab`, `013` aplicada, os dois workers e a coleta de órfãos ligados por drop-in, o ouvinte de tempo real conectado pelo pooler, o Canal "Igor Business" ligado à instância `igor-dev`.
- **Entrada.** Cinco webhooks `messages.upsert` (texto, áudio, texto, imagem, figurinha), todos `processado` em 1 tentativa, nenhum `ignorado` nem `falhou`. O Contato e a Conversa nasceram sozinhos.
- **Saída.** Texto e imagem escritos na Caixa chegaram ao celular; a Mensagem saiu como "Enviada".
- **A9 provada.** `LISTEN/NOTIFY` pelo pooler de produção, 52 ms.
- **Decisão do áudio.** O áudio levou 2,28 s no servidor; o dono escolheu aceitar até 3 s só para áudio.

## Task Commits

1. **Task 1 (checkpoint do dono): publicar, ligar o Canal e provar com o celular** — feito pelo dono e pelo assistente a pedido dele; sem commit (ver `16-PROVAS.md`, "Como a prova foi feita")
2. **Task 2 (decisão): o áudio passou de 2 s?** — resposta do dono: `aceitar-audio-ate-3s`
3. **Task 3: `16-PROVAS.md`** — commit `docs(16-16)` deste plano (junto com os dois resumos)

## Deviations from Plan

**1. [Desvio de D-16-04/D-16-05 e T-16-59] O assistente agiu em produção.** O plano diz que o executor só registra. O dono pediu por escrito para publicar e testar em produção e deu ao assistente o acesso de deploy da VM; o que cada um fez está na tabela de `16-PROVAS.md`. O drop-in root e o Canal na tela ficaram com o dono.

**2. [T-16-58] Sem backup do schema `plataforma` antes da `013`.** O dono recusou ("sem backup"). A `013` é aditiva e não tem desfazer; só voltar a API ao `20b4d01` é possível.

**3. Passo 20 (`mensageria.etapas`) substituído.** O journal do usuário de deploy só lê 80 linhas e a releitura da tela as enche; no lugar, o tempo de `recebido_em` a `processado_em` em `webhooks_recebidos`, que não tem dado pessoal.

## Issues Encountered

- Quem colou o bloco de root duas vezes no terminal do Mac por engano não alterou nada (os caminhos não existem lá); passou a ser um comando único `ssh root@… "…"`.
- O `restart` do serviço estourou o `TimeoutStopSec=20` e levou SIGKILL por causa das conexões do fluxo de eventos abertas. O serviço subiu limpo. Anotado em `deferred-items.md`.
- O dono relatou "tudo funcionando" sem cronometrar as duas abas; por isso a truth `backstop` de 2 s fica `unknown` e a verificação da fase deve sair `human_needed`.

## Known Stubs

None.

## Threat Flags

None novos. T-16-60 (corpo com dado pessoal sem prazo de retenção) segue aceito até a Sessão 19.

## Next Phase Readiness

Falta, do dono: o cronômetro das duas abas e o fluxo `/eventos` no DevTools (itens do `16-PROVAS.md`, "O que continua aberto"), rotacionar a chave global da Evolution, e trocar o `SERVER_URL` dela para https. A Sessão 4 herda o botão "Conectar" com QR, `fromMe`, status de entrega, o nono dígito e `@lid`.

## Self-Check: PASSED
