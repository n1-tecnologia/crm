# Fase 10 — Provas e decisões do dono

Registro das conferências que só o dono faz (contra produção, no Mac dele) e das escolhas que ele deu com os números à frente. Só nomes de Espaço de Trabalho, Lista e Membro; nenhum título de Tarefa.

## Q3 — lixeira vencida (10-15)

**Decisão do dono (2026-10-29): `direto`.** As Listas que entram no catálogo do relógio SÓ pela lixeira rodam a primeira volta direto, sem ensaio, e a ponte do Agente de lançamento passa a expurgar Contas a pagar e Contas a receber. O dono não informou ter restaurado Tarefas antes de responder.

**Prévia de produção** (`npm run automacoes:previa -w @n1/api`, só leitura), colada pelo dono em 2026-10-29. Versão condensada pelo orquestrador a partir da tabela completa de 86 linhas; as linhas do `ws_n1` e o total estão literais.

```
PREVIA DE PRODUCAO COLADA PELO DONO (Igor) EM 2026-10-29 - `npm run automacoes:previa -w @n1/api` (so leitura).
Nomes de Espaco de Trabalho, Lista e Membro apenas; nenhum titulo de Tarefa.

Colunas: Espaco de Trabalho | Lista | Nome | Entra por | Regime | Ator | Lixeira vencida | Series

== ws_n1 (Espaco real) - linhas literais
ws_n1  lst_contas_a_pagar    Contas a pagar     automacao  ensaio  Agente do pipeline  0  0
ws_n1  lst_contas_a_receber  Contas a receber   automacao  ensaio  Agente do pipeline  0  0
ws_n1  lst_tarkl5            Lista 1            lixeira    direto  Maryane Generozo    0  0
ws_n1  lst_tarkld            Lista do subgrupo  lixeira    direto  Maryane Generozo    0  0

== Demais Espacos (todos de teste/depuracao pelo nome) - mesma forma de 5 Listas cada
Padrao de cada um:
  lst_contas_a_pagar    Contas a pagar        automacao    ensaio  Thiago Nascimento  0  0
  lst_contas_a_receber  Contas a receber      automacao    ensaio  Thiago Nascimento  0  0
  lst_piloto            Piloto de onboarding  lixeira      direto  Thiago Nascimento  N  0
  lst_prospeccao        Prospeccao            lixeira      direto  Thiago Nascimento  M  0
  lst_revisoes          Revisoes              recorrencia  direto  Thiago Nascimento  0  1

Com lixeira vencida (Piloto = 3, Prospeccao = 2; 5 Tarefas por Espaco; 13 Espacos = 65):
  ws_debug_automations
  ws_outbox_1790002249349_te7t5z
  ws_outbox_1790002291927_omse5x
  ws_outbox_1790003023016_1piqto
  ws_outbox_1790003053712_n8hwvy
  ws_outbox_1790003082199_8p285y
  ws_outbox_1790003204554_88m39n
  ws_outbox_1790003250872_a25rdn
  ws_outbox_1790003328681_yo1893
  ws_outbox_1790206152726_hx6qku
  ws_teste_classificacoes_1790201209011_rkgmin
  ws_teste_classificacoes_1790353187334_ws3at4
  ws_teste_integracao_solicitacoes_1790129575792_jyorfo

Com lixeira vencida 0 (mesma forma de 5 Listas, Piloto = 0, Prospeccao = 0):
  ws_spike
  ws_spike_10x
  ws_teste_classificacoes_1792754637371_e6mf4d

Apenas Contas a pagar e Contas a receber (automacao, ensaio, Maryane Generozo, 0, 0):
  ws_teste_importar_sol_1790373466622_3ery4e_ref
  (ws_teste_integracao_solicitacoes_1790129575792_jyorfo aparece com as 5 Listas, ver acima)

== Total (literal)
86 Lista(s) candidata(s). Lixeira vencida (o que a primeira volta real eliminaria): 65 Tarefa(s).
```

**Leitura do orquestrador (não é dado do dono):**

- As 65 Tarefas estão todas em 13 Espaços de teste; no `ws_n1` são 0; em Contas a pagar e Contas a receber são 0 em todos os Espaços.
- Ator no `ws_n1`: Contas a pagar/receber = Agente do pipeline; Lista 1 e Lista do subgrupo = Maryane Generozo (pessoa humana). É o Q1, que continua pendente de confirmação do dono no checkpoint D-04 de 10-16.
