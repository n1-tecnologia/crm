# Phase 5: Contas a receber e os outros tenants - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 5-contas-a-receber-e-os-outros-tenants
**Areas discussed:** Ordem das três entregas, O portão D7, Onde mora a credencial Omie, Clonagem de serviço, Status `em revisão` e prefixos do FO, AUTO-02, As perguntas de §12 que D7 não gate
**Modo:** `--auto` — o dono autorizou explicitamente ("pode tomar todas as decisões, tá liberado por mim"). Uma decisão **não** foi tomada por mim de propósito: D7 é fato sobre o mundo, não escolha de desenho — ver abaixo.

---

## Ordem das três entregas

| Opção | Descrição | Selected |
|--------|-------------|----------|
| TEN-01 → AUTO-02 → REC-01 | O desbloqueado primeiro; o bloqueado por último | ✓ |
| REC-01 primeiro | Segue a ordem do nome da fase | |
| Só TEN-01 nesta fase; REC-01 vira fase 6 | Separa o bloqueado | |

**Escolha:** TEN-01 → AUTO-02 → REC-01 (D5-01).
**Notas:** TEN-01 é o que aposenta o ClickUp de vez (as duas Listas que sobram são de MP e FO) e não depende de ninguém. Contas a receber está dormente desde out/2025 — o item menos urgente e o único bloqueado; pô-lo no caminho crítico do item que termina a migração seria escolher o pior. A terceira opção fica em aberto e é decidida com a resposta de D7 em mãos.

---

## O portão D7

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Plano de evidência + uma pergunta, com checkpoint bloqueante e default declarado | Não para a fase; o default é o ramo que não fecha porta | ✓ |
| Decidir D7 por conta própria | Rápido, mas é inventar fato | |
| Bloquear REC-01 até a resposta | Honesto, mas deixa a fase pela metade sem necessidade | |

**Escolha:** checkpoint bloqueante com default declarado (D5-02).
**Notas:** D7 pergunta *onde o recebimento é controlado hoje* — isso é fato sobre a operação do Financeiro, não escolha de arquitetura, e nenhuma autorização me dá acesso a ele. O que dá para fazer, e foi feito, é reunir a evidência e declarar o default: **ramo processo**, porque (a) `createReceivableSeries` já existe e está testada em `financeiro.ts:537`, (b) `grep -n "Receber" adapters/omie.ts` dá **zero** — o ramo espelho exigiria superfície Omie nova, e (c) uma Lista com processo absorve um espelho depois, o contrário não. Nota lateral que o plano de evidência deve investigar: `contas_a_receber` tem 10 linhas e **nada no `automation/` as escreve** — o espelho foi populado por fora (n8n legado, provavelmente).

---

## Onde mora a credencial Omie de cada Empresa

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Integração guarda o rótulo da conta; segredo fica no `automation/` | A plataforma nunca chama o Omie, então nunca precisa do segredo | ✓ |
| Integração guarda `app_key`/`app_secret` cifrados no schema `plataforma` | Leitura literal de "credencial só na Integração" | |

**Escolha:** rótulo na Integração, segredo onde o código que o usa mora (D5-03).
**Notas:** o contraste que o requisito faz é com **credencial por linha** (`solicitacoes_pagamentos.app_key`, `transacoes.api_key`) — é isso que precisa morrer. Guardar o segredo na plataforma significaria mandá-lo por HTTP a cada lançamento, já que quem fala com o Omie é o `automation/` (03-07/03-11); seria mais exposição, não menos. A Integração continua sendo onde se vê *que* a Empresa tem conta, qual, e quando foi rotacionada.

---

## Clonagem de serviço

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Não-clonar do lado da plataforma; `automation/` mantém os três serviços | Uma Lista com Campo `Empresa` em vez de três Listas | ✓ |
| Consolidar os três `payment-automation-service.ts` num só | Leitura literal de "sem clonar serviço" | |

**Escolha:** não-clonar na plataforma (D5-04).
**Notas:** os três serviços somam 5.880 linhas quase iguais; refatorá-los é cirurgia de alto risco no repositório que CON-05 manda manter com o mesmo `git log`, e o plano §3 não pede isso — pede que as regras de cada `config.ts` virem configuração por Empresa, *para que a plataforma não clone*. Consolidar o `automation/` é território de D12 e fica adiado.

