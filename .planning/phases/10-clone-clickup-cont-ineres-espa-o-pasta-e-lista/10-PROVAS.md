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

**Implementado para a escolha `direto` (10-15, Task 3):** a lixeira entra no catálogo do worker (`candidatosDaLixeira`, `scheduler-worker.ts`); a Lista que entra só pela lixeira fecha a primeira volta `concluido` sem ensaio e elimina o que passou da retenção (`regimeDaPrimeiraVolta` segue devolvendo `direto` para ela; só a Lista com Automação por vencimento mantém o ensaio); a `rodarAgenda` da ponte do Agente de lançamento compõe os três relógios por `agendaDoDia`, com as opções da ponte repassadas à Lista dela. Provado contra Postgres local em `scheduler-worker.test.ts` (z1-z3) e `invocar-agente.test.ts` (F4).

## D-04 — agendador em produção (10-16)

Registro parcial em 29/10/2026. Falta o passo 5 (voltas de 30/10).

**Passo 2 — `api.env` da VPS** (`/opt/n1-crm/shared/api.env`, colado pelo dono; só as linhas do agendador):

| Variável | Valor | Esperado |
|---|---|---|
| `AUTOMACOES_WORKER_ATIVO` | `true` | `true` ✓ |
| `AUTOMACOES_ESPACO_ID` | `ws_n1` | `ws_n1` ✓ (fecha a exposição do MEDIUM-08 da revisão em produção) |
| `AUTOMACOES_LISTA_ID` | vazio | vazio ✓ |
| `AUTOMACOES_ATOR_MEMBER_ID` | vazio | vazio ✓ |
| `AUTOMACOES_ENSAIO_PRIMEIRA_VOLTA` | `true` | registrar ✓ |
| `AGENTE_CONTAS_A_PAGAR_ATIVO` | ausente do arquivo | registrar ✓ — ausente = desligado (`src/index.ts:127` só liga com `"true"`); a ponte do Agente não é registrada e o worker roda recorrência e lixeira pelo caminho próprio |

**Passo 4 — prévia de produção** (`npm run automacoes:previa -w @n1/api -- ws_n1`, 29/10):

| Lista | Entra por | Regime | Ator | Lixeira vencida |
|---|---|---|---|---|
| Contas a pagar | automação | ensaio | Agente do pipeline | 0 |
| Contas a receber | automação | ensaio | Agente do pipeline | 0 |
| Lista 1 | lixeira | direto | Maryane Generozo | 0 |
| Lista do subgrupo | lixeira | direto | Maryane Generozo | 0 |

**Q1: ator humano aceito** (dono, 29/10).

**Voltas já registradas** (`--agenda`, 29/10): 6 voltas `concluido` (28/10 e 29/10 em Contas a pagar e a receber; 29/10 nas duas Listas de lixeira), 0 `falhou`, 0 `SEM_ATOR`, 0 `RECUSA_DO_DOMINIO`. Contas a receber com `ENSAIO_PRIMEIRA_VOLTA`, como esperado para Lista com Automação por vencimento. Consulta em `plataforma.automacao_agenda`: nos últimos 3 dias só há linhas do `ws_n1` (16); as dos Espaços de teste são anteriores.

**Pendente:** passo 1 (links do PR, do CI e do deploy) e passo 3 (linha do `journalctl`) não foram colados nesta conferência; o andamento registra que o log mostrou "scheduler de Automações ativo" em 29/10. Passo 5: `npm run automacoes:previa -w @n1/api -- ws_n1 --agenda` em 30/10.

## D-19 — `010` em produção (10-17)

Aplicada em 29/10/2026, 16h27 (Brasília), pelo dono, com `npm run migrar -w @n1/api` a partir do Mac (o `apps/api/.env` aponta para produção). Separada do merge B por decisão do dono: a remoção do botão (10-16) espera as voltas de 30/10.

**Por que era seguro aplicar antes do merge B:** a web de produção é publicada pela Vercel a partir de `n1-tecnologia/crm`, e o deploy de `0292960` (29/10, 10h51) tem o código tolerante da Fase 10. A API antiga só lê `blocks` de Espaço e Pasta.

| Contagem (todos os Espaços de Trabalho) | Antes | Depois |
|---|---|---|
| Visualizações `kind = carga` | 0 | 0 |
| Listas com a chave `blocks` | 0 | 0 |
| Listas com `blocks` não vazio | 0 | 0 |

A `010` não alterou linha nenhuma: o dado antigo já não existia. A pós-condição passou dentro da transação. `plataforma.migracoes` registra `010-carga-e-bloqueio-da-lista.sql` em 2026-10-29T19:27:13Z. `--seco` depois: `0 pendente(s)`.

**Decisão D-19: aplicar.**
