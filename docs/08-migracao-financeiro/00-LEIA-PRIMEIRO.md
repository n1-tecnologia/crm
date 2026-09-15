# Migração do Financeiro Tria para a plataforma — leia primeiro

**Levantamento:** 2026-09-15, lido do código dos dois repositórios — `financeiro-tria` (commit `9274067`, 89 mudanças não commitadas) e `crm-n1` (commit `027d603`, separado em `apps/web`, `apps/api`, `packages/dominio`).
**Plano:** versão 2. A v1 presumia reescrever o backend dentro de `apps/api`; a decisão foi outra, e melhor.

## A decisão que define tudo

> **O backend do financeiro-tria continua exatamente como está** — mesmo código, mesmo banco, mesmas variáveis, mesmo deploy. O que muda é o **front**: o CRM N1 vira a interface única, substituindo o ClickUp **e** o painel atual do financeiro-tria.

O que falta no CRM N1 para isso, a gente constrói. O que precisar de tabela nova nasce num **schema `plataforma`** novo, no mesmo Supabase, sem encostar nas 26 tabelas legadas do `public`.

## O que esta pasta é

| Arquivo | Pergunta que responde |
|---|---|
| [01-inventario-financeiro-tria.md](01-inventario-financeiro-tria.md) | O que existe hoje no financeiro-tria — tudo, peça por peça |
| [02-comparativo-com-a-plataforma.md](02-comparativo-com-a-plataforma.md) | O que a plataforma já tem, o que bate, o que não bate, o que falta |
| [03-plano-de-migracao.md](03-plano-de-migracao.md) | Arquitetura-alvo, 6 fases, complexidade, riscos |

Leia nesta ordem. O plano só faz sentido depois do comparativo, e o comparativo depois do inventário.

## As cinco descobertas que sustentam o plano

**1. O acoplamento com o ClickUp é uma costura de 7 métodos num arquivo de 132 linhas.**
As 1.928 linhas do pipeline (× 3 tenants) nunca chamam a API do ClickUp — tudo passa por `clickUpAdapter`, e todo método já degrada sozinho sem token. Trocar `adapters/clickup.ts` por um `adapters/plataforma.ts` que fala com o CRM N1 mantém validação, roteamento, IA, RAG e Omie **sem uma linha alterada**. É o plano inteiro em uma frase.

**2. O ClickUp não é só o gatilho — é a interface.** Dos 7 métodos: `getTask` é o formulário, `createComment` (9 usos) é como o backend fala com as pessoas, `getCommentReplies` é a decisão do aprovador voltando, `updateTaskStatus` é o progresso visível. É exatamente isso que o novo front precisa oferecer — e é exatamente o que o CRM N1 já sabe fazer com Lista, Tarefa, Status e Comentário.

**3. Os dois sistemas automatizam processos diferentes e consecutivos.**
O financeiro-tria cobre a **Solicitação de pagamento** (Lista `901109104938`): pedido nasce, valida prazo e documento, roteia aprovador, IA classifica, RAG concilia, lança no Omie. A plataforma modela a **Conta a pagar** (Lista `901107637383`): cobra nota, lança, remessa, autorização, pago, recorrência. Nenhum cobre o outro; encontram-se no `📋 RESUMO DE PAGAMENTO`, idêntico nos dois códigos. Substituir o ClickUp é ter os dois no mesmo front.

**4. O mapper encolhe em vez de crescer.**
`clickup-payment-mapper.ts` gasta ~400 linhas com as esquisitices do ClickUp — dropdown por `type_config.options`, `url_w_query` de anexo, 30 rótulos embutidos no texto da descrição. Contra uma Tarefa tipada da plataforma, viram ~50 linhas. A troca **apaga** código.

**5. O CRM N1 está mais adiantado do que parece — mas em memória.**
`docs/07-processos/` foi escrito lendo as Listas reais (200+ e 240 Tarefas). O domínio tem Contas a pagar e a receber inteiras (1.036 l. de seed, 469 l. de operações, 214 testes verdes), o formato exato do RESUMO, o Agente de lançamento, as Automações A1–A9 e R1–R7, e uma tela de 1.038 linhas. Falta **persistência e login** — é a Fase 1, e é o que faz o CRM N1 deixar de ser protótipo.

## Arquitetura-alvo em cinco linhas

- `apps/web` (CRM N1) é o front único, modelado pela ontologia.
- `apps/api` é o backend **do CRM**, dono do schema `plataforma`.
- `automation/` continua na VPS, dono do schema `public`, **intacto** fora de um arquivo.
- Os dois se encontram pelo `adapters/plataforma.ts`, que chama `apps/api` por HTTP — nunca SQL direto, senão Registro de Atividade e Requisito de saída seriam pulados.
- Telas que substituem o ClickUp usam a ontologia; ferramentas que nunca viveram nele (Notas fiscais, Produtos, Plano de contas, Extratos) leem a API do `automation/` direto.

## Custo

**11–14 semanas** de uma pessoa. Os dois itens grandes — persistência e motor de Automações — não são custo do Financeiro: são o custo de o CRM N1 virar produto, pagos uma vez e aproveitados por CRM, Estrutura e o resto.

## O que ainda está em aberto

- **A Solicitação de pagamento não tem especificação.** Contas a pagar e a receber têm spec lida da Lista real; a Solicitação foi reconstruída por mim a partir do código, que mostra o que está automatizado, não o que as pessoas fazem. **É o maior risco do plano** e a primeira tarefa da Fase 0.
- **Onde o recebimento é controlado hoje** (D7) — a Lista está dormente desde out/2025.
- **Go High Level** — zero menção em qualquer um dos repositórios. Precisa de inventário próprio, feito da conta, não do código. Fora deste plano.
