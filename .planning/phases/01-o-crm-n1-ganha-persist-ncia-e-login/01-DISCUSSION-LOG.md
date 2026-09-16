# Phase 1: O CRM N1 ganha persistência e login - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 1-O CRM N1 ganha persistência e login
**Areas discussed:** Camada HTTP do apps/api, O que volta depois de gravar, Otimismo na tela, O que entra no bootstrap

---

## Camada HTTP do apps/api

| Option | Description | Selected |
|--------|-------------|----------|
| Fastify em apps/api | Processo próprio, schema-first com zod, tipagem de rota; precisa de deploy (D11) | ✓ |
| Route handlers no próprio Next | Sem processo separado; resolve D11 na prática; acopla a API ao web; serverless exige pooler | |
| Hono em apps/api | Leve, portável entre Node/edge/Vercel; menos bateria inclusa | |

**User's choice:** Fastify em apps/api (recomendado pelo plano, D4)

| Option | Description | Selected |
|--------|-------------|----------|
| Navegador → apps/api com o JWT do Supabase | Bearer token; Fastify verifica via JWKS; resolve Membro por userId; sem estado; um salto | ✓ |
| Navegador → Next → apps/api (BFF) | Next repassa com segredo compartilhado; apps/api nunca exposto ao navegador; um salto a mais | |
| Você decide | — | |

**User's choice:** JWT direto
**Notes:** Mesmo middleware serve ao `automation/` com token de serviço na Phase 2.

---

## O que volta depois de gravar

| Option | Description | Selected |
|--------|-------------|----------|
| O resultado + só o que mudou | OperationResult + registros gravados/removidos + revisão; uma ida; payload mínimo | ✓ |
| O resultado + o estado inteiro | ~475 KB por clique; zero merge no front | |
| Só o resultado; o front re-hidrata | Duas idas e voltas (~500 ms) | |

**User's choice:** Diff
**Notes:** A UoW já calcula a lista em `gravar()`; hoje devolve contagens.

---

## Otimismo na tela

| Option | Description | Selected |
|--------|-------------|----------|
| Híbrido: recusa na hora, gravação espera | Roda numa cópia; recusa instantânea sem rede; se ok, POST e espera o diff | ✓ |
| Otimista de verdade | Aplica local + reconcilia ids; rollback em recusa/conflito | |
| Pessimista | Espera a rede para tudo, inclusive recusas | |

**User's choice:** Híbrido
**Notes:** `nextId` é contador e timestamps são `new Date()` — otimismo total exigiria ids provisórios. Conflito de revisão: o front re-hidrata; sinalização fica com o planejador.

---

## O que entra no bootstrap

| Option | Description | Selected |
|--------|-------------|----------|
| Só o Financeiro | Espaço Gestão › Pasta Financeiro › 2 Listas + Status/Campos/Tags/Papéis/Agente/Automações; nada de CRM/IA; zero dados fictícios | ✓ |
| Toda a configuração, sem dados | Todos os Espaços/Listas/Campos/Automações do seed, vazios | |
| Você decide | — | |

**User's choice:** Só o Financeiro

| Option | Description | Selected |
|--------|-------------|----------|
| Os de teste agora, os reais quando houver e-mails | Os 11 do seed; troca por convite | |
| Só os reais do Financeiro | Maryane, Marcos Paulo, Walter… com e-mails reais | |
| Os 11 do seed, e pronto | — | |

**User's choice:** *(Other)* "Só crie a Maryane"
**Notes:** Com um Membro só, a Maryane nasce Proprietária (B7). Os demais entram por convite (RN-ET-11 / PERS-09). O processo não fecha ponta a ponta nesta fase (falta Aprovador) — aceito.

| Option | Description | Selected |
|--------|-------------|----------|
| O de teste por enquanto (maryane@n1.teste) | Conta já existe no Auth; troca depois sem migração | ✓ |
| O e-mail real dela — eu informo | Cria conta com e-mail real e senha temporária | |

**User's choice:** E-mail de teste por enquanto

---
