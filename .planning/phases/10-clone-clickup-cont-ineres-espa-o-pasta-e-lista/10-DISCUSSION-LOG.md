# Phase 10: Clone ClickUp: Contêineres (Espaço, Pasta e Lista) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-28
**Phase:** 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
**Areas discussed:** Recorrência sem o botão, Abas e Visualizações padrão, Mover e ordenar na árvore, Carga e capacidade

---

## Recorrência sem o botão (2.1.1–2.1.3)

### Quem faz nascer a Tarefa recorrente por calendário quando o botão sair?

| Option | Description | Selected |
|--------|-------------|----------|
| A) O servidor cuida (Recomendado) | O agendador passa a visitar também as Listas com recorrência por calendário e as com Tarefa vencida na lixeira; traz meio dia da 19.1 para cá | ✓ |
| B) Botão só no menu "…" | Sai da barra, fica no menu da Lista para quem administra até a Sessão 19 | |
| C) Tirar e aceitar a pausa | Recorrência por calendário fica parada nessas Listas até a Sessão 19 | |

**User's choice:** A) O servidor cuida
**Notes:** Não foi possível contar em produção as Listas que dependem do botão (conector do Supabase do claude.ai está na organização errada).

### Primeira volta das Listas que só têm recorrência por calendário

| Option | Description | Selected |
|--------|-------------|----------|
| Nascem direto (Recomendado) | Pula o ensaio nessas Listas; Listas com Automação por vencimento mantêm o ensaio | ✓ |
| Ensaio, você libera | Mesma regra de hoje para todas, com o comando de liberação por Lista | |

**User's choice:** Nascem direto

### O agendador está ligado em produção? (2.1.3)

| Option | Description | Selected |
|--------|-------------|----------|
| Está ligado | A 2.1.3 vira uma conferida no log | |
| Não sei | Passo do dono com comando pronto; o botão só sai depois da confirmação | ✓ |
| Está desligado | Ligar vira pré-requisito de sair com o botão | |

**User's choice:** Não sei

---

## Abas e Visualizações padrão (2.1.7, 2.6.1, 2.6.2)

### O que fazer com as abas Lista e Tabela?

| Option | Description | Selected |
|--------|-------------|----------|
| A) Manter as duas (Recomendado) | Nada muda; Tabela vira planilha depois, se sentir falta dos Campos | ✓ |
| B) Tirar a aba Tabela | Uma hora; salvas do tipo Tabela abrem na Lista | |
| C) Tabela vira planilha | ~1,5 dia; uma coluna por Campo, editável na célula | |

**User's choice:** A) Manter as duas

### Visualização salva de um tipo que o Espaço tirou

| Option | Description | Selected |
|--------|-------------|----------|
| Some da barra, volta junto (Recomendado) | Guardada intacta, não aparece enquanto o tipo estiver indisponível, reaparece se voltar | ✓ |
| Espaço não deixa tirar | Recusa enquanto houver salva do tipo abaixo, listando as Listas | |
| Continua aparecendo | A salva segue na barra mesmo fora da lista do Espaço | |

**User's choice:** Some da barra, volta junto

---

## Mover e ordenar na árvore (2.3)

### Pastas e Listas na ordem

| Option | Description | Selected |
|--------|-------------|----------|
| Dois grupos (Recomendado) | Pastas em cima, Listas embaixo; reordena só dentro do grupo; sem migração de ordem | ✓ |
| Tudo misturado | Mesma sequência, como no ClickUp; exige unificar a ordem na migração e redesenhar páginas | |

**User's choice:** Dois grupos
**Notes:** Corrige o documento de tarefas (2.3.2 falava em permutação de "Pastas e Listas do mesmo pai"): `reorderContainers` recebe o grupo.

### O gesto de arrastar e os Espaços

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, Espaços também (Recomendado) | Mesma regra de reordenar para a lista de Espaços | ✓ |
| Só Pastas e Listas | Ordem dos Espaços continua a de criação | |

**User's choice:** Sim, Espaços também

### Soltar sem consequência

| Option | Description | Selected |
|--------|-------------|----------|
| Move na hora (Recomendado) | Aviso após mover; diálogo só com consequência (Conjunto de Status ou Campos) | ✓ |
| Sempre confirma | Todo arrastar para dentro abre "Mover X para Y?" | |

**User's choice:** Move na hora

---

## Carga e capacidade (2.5.5)

### Capacidade semanal do Membro

| Option | Description | Selected |
|--------|-------------|----------|
| A) Sai junto (Recomendado) | Tira campo, operação, editor e coluna; valor já gravado é ignorado | ✓ |
| B) Fica | Coluna e editor continuam para uso futuro | |

**User's choice:** A) Sai junto

---

## Fechamento

O dono escolheu "Pronto para o contexto": sem itens novos para a 2.7. Bloqueio de aspecto, limpeza das telas e aplicação da `010` seguem o documento de tarefas e o padrão das Fases 7 e 8.

## Claude's Discretion

Nomes de módulos, esquemas e testes; classificação dos pares no agendador (D-02); desenho das zonas de soltura da árvore; textos dos avisos e recusas; divisão em planos e ondas respeitando a ordem interna.

## Deferred Ideas

- Tabela como planilha (se sentir falta dos Campos nos testes)
- Pastas e Listas misturadas na mesma ordem
- Confirmação em todo arrastar
