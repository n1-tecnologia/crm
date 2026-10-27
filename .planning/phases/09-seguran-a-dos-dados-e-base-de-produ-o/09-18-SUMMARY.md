---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 18
subsystem: backup
tags: [backup, producao, pulado, decisao-do-dono, seg-09]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-14 backup cifrado e restauração provados em Docker local; scripts em apps/api/deploy"
provides: []
affects: [09-19, 09-20, 09-22]

requirements-completed: []

commits: 0
status: skipped
skipped_by: owner
skipped_on: 2026-10-27
completed: null
---

# Plano 09-18 — PULADO por decisão do dono

**Nada deste plano foi executado.** Este arquivo existe só para registrar a decisão e não deixar o plano parecer feito.

## A decisão

Em 2026-10-27, durante `/gsd-execute-phase 9`, a orquestração apresentou os 8 passos do dono (plano de backup do Supabase; bucket no Backblaze B2 com ciclo de vida de 14 dias e chave "Write Only"; `age` e `rclone` no Mac; cliente PostgreSQL, `age` e `rclone` na VPS; instalação do timer; prova de só escrita; restauração no Mac). O dono, perguntado se seguia ou pulava, respondeu: "pular". A resposta vale para esta execução; não diz que o backup deixa de existir.

## O que NÃO foi provado por causa disso

- **SEG-09 (backup diário de produção, cifrado, fora da VPS, restaurável): só a parte local.** O 09-14 provou o ciclo `pg_dump` → `age` → destino → restauração, com contagem antes e depois, num Postgres descartável em Docker. Não foi provado em produção: o timer `n1-crm-backup.timer` na VPS, o envio ao bucket, a chave só de escrita (que `rclone lsf` com a chave da VPS FALHA), a regra de 14 dias no bucket e uma restauração de um dump real de produção no Mac do dono.
- **Nenhum backup próprio de produção existe.** A única proteção do banco de produção continua sendo o que o plano do Supabase do projeto já oferece (Database › Backups), que não foi conferido nesta fase. O Storage não é coberto por nenhuma das duas.
- A escolha do bucket (B2 recomendado, "Seguir com Backblaze B2" respondida em 2026-10-23) fica **sem efeito prático**: nenhum bucket foi criado.
- `09-PROVAS.md` não foi criado por este plano. A seção "Backup e restauração (09-18)" não existe; `apps/api/deploy/CONTEXT.md` não ganhou a linha "Última restauração provada".

## Planos que dependiam deste

| Plano | Relação com o backup | Estado |
|---|---|---|
| 09-19 Sentry e Evolution | dependência nominal (`depends_on` inclui 09-18); a Evolution na VPS nova não usa o backup | a parte da Evolution pode seguir; a prova do alerta continua presa à homologação |
| 09-20 produção | aplica a `009`, que é irreversível; sem backup próprio de produção, a rede de segurança antes dela é só a do Supabase | decisão do dono |
| 09-22 portão final | a checagem de SEG-09 ficará como não cumprida em produção | espera |

## Self-Check: N/A — plano não executado
