---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 19
subsystem: observabilidade
tags: [sentry, alerta, evolution-api, backlog, decisao-do-dono]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-13 Sentry na api; 09-16 Sentry na web; 09-14 arquivos da Evolution API no repositório; 09-17 pulado (homologação)"
provides: []
affects: [09-20, 09-22, sessao-4-conectar-numero]

requirements-completed: []

commits: 0
status: skipped
skipped_by: owner
skipped_on: 2026-10-28
completed: null
---

# Plano 09-19 — PULADO / backlog, por decisão do dono

**Nada deste plano foi executado.** O Sentry em si (SEG-10) já está pronto desde o 09-13 e o 09-16 — isso NÃO é o que está sendo pulado aqui. O que fica em backlog é só a Tarefa 1 (a prova de que o alerta por e-mail chega) e, em aberto por falta de ação, a Tarefa 2 (Evolution API).

## A decisão

Em 2026-10-28, o dono respondeu "não vou implementar o sentry agora. Pode marcar como finalizado isso ou backlog" sobre a Tarefa 1 deste plano (forçar um erro na homologação e receber o e-mail de alerta em até 5 minutos). Como isso nunca foi provado, fica registrado como **backlog**, não como concluído — marcar como concluído sem a prova esconderia que SEG-10 (parte do alerta) continua sem evidência.

## O que NÃO foi provado por causa disso

- **Tarefa 1 — alerta por e-mail:** sem prova. Depende de homologação no ar (09-17, pulado) para forçar `GET /diagnostico/erro-de-prova` com segurança, fora de produção. Fica em backlog até a homologação existir ou até o dono decidir provar direto em produção (com os devidos cuidados).
- **Tarefa 2 — Evolution API na VPS nova:** **não foi pulada**, só não foi feita ainda. Não depende de homologação; pode ser executada quando o dono tiver a VPS nova disponível. Os arquivos de deploy já existem no repositório desde o 09-14 (`apps/api/deploy/evolution/`).
- **Tarefa 3 — registrar em `09-PROVAS.md`:** não roda, porque não há o que registrar de nenhuma das duas tarefas acima.

## Planos que dependiam deste

| Plano | Relação | Estado |
|---|---|---|
| 09-20 produção | não depende do alerta nem da Evolution | pode seguir |
| 09-22 portão final | SEG-10 ficará marcado como "parte do alerta sem prova" | segue, com a ressalva |
| Sessão 4 (conectar número) | precisa da Evolution API no ar | bloqueada até a Tarefa 2 acontecer |

## Self-Check: N/A — plano não executado