---

## Status `em revisão` e os prefixos do Family Office

| Opção | Descrição | Selected |
|--------|-------------|----------|
| 5º Status na Lista única; transição declarada por Empresa na Automação | Absorve o FO sem clonar Lista | ✓ |
| Uma Lista por tenant, cada uma com o seu Conjunto | Isola, mas é a clonagem que D5-04 recusa | |

**Escolha:** 5º Status (D5-06).
**Notas:** D-01 travou quatro Status "nesta fase" e mandou não criar `em revisão`; esta é a fase em que o FO chega e o usa. Como Conjunto de Status é da Lista, os cinco valem para todas as Empresas, mas só quem o declara na configuração chega lá — TRIA nunca o alcança. Os prefixos numéricos (`01-`, `02-`) existem porque o ClickUp ordena campo por nome; a plataforma lê `fieldValues` por id, então morrem com o ClickUp (D5-05).

---

## AUTO-02 — notificar por Canal

| Opção | Descrição | Selected |
|--------|-------------|----------|
| Entrega pelo `automation/` (Evolution), escopo = o que o MP já faz | Nenhuma credencial de terceiro na plataforma | ✓ |
| Plataforma chama a Evolution API direto | Menos um salto | |
| Adiar AUTO-02 | "Prioridade a confirmar" no requisito | |

**Escolha:** pelo `automation/`, escopo pequeno (D5-09, D5-11).
**Notas:** mesma regra de D-17 e D4-01 — a plataforma não guarda credencial de terceiro nem faz chamada externa que já tem casa. Sobre a prioridade: entra, porque o tenant que usa o canal é justamente o que está chegando nesta fase; entra pequeno, porque nada além do aviso de gasto e do relatório foi observado. Destino é o Campo `Z WhatsApp`, e vazio é recusa visível — nunca um número padrão (D5-10).

---

## As perguntas de contas-a-receber §12 que D7 não gate

| Pergunta | Decisão | Onde |
|---|---|---|
| Cliente = Tarefa em outro Espaço? | Contato (PF) ou Empresa (CNPJ) do CRM; "Gestão de clientes" não é recriada | D5-12 |
| `disponível para saque` e `estornado`, nunca usados | O primeiro fica (dá sentido ao Saque, R7); o segundo vira Motivo dentro de `descartado` | D5-13 |
| Valor dos Saques, todos `0` | Passa a exigir > 0; históricos entram como lacuna registrada | D5-14 |
| Prazos de 30/60 dias em R4/R5 | Configuração da Automação, não número no código; 30/60 é valor inicial com procedência anotada | D5-15 |
| Data de pagamento vs `date_closed` | Data de pagamento; `date_closed` só fallback | D5-16 |
| Tag `conta tria` | Vira Campo "Conta de recebimento" | D5-17 |
| Duplicatas (RN-CR-07) e a subtarefa indevida (RN-CR-06) | Lacuna registrada sem fusão automática; Subtarefas desabilitadas na Lista | D5-18 |

**Notas:** todas foram resolvidas no sentido que a própria spec §12 sugere, e nenhuma depende de D7 — são verdade nos dois ramos. Isso é o que permite planejar REC-01 agora e só ramificar no fim.

## Claude's Discretion

- Como a configuração por Empresa é modelada, desde que o segredo fique fora e a regra saia do `config.ts`.
- Divisão dos planos e ondas; quantos planos cada entrega recebe.
- Forma da rota e do payload do canal WhatsApp.
- Layout das telas de Contas a receber.
- Se REC-01 cabe inteiro nesta fase — decidir com D7 respondida.

## Deferred Ideas

- Consolidar os três `payment-automation-service.ts` (D12).
- Canal como capacidade genérica de qualquer Automação.
- Reabrir o caminho FINQ de `payment-rules.ts` (D3-01).
- Gestão contratual como Lista (o gatilho "correto" de R1).
- Go High Level — precisa de inventário próprio.
- Limpeza das 13 tabelas vetoriais e das 7 views `_v`.
- Mover o `automation/` para o monorepo (D12).
