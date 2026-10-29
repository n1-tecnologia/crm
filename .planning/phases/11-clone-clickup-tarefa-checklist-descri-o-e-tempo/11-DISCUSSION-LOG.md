# Phase 11: Clone ClickUp: Tarefa (checklist, descrição e tempo) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-29
**Phase:** 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
**Areas discussed:** Converter item do checklist, Menção na descrição avisa a pessoa?, Tempo registrado (o que a Tarefa mostra), Histórico da descrição (texto anterior)

---

## Converter item do checklist

### 2.4.3 — Confirmação ao converter

| Option | Description | Selected |
|--------|-------------|----------|
| Um clique, com aviso (Recomendado) | Confirmação simples dizendo que não há volta, botão "Converter" na cor normal, sem digitar nada | ✓ |
| Manter digitar o nome do item | Como hoje: digitar o texto inteiro do item para liberar o botão | |
| Converter direto, sem confirmação | Um clique converte; um clique errado deixa uma Subtarefa a mais | |

**User's choice:** Um clique, com aviso (Recomendado)

### 2.4.4 — Subitens de checklist

| Option | Description | Selected |
|--------|-------------|----------|
| Deixar de fora (Recomendado) | Tira o subitem do modelo e a migração de subitens da conversão; checklist de um nível só (~1 hora) | ✓ |
| Criar subitens de verdade | Checklist aceita subitem recuado e ele também vira Subtarefa (~1 dia) | |

**User's choice:** Deixar de fora (Recomendado)

### 2.4.5 — Converter pelo cartão do Quadro

| Option | Description | Selected |
|--------|-------------|----------|
| Não, só com a Tarefa aberta (Recomendado) | A pessoa precisa ver o item no contexto; não custa nada | ✓ |
| Sim, menu no cartão | Menu com os itens do checklist e "Converter em Subtarefa" (~meio dia) | |

**User's choice:** Não, só com a Tarefa aberta (Recomendado)
**Notes:** Passou para a próxima área sem aprofundar.

---

## Menção na descrição avisa a pessoa?

### 2.6.7 — O aviso

| Option | Description | Selected |
|--------|-------------|----------|
| Avisa enquanto o nome estiver lá (Recomendado) | Aparece em "Menções a você" enquanto o nome estiver na descrição e a Tarefa estiver aberta; sem estado novo (~2 h) | ✓ |
| Não avisa, só destaca o nome | A menção só pinta o nome | |

**User's choice:** Avisa enquanto o nome estiver lá (Recomendado)

### Como o aviso sai da lista

| Option | Description | Selected |
|--------|-------------|----------|
| Só por conta própria (Recomendado) | Some quando a Tarefa fecha, sai da lista ou o nome sai da descrição; sem botão, sem estado novo | ✓ |
| Botão "Dispensar" para cada pessoa | Cada Membro marca "já vi"; exige dado novo e custa mais que as 2 h | |

**User's choice:** Só por conta própria (Recomendado)
**Notes:** Passou para a próxima área sem aprofundar.

---

## Tempo registrado (o que a Tarefa mostra)

### Número mostrado quando há Subtarefas com tempo

| Option | Description | Selected |
|--------|-------------|----------|
| O da Tarefa, e o total ao lado (Recomendado) | "75 min" e, só se alguma Subtarefa tem tempo, "95 min com Subtarefas" | ✓ |
| Só o da Tarefa | "75 min"; o tempo das Subtarefas só abrindo cada uma | |
| Sempre o total com Subtarefas | "95 min" na Tarefa mãe | |

**User's choice:** O da Tarefa, e o total ao lado (Recomendado)

### Cronômetro rodando

| Option | Description | Selected |
|--------|-------------|----------|
| Fechados + "em andamento" (Recomendado) | Soma só os fechados e ganha a etiqueta "em andamento"; o domínio não depende do relógio | ✓ |
| Somar o tempo corrido ao vivo | O número cresce a cada minuto; Painéis e IA veriam números que mudam a cada leitura | |

**User's choice:** Fechados + "em andamento" (Recomendado)
**Notes:** Passou para a próxima área sem aprofundar.

---

## Histórico da descrição (texto anterior)

### Onde abre o "Ver alteração"

| Option | Description | Selected |
|--------|-------------|----------|
| Abre ali mesmo, embaixo da linha (Recomendado) | A linha se expande com o texto anterior e o novo, um embaixo do outro | ✓ |
| Abre numa janela | Janela sobre a Tarefa; melhor para textos longos, mas interrompe a leitura | |

**User's choice:** Abre ali mesmo, embaixo da linha (Recomendado)

### Edições antigas (sem texto anterior)

| Option | Description | Selected |
|--------|-------------|----------|
| Como hoje, sem botão (Recomendado) | Linha antiga fica só "Descrição alterada"; botão apenas nas edições novas | ✓ |
| Botão com aviso "texto não guardado" | Toda linha ganha o botão; nas antigas ele explica que o texto não foi guardado | |

**User's choice:** Como hoje, sem botão (Recomendado)

### Quem vê o texto anterior

| Option | Description | Selected |
|--------|-------------|----------|
| Quem vê a Tarefa (Recomendado) | A mesma regra de todo o histórico, como o título; sem regra nova | ✓ |
| Só quem pode editar a Tarefa | Leitores e Convidados veem "Descrição alterada" sem o botão | |

**User's choice:** Quem vê a Tarefa (Recomendado)
**Notes:** O dono foi avisado de que um dado sensível apagado da descrição continua no histórico, e aceitou.

---

## Itens da 2.7 (testes) sobre a Tarefa

**User's choice:** Nenhum por enquanto.

## Claude's Discretion

- Nomes de módulos, esquemas e testes; onde mora o componente da descrição com o nome destacado.
- Textos exatos (confirmação, aviso com "Abrir", trecho em Notificações, "em andamento", "N min com Subtarefas").
- Formato do número de tempo (mesmo formatador na linha e no editor).
- Rótulos dos dois blocos de "Ver alteração" e o destaque visual do nome mencionado.
- Forma da união que `pendingMentions` devolve; recalcular `descriptionMentions` na escrita ou filtrar na leitura.
- Se `convertChecklistItem` mantém o parâmetro `parentTaskId`.
- Quantos planos e em que ondas.

## Deferred Ideas

- Menção a Equipe, Agente, Tarefa, Contato, Empresa, Negócio, Conversa ou Documento de Conhecimento na descrição (RN-TAR-14).
- Subitens de checklist (voltariam como trabalho novo, ~1 dia).
- Converter pelo cartão do Quadro (~meio dia).
- Botão "Dispensar" na menção da descrição.
- Restringir "Ver alteração" a quem edita.
