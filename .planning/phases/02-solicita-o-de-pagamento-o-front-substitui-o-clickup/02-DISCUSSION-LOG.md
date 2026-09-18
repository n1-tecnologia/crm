# Phase 2: Solicitação de pagamento — o front substitui o ClickUp - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-18
**Phase:** 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
**Areas discussed:** Entrada da Solicitação, Aprovação e roteamento, Fronteira com `automation/`, Histórico e paralelo

---

## Entrada da Solicitação

| Option | Description | Selected |
|--------|-------------|----------|
| Formulário público existente | `/f/<segredo>` e `submitForm`; solicitante não precisa ser Membro | ✓ |
| Exigir login | Todo solicitante precisaria virar Membro | |
| Criar uma entrada financeira separada | Novo fluxo fora da ontologia de Tarefa | |

**User's choice:** decisão previamente registrada no checkpoint; posteriormente o usuário delegou todas as decisões restantes ao Claude.
**Notes:** O Formulário público é o caminho principal; criação direta por Membro continua possível e produz a mesma Tarefa. Ator `sistema/Formulário`, dono como contexto de permissão, Storage privado e confirmação sem acompanhamento público.

---

## Aprovação e roteamento

| Option | Description | Selected |
|--------|-------------|----------|
| Solicitação de Aprovação nativa | Clique no CRM N1, ligada à Tarefa e independente de Execução de Agente | ✓ |
| Manter somente classificador | Resposta textual continuaria sendo o caminho oficial | |
| Implementar aprovação no `automation/` | Duplicaria regra e interface fora da plataforma | |

**User's choice:** decisão previamente registrada no checkpoint; posteriormente o usuário delegou todas as decisões restantes ao Claude.
**Notes:** Roteamento configurável por Centro de Custo/Valor; comentário com Menção preservado; decisão por clique escreve resposta canônica no tópico. Fallback por comentário durante 90 dias. Sem timeout/lembrete inventado; divergência bloqueia salvo Fluxo Manual explícito.

---

## Fronteira com `automation/`

| Option | Description | Selected |
|--------|-------------|----------|
| Mesma VPS + HTTP contratado + filas persistentes | Menor salto operacional, contrato testável, outbox e replay idempotente | ✓ |
| Hosting gerenciado separado | Mais isolamento, porém adiciona rede e operação antes do adapter | |
| SQL direto entre sistemas | Viola a fronteira do domínio e os dois projetos Supabase | |

**User's choice:** “Pode tomar todas as decisões por mim.”
**Notes:** `apps/api` na VPS do `automation/`, nginx, TLS e credencial de serviço; contrato v1 dos sete métodos; outbox mínimo como semente da Fase 3; fila persistente no adapter; sem mover o repositório.

---

## Histórico e paralelo

| Option | Description | Selected |
|--------|-------------|----------|
| Importação idempotente + coortes por origem | Histórico reconciliado e ensaio sem duplicar uma obrigação no Omie | ✓ |
| Double-write da mesma Solicitação | Aumenta risco de lançamento duplicado e confunde fonte da verdade | |
| Corte imediato sem ensaio | Menos trabalho, sem prova de paridade operacional | |

**User's choice:** “Pode tomar todas as decisões por mim.”
**Notes:** Fonte histórica é `solicitacoes_pagamentos`; credenciais descartadas; anexos migram para Storage privado; duas semanas com coortes separadas; corte por gates objetivos; rollback só para novas entradas, sem sincronização reversa.

---

## Claude's Discretion

- D11: mesma VPS do `automation/`, conforme recomendação já existente.
- D9: manter `aprovado`, seguindo a spec real mais recente e não a recomendação preliminar do roadmap.
- OQ-SYN-02: outbox/evento mínimo agora, motor genérico somente na Fase 3.
- L-01: conversão estruturada para Conta a pagar adiada à Fase 3; a Fase 2 termina em Solicitação aprovada.
- L-03: divergência bloqueante, exceto Fluxo Manual explícito e auditado.
- L-07: nenhuma cobrança ou expiração automática sem evidência; pendência fica visível.
- L-09: 90 dias contados do go-live e data registrada no deploy.
- L-11: Revisor do RESUMO como configuração de papel/processo, não ids fixos no adapter.
- OQ-PLAN-01: manter a divisão ontologia × telas portadas definida por DEC-16.

## Deferred Ideas

- Lembretes e escalonamento de aprovação.
- Motor genérico de Automações.
- Conversão estruturada Solicitação → Conta a pagar.
- Migração do `automation/` para o monorepo.
