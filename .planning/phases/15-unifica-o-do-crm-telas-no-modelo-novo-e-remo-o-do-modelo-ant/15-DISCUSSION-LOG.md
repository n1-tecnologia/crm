# Phase 15: Unificação do CRM: telas no modelo novo e remoção do modelo antigo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-05
**Phase:** 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
**Areas discussed:** Migração e o dado de produção, Pendências da Fase 14 e o que volta à tela, Caixa de Entrada e o fio da Conversa, Espaço novo / seed e demonstração

---

## Migração e o dado de produção

### Os 17 Espaços de teste

| Option | Description | Selected |
|--------|-------------|----------|
| Só o ws_n1 migra (Recomendado) | Linhas antigas dos 17 vão para registros_crm_antigo e saem de registros, sem virar CRM novo; nenhum Espaço é apagado; modo "só guardar" no script | ✓ |
| Todos os 18 migram igual | Mesmo script para todos; prova em escala, mas dado de teste entra nas tabelas de produção | |
| Só o ws_n1 migra e os 17 Espaços são apagados | Limpa produção, mas apaga Espaços inteiros; rede é o backup | |

**User's choice:** Só o ws_n1 migra.

### Rede de segurança do corte

| Option | Description | Selected |
|--------|-------------|----------|
| Backup + cópia no banco (Recomendado) | Backup manual provado e registros_crm_antigo; sem comando de desfazer | ✓ |
| Escrever um script de desfazer | Devolve registros_crm_antigo para registros; cerca de +1 dia | |
| Manter as linhas em registros por um tempo | Copia sem apagar e o hidratar ignora as coleções antigas | |

**User's choice:** Backup + cópia no banco.

### Janela do deploy

| Option | Description | Selected |
|--------|-------------|----------|
| Janela combinada (Recomendado) | Aviso à equipe, horário combinado, ordem backup, --seco, dados, API, web | ✓ |
| Sem janela | Publica quando estiver pronto | |
| Modo manutenção | API responde "em manutenção"; cerca de +0,5 dia | |

**User's choice:** Janela combinada.

### Funil do ws_n1

| Option | Description | Selected |
|--------|-------------|----------|
| É de verdade, migra | Funil e Etapas vão para plataforma.funis e etapas e viram o padrão | |
| É do seed, não migra | Fica só na cópia; Funil padrão criado do zero | |
| Não sei, o --seco mostra primeiro (Recomendado) | O relatório lista o Funil e as Etapas antes de qualquer escrita | ✓ |

**User's choice:** Não sei, o --seco mostra primeiro.

---

## Pendências da Fase 14 e o que volta à tela

### Empresa, qualificação, estado e Atribuído na Tarefa

| Option | Description | Selected |
|--------|-------------|----------|
| Voltam os quatro (Recomendado) | O resumo em lote passa a trazê-los | ✓ |
| Só estado e Atribuído da Conversa | Empresa e qualificação ficam só na ficha do Contato | |
| Nenhum, fica para a Sessão 5 | A Sessão 5 refaz o cartão | |

**User's choice:** Voltam os quatro.

### Temperatura do Contato

| Option | Description | Selected |
|--------|-------------|----------|
| Some até uma sessão própria (Recomendado) | Entra na lista da D-04; fica só em registros_crm_antigo; sem migração 012 | ✓ |
| Migração 012 traz a coluna | contatos.temperatura; cerca de +1 dia | |

**User's choice:** Some até uma sessão própria.
**Notes:** Achado durante a discussão: `temperatura` não existe na 007 nem na 011, e a D-04 da Fase 14 não a listava entre o que some.

### Dívida da revisão de código da Fase 14

| Option | Description | Selected |
|--------|-------------|----------|
| Primeiro plano corrige tudo isso (Recomendado) | WR-01, 02, 05, 06, describeComBanco e instantiateListTemplate | ✓ |
| Só os que quebram (WR-02, WR-06) e o teste | WR-01 e WR-05 ficam abertos | |
| Nenhum agora, só o que a 3.5.4 exigir | Só o instantiateListTemplate | |

**User's choice:** Primeiro plano corrige tudo isso.

### Suposições da Fase 14 a mudar (multi-seleção)

| Option | Description | Selected |
|--------|-------------|----------|
| Conversas do Membro removido passam ao Sucessor | Reverte OQ2/A8 | ✓ |
| Atividade dos gestos novos do CRM | Tabela de Atividade do CRM novo, plano próprio | ✓ |
| Mesclar pede digitar o nome | Um campo a mais no diálogo | ✓ |
| Nenhuma, ficam como estão | | ✓ (contraditória) |

**User's choice:** As 3 mudanças valem.
**Notes:** A primeira resposta marcou as três mudanças e também "Nenhuma"; foi perguntado de novo e o dono confirmou as três mudanças.

---

## Caixa de Entrada e o fio da Conversa

### Rascunho de resposta

| Option | Description | Selected |
|--------|-------------|----------|
| Pode sumir até a Sessão 16 (Recomendado) | O ws_n1 não tem Conversa antiga | ✓ |
| Criar rascunho no modelo novo agora | Tabela e rotas; cerca de +1 dia | |

**User's choice:** Pode sumir até a Sessão 16.

### Popup "adicionar Canal" das Listas

| Option | Description | Selected |
|--------|-------------|----------|
| Leva à página de conectar (Recomendado) | O popup lista os Canais e linka a página de conexão | ✓ |
| Continua criando, mas desconectado | Chama criarCanal do modelo novo | |

**User's choice:** Leva à página de conectar.

---

## Espaço novo, seed e demonstração

### Como o Espaço novo nasce

| Option | Description | Selected |
|--------|-------------|----------|
| Vazio, o dono cria o primeiro (Recomendado) | Sem Funil padrão; telas mostram "crie seu primeiro Funil" | ✓ |
| Nasce com um Funil padrão básico | Precisa de nome e Etapas | |

**User's choice:** Vazio, o dono cria o primeiro.

### Pasta "Meus negócios" já existente no ws_n1

| Option | Description | Selected |
|--------|-------------|----------|
| O script remove se estiver vazia (Recomendado) | Se houver Tarefa espelho de Negócio, não apaga e lista no --seco | ✓ |
| Fica e você apaga à mão | O script não toca na Pasta | |
| Move para o quadro novo e apaga sempre | Perde a Tarefa espelho se houver | |

**User's choice:** O script remove se estiver vazia.

---

## Claude's Discretion

- Ordem e corte em planos (com as restrições de ordem registradas no CONTEXT.md).
- Nomes de rotas e hooks, paginação, forma das funções de leitura.
- Reescrita de testes e fixtures que dependem de `buildSeed()` com o CRM antigo; formato do `bootstrap:crm-demo`.
- Ids antigos em bookmarks, reescrita de ids em `registros`, relatório de não migrados, textos de telas vazias.

## Deferred Ideas

- Temperatura do Contato; Tags, vários Contatos por Negócio, histórico de Etapas, Requisitos e Anexos.
- Rascunho de Conversa (Sessão 16).
- Conversa de Grupo e Mensagens de Flow nas tabelas (Sessões 6 e 7).
- Homologação e backup diário.
- Modo manutenção e script de desfazer (descartados).
- Apagar os 17 Espaços de teste de produção.
