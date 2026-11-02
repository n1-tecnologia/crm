# Fase 12 — Provas da gravação

Este arquivo guarda o que foi medido em produção. O plano 12-02 escreve a rodada "antes"; o 12-03 fixa a meta; o 12-10 mede o "depois" com o mesmo comando e preenche as colunas vazias.

## Como medir

- **Comando:** `npm run --silent gravacao:medir -w @n1/api -- --repeticoes=10`, rodado na VPS de produção, em `/opt/n1-crm/current`.
- **Código medido (SHA):** `5a74ee7548d5437745677e997484ff5b1f906657`. É o mesmo SHA que o `publicar.sh` imprimiu como no ar ("<SHA> no ar em 127.0.0.1:3020") e é a "revisão do código" impressa pelo comando. A versão que estava no ar antes era `a627a38`. O dono publicou direto o SHA do ramo `fase-11`, sem passar pela `main`. O `cat /opt/n1-crm/current/REVISION` à parte não foi colado; a igualdade foi conferida entre a saída do `publicar.sh` e a revisão que o próprio comando leu do `REVISION` do release.
- **Quando:** `2026-10-31T04:10:33.571Z` (o `quando` impresso).
- **Espaço de Trabalho:** `ws_n1`.
- **O que faz:** sobe o próprio Fastify em `127.0.0.1`, porta efêmera, no processo do comando, repete 10 vezes cada um dos quatro gestos (criar Lista, renomear Lista, mandar à lixeira um Espaço com Listas, mudar o Status de uma Tarefa) e lê as etapas da linha de log "gravacao medida" de cada gravação; mede também `select 1`, `hidratar` direto, `GET /estado` e o tamanho de `plataforma.registros`.
- **O que NÃO pega (D-17):** não pega o pool quente do serviço de verdade (o comando abre o dele) nem o nginx e o TLS do caminho do navegador; mede o mesmo código, o mesmo banco e a mesma rede, em outro processo.

## Antes — saída do comando

Saída colada pelo dono, sem edição:

```text
Medição da gravação (gravacao:medir)
quando: 2026-10-31T04:10:33.571Z
revisão do código: 5a74ee7548d5437745677e997484ff5b1f906657
Espaço de Trabalho: ws_n1
repetições: 10

Ida e volta (select 1)
select 1: mediana 51.7 ms · pior 52.9 ms · 10 amostra(s)

hidratar direto (transação só de leitura)
hidratar: mediana 147.5 ms · pior 203.1 ms · 10 amostra(s)
registros lidos: 4601
limite da sessão C (D-07): 300 ms na mediana; mediana 147.5 ms, abaixo do limite

GET /estado (total)
GET /estado: mediana 370.6 ms · pior 429.7 ms · 10 amostra(s)

plataforma.registros (D-05)
coleção               registros  comprimido      texto
--------------------  ---------  ----------  ---------
activity                   3786   1386.9 KB  1302.6 KB
tasks                       534    815.6 KB   919.7 KB
automationExecutions         50     58.1 KB    51.8 KB
agentExecutions              28     47.5 KB    41.7 KB
approvals                    27     32.0 KB    32.4 KB
fieldDefinitions             55     16.7 KB    16.1 KB
automations                  13     15.3 KB    14.1 KB
lists                         8      6.5 KB     7.2 KB
tools                        20      4.2 KB     4.0 KB
grants                       12      3.6 KB     3.5 KB
spaces                        4      3.4 KB     3.0 KB
integrations                  7      3.2 KB     2.9 KB
agents                        2      2.6 KB     2.3 KB
roles                         9      2.4 KB     2.2 KB
members                       5      2.1 KB     1.9 KB
documents                     1      1.9 KB     1.7 KB
forms                         1      1.8 KB     5.2 KB
views                         5      1.7 KB     1.6 KB
files                         4      1.6 KB     1.5 KB
folders                       4      1.6 KB     1.4 KB
chatSessions                  2      1.3 KB     1.2 KB
tags                          9      1.0 KB     1.0 KB
workspace                     1      0.9 KB     0.8 KB
taskTypes                     4      0.6 KB     0.6 KB
collections                   1      0.6 KB     0.5 KB
skills                        1      0.5 KB     0.5 KB
models                        3      0.5 KB     0.4 KB
funnels                       1      0.5 KB     0.4 KB
chatFolders                   3      0.4 KB     0.4 KB
inbox                         1      0.1 KB     0.1 KB
TOTAL                      4601   2415.1 KB  2422.8 KB

criar Lista (createList) · 10 amostra(s)
etapa            mediana   pior
---------------  -------  -----
conexaoMs            0.1    0.2
inicioMs            51.5   51.8
travaMs             51.8   52.3
hidratarMs         154.6  173.4
canaisMs            52.8   53.0
operacaoMs           0.3    1.5
atualizaMs          51.8   52.3
gravarMs           105.7  145.4
eventosMs            0.1    0.1
commitMs            52.0   52.4
recorteMs           10.8   19.0
totalMs            495.5  540.9
pedidoMs           551.0  597.6
foraDasEtapasMs      6.2   12.1
foraDoHandlerMs     55.4   56.7
tentativas             1      1
linhasLidas         4613   4622
linhasGravadas         2      2
regimes: (a linha não traz)
desfechos: gravou 10

renomear Lista (updateContainer) · 10 amostra(s)
etapa            mediana   pior
---------------  -------  -----
conexaoMs            0.1    0.2
inicioMs            51.5   51.7
travaMs             51.8   52.6
hidratarMs         148.1  163.6
canaisMs            52.8   53.6
operacaoMs           0.2    1.0
atualizaMs          51.8   52.6
gravarMs           102.3  109.0
eventosMs            0.0    0.1
commitMs            51.8   51.9
recorteMs           11.8   22.7
totalMs            477.5  495.0
pedidoMs           531.9  550.0
foraDasEtapasMs      5.7   10.5
foraDoHandlerMs     54.8   55.1
tentativas             1      1
linhasLidas       4628.5   4633
linhasGravadas         2      2
regimes: (a linha não traz)
desfechos: gravou 10

Espaço com Listas à lixeira (trashContainer) · 10 amostra(s)
etapa            mediana   pior
---------------  -------  -----
conexaoMs            0.1    0.1
inicioMs            51.3   51.7
travaMs             51.7   52.0
hidratarMs         147.9  167.8
canaisMs            53.0   53.1
operacaoMs           0.3    1.1
atualizaMs          51.7   52.0
gravarMs           102.4  123.0
eventosMs            0.0    0.1
commitMs            51.8   52.2
recorteMs            9.8   16.2
totalMs            471.5  508.2
pedidoMs           526.1  563.3
foraDasEtapasMs      5.3    6.3
foraDoHandlerMs     54.8   55.9
tentativas             1      1
linhasLidas         4650   4659
linhasGravadas         4      4
regimes: (a linha não traz)
desfechos: gravou 10

mudar Status (changeTaskStatus) · 10 amostra(s)
etapa            mediana   pior
---------------  -------  -----
conexaoMs            0.1    0.1
inicioMs            51.3   51.8
travaMs             51.7   51.8
hidratarMs         150.3  192.8
canaisMs            53.0   53.2
operacaoMs           0.8    2.5
atualizaMs          51.7   51.8
gravarMs           104.3  127.9
eventosMs            0.0    0.1
commitMs            51.8   52.1
recorteMs            8.9   10.2
totalMs            480.9  548.4
pedidoMs           535.5  602.7
foraDasEtapasMs      5.7    8.9
foraDoHandlerMs     54.5   55.5
tentativas             1      1
linhasLidas       4666.5   4671
linhasGravadas         2      2
regimes: (a linha não traz)
desfechos: gravou 10

Observações
- Espaço com Listas à lixeira: o mesmo Espaço de teste, restaurado fora da medição a cada repetição.
```

## Depois — saída do comando

Mesmo comando do "Antes", a partir da VPS, sobre o código com a trava (12-04) e o store novo (12-05 a 12-09). O dono colou a saída; ela entra abaixo exatamente como veio.

- **Comando:** `npm run --silent gravacao:medir -w @n1/api -- --repeticoes=10`, em `/opt/n1-crm/current`, via ssh como `n1crm` (o mesmo do "Antes").
- **Código medido (SHA):** `37c1cab2e6f35b337c5d26318aae5432db5d620c`, o último commit de código da fase (`feat(12-09)`). É o SHA que o `publicar.sh` imprimiu como no ar ("37c1cab2e6f35b337c5d26318aae5432db5d620c no ar em 127.0.0.1:3020"; "== migrações: Nada a aplicar: o banco já está em dia."; "n1_api: concessões aplicadas") e a "revisão do código" que o próprio comando leu do `REVISION` do release. O `cat /opt/n1-crm/current/REVISION` à parte não foi colado; a igualdade foi conferida entre a saída do `publicar.sh` e a revisão impressa pelo comando. Os commits seguintes (`faa5be8`, `b997d21`) só tocam `.planning/`: para `apps/` e `packages/` o conteúdo é idêntico ao de `37c1cab`. A API foi publicada direto pelo SHA do ramo `fase-11`, **não** por um commit da `main` (como o "Antes" também foi).
- **Quando:** `2026-11-02T18:59:40.498Z` (o `quando` impresso). Espaço de Trabalho `ws_n1`.
- **Só a API foi publicada.** A web nova não está no ar (ver "Conferência do dono na tela"). Isto não afeta esta medição: o comando sobe o próprio Fastify em loopback e fala com o banco de produção, sem passar pela web.

Saída colada pelo dono, sem edição:

```text
Medição da gravação (gravacao:medir)
quando: 2026-11-02T18:59:40.498Z
revisão do código: 37c1cab2e6f35b337c5d26318aae5432db5d620c
Espaço de Trabalho: ws_n1
repetições: 10

Ida e volta (select 1)
select 1: mediana 51.4 ms · pior 52.2 ms · 10 amostra(s)

hidratar direto (transação só de leitura)
hidratar: mediana 186.6 ms · pior 198.4 ms · 10 amostra(s)
registros lidos: 4673
limite da sessão C (D-07): 300 ms na mediana; mediana 186.6 ms, abaixo do limite

GET /estado (total)
GET /estado: mediana 337.6 ms · pior 364.8 ms · 10 amostra(s)

plataforma.registros (D-05)
coleção               registros  comprimido      texto
--------------------  ---------  ----------  ---------
activity                   3841   1404.8 KB  1319.6 KB
tasks                       535    816.3 KB   920.4 KB
automationExecutions         50     58.1 KB    51.8 KB
agentExecutions              28     47.5 KB    41.7 KB
approvals                    27     32.0 KB    32.4 KB
fieldDefinitions             55     16.7 KB    16.1 KB
automations                  13     15.3 KB    14.1 KB
lists                        20     11.5 KB    11.8 KB
spaces                        6      5.2 KB     4.6 KB
tools                        20      4.2 KB     4.0 KB
grants                       12      3.6 KB     3.5 KB
integrations                  7      3.2 KB     2.9 KB
agents                        2      2.6 KB     2.3 KB
roles                         9      2.4 KB     2.2 KB
members                       5      2.1 KB     1.9 KB
documents                     1      1.9 KB     1.7 KB
forms                         1      1.8 KB     5.2 KB
views                         5      1.7 KB     1.6 KB
files                         4      1.6 KB     1.5 KB
folders                       4      1.6 KB     1.4 KB
chatSessions                  2      1.3 KB     1.2 KB
tags                          9      1.0 KB     1.0 KB
workspace                     1      0.9 KB     0.8 KB
taskTypes                     6      0.9 KB     0.8 KB
collections                   1      0.6 KB     0.5 KB
skills                        1      0.5 KB     0.5 KB
models                        3      0.5 KB     0.4 KB
funnels                       1      0.5 KB     0.4 KB
chatFolders                   3      0.4 KB     0.4 KB
inbox                         1      0.1 KB     0.1 KB
TOTAL                      4673   2440.7 KB  2447.0 KB

criar Lista (createList) · 10 amostra(s)
etapa            mediana   pior
---------------  -------  -----
conexaoMs            0.1    0.1
inicioMs            51.3   51.5
travaMs            103.1  104.5
hidratarMs         161.7  188.7
canaisMs            52.7   53.0
operacaoMs           0.3    1.2
atualizaMs          51.5   52.0
gravarMs           109.4  120.3
eventosMs            0.1    0.4
commitMs            51.7   51.9
recorteMs           10.9   19.3
totalMs            557.0  574.6
pedidoMs           611.9  629.3
foraDasEtapasMs      6.2    9.0
foraDoHandlerMs     55.1   55.7
tentativas             1      1
linhasLidas         4685   4694
linhasGravadas         2      2
regimes: travado
desfechos: gravou 10

renomear Lista (updateContainer) · 10 amostra(s)
etapa            mediana   pior
---------------  -------  -----
conexaoMs            0.1    0.1
inicioMs            51.3   51.5
travaMs            103.2  104.4
hidratarMs         162.1  207.3
canaisMs            52.7   53.5
operacaoMs           0.2    0.9
atualizaMs          51.5   52.1
gravarMs           112.5  137.4
eventosMs            0.1    0.1
commitMs            51.6   53.7
recorteMs           15.8   24.9
totalMs            557.0  610.1
pedidoMs           612.1  665.1
foraDasEtapasMs      6.8   12.2
foraDoHandlerMs     55.0   55.4
tentativas             1      1
linhasLidas       4700.5   4705
linhasGravadas         2      2
regimes: travado
desfechos: gravou 10

Espaço com Listas à lixeira (trashContainer) · 10 amostra(s)
etapa            mediana   pior
---------------  -------  -----
conexaoMs            0.1    0.1
inicioMs            51.1   51.3
travaMs            102.8  103.1
hidratarMs         159.6  202.3
canaisMs            52.8   53.1
operacaoMs           0.3    1.1
atualizaMs          51.5   51.7
gravarMs           105.9  136.4
eventosMs            0.1    0.1
commitMs            51.7   51.9
recorteMs           11.6   18.8
totalMs            559.9  588.5
pedidoMs           614.4  644.2
foraDasEtapasMs      5.6    9.8
foraDoHandlerMs     54.5   55.8
tentativas             1      1
linhasLidas         4722   4731
linhasGravadas         4      4
regimes: travado
desfechos: gravou 10

mudar Status (changeTaskStatus) · 10 amostra(s)
etapa            mediana   pior
---------------  -------  -----
conexaoMs            0.1    0.1
inicioMs            51.3   51.5
travaMs            103.0  104.2
hidratarMs         159.3  187.4
canaisMs            52.6   53.9
operacaoMs           0.9    6.7
atualizaMs          51.5   52.7
gravarMs           108.7  153.1
eventosMs            0.1    0.1
commitMs            51.6   51.7
recorteMs           10.3   17.2
totalMs            556.7  603.3
pedidoMs           611.0  658.1
foraDasEtapasMs      6.2   19.0
foraDoHandlerMs     54.6   55.3
tentativas             1      1
linhasLidas       4738.5   4743
linhasGravadas         2      2
regimes: travado
desfechos: gravou 10

Observações
- Espaço com Listas à lixeira: o mesmo Espaço de teste, restaurado fora da medição a cada repetição.
```

Conferência do agente antes de gravar a saída (Task 2, T-12-23), por `grep`/`awk` sobre o texto colado:

- **Revisão do código:** a linha "revisão do código" é `37c1cab2e6f35b337c5d26318aae5432db5d620c`, igual ao SHA que o `publicar.sh` imprimiu como no ar. Confere.
- **Os quatro gestos:** createList, updateContainer, trashContainer e changeTaskStatus têm `10 amostra(s)`, `regimes: travado`, `tentativas` 1 na mediana e 1 no pior caso, e `desfechos: gravou 10`. Confere nos quatro. (Também `select 1`, `hidratar` e `GET /estado` têm 10 amostras.)
- **Nada sensível:** a saída só tem números e nomes técnicos de etapa e de coleção. Busca por `password`, `senha`, `@`, `postgres://`, `http(s)://`, `supabase`, `api.env`, `Bearer`, `eyJ` e `ZZ-` voltou vazia. Nenhum nome de Tarefa, Contato, e-mail ou URL com senha. Gravada.

## Tamanho de `plataforma.registros` (D-05)

A tabela, como veio (a consulta de D-05 não foi recusada pelo banco; não foi preciso rodar nada à mão no `psql`):

```text
coleção               registros  comprimido      texto
--------------------  ---------  ----------  ---------
activity                   3786   1386.9 KB  1302.6 KB
tasks                       534    815.6 KB   919.7 KB
automationExecutions         50     58.1 KB    51.8 KB
agentExecutions              28     47.5 KB    41.7 KB
approvals                    27     32.0 KB    32.4 KB
fieldDefinitions             55     16.7 KB    16.1 KB
automations                  13     15.3 KB    14.1 KB
lists                         8      6.5 KB     7.2 KB
tools                        20      4.2 KB     4.0 KB
grants                       12      3.6 KB     3.5 KB
spaces                        4      3.4 KB     3.0 KB
integrations                  7      3.2 KB     2.9 KB
agents                        2      2.6 KB     2.3 KB
roles                         9      2.4 KB     2.2 KB
members                       5      2.1 KB     1.9 KB
documents                     1      1.9 KB     1.7 KB
forms                         1      1.8 KB     5.2 KB
views                         5      1.7 KB     1.6 KB
files                         4      1.6 KB     1.5 KB
folders                       4      1.6 KB     1.4 KB
chatSessions                  2      1.3 KB     1.2 KB
tags                          9      1.0 KB     1.0 KB
workspace                     1      0.9 KB     0.8 KB
taskTypes                     4      0.6 KB     0.6 KB
collections                   1      0.6 KB     0.5 KB
skills                        1      0.5 KB     0.5 KB
models                        3      0.5 KB     0.4 KB
funnels                       1      0.5 KB     0.4 KB
chatFolders                   3      0.4 KB     0.4 KB
inbox                         1      0.1 KB     0.1 KB
TOTAL                      4601   2415.1 KB  2422.8 KB
```

Leitura, só aritmética sobre a tabela:

- `activity` tem 3786 dos 4601 registros (82,3%) e 1386.9 KB dos 2415.1 KB comprimidos (57,4%).
- `activity` e `tasks` juntas têm 4320 dos 4601 registros (93,9%) e 2202.5 KB dos 2415.1 KB comprimidos (91,2%).
- O total comprimido (2415.1 KB) e o total em texto (2422.8 KB) diferem em 7.7 KB; em `tasks` o comprimido (815.6 KB) é menor que o texto (919.7 KB), e em `forms` é menor (1.8 KB contra 5.2 KB).

## Tabela antes/depois

**As duas rodadas** (o mesmo comando, 10 repetições, `ws_n1`, a partir da VPS):

| Rodada | SHA | Quando | Registros de `plataforma.registros` | O que `executar()` era |
|---|---|---|---:|---|
| Antes | `5a74ee7548d5437745677e997484ff5b1f906657` | 2026-10-31T04:10:33.571Z | 4601 | antes da trava (a saída não traz o `regime`: "a linha não traz") |
| Depois | `37c1cab2e6f35b337c5d26318aae5432db5d620c` | 2026-11-02T18:59:40.498Z | 4673 | `regimes: travado` nos quatro gestos, `tentativas` 1 |

**Como ler.** Os números das colunas "Antes" são os de "Antes — saída do comando"; os das colunas "Depois" são os de "Depois — saída do comando", sem arredondar nem ajustar (cada um aparece no texto colado; conferido por busca mecânica, nenhum faltou). Todos são mediana ou pior caso de 10 amostras, em ms, exceto as linhas `tentativas`, `linhasLidas` e `linhasGravadas`, que são contagens. **Diferença = depois − antes**: em ms (e em % da mediana do antes) para a mediana, e em ms para o pior caso; positivo é mais lento (ou mais linhas). Onde o antes é 0.0 o % não existe ("—"); em etapas abaixo de 1 ms o % é só ruído de uma casa decimal. Cada conta foi feita sobre os valores impressos e conferida duas vezes (uma à mão, outra por script).

**Coluna "Meta".** A meta da parada é a decisão `b-ganho-basta` do dono (2026-11-02, `12-CONTEXT.md` § "Meta (fixada na parada)"): o ganho que o B der basta, **sem alvo numérico por gesto** e sem a sessão C. Por isso a coluna diz "sem alvo numérico" em toda linha: nenhum número de meta foi inventado, e a comparação do "depois" é só contra o "antes" (ver "Comparação com a meta (D-08)").

**O que mudou entre as rodadas além do código** (fatos impressos, sem afirmar causa):

- **A base cresceu.** `plataforma.registros` passou de 4601 para 4673 registros (+72, +1,6%), de 2415.1 KB para 2440.7 KB comprimidos (+25.6 KB, +1,1%). Por coleção: `activity` 3786 → 3841 (+55), `lists` 8 → 20 (+12), `spaces` 4 → 6 (+2), `taskTypes` 4 → 6 (+2), `tasks` 534 → 535 (+1). Isso pesa em `hidratar`: `linhasLidas` sobe 72 em todos os gestos (4613 → 4685 em createList, por exemplo). O aumento de 2 Espaços e 12 Listas é compatível com o rastro do próprio "antes" (ver "Rastro em produção"), mas a saída não diz de onde veio.
- **A ida e volta de referência quase não mudou:** `select 1` 51.7 → 51.4 ms. Cada etapa de uma ida só (`inicioMs`, `canaisMs`, `atualizaMs`, `commitMs`) fica igual ao `select 1` nas duas rodadas; a comparação não é distorcida por uma rede diferente.
- **`hidratar` direto subiu mais do que a base:** 147.5 → 186.6 ms (+39.1 ms, +26,5%) com 1,6% mais registros. Dentro dos gestos, `hidratarMs` subiu menos (+7.1 a +14.0 ms, +4,6% a +9,5%). Os números não dizem a causa.
- **`GET /estado` desceu:** 370.6 → 337.6 ms (−33.0 ms, −8,9%), apesar de `hidratar` ter subido. As duas leituras andaram em sentidos opostos, o que mostra o tamanho do ruído entre rodadas (dezenas de ms, 10 amostras, momentos diferentes de produção): diferenças dessa ordem não são confiáveis, só a direção das grandes (como a da trava, de 51 ms, cravada em quatro gestos) é.

Linhas de referência (10 amostras cada):

| Referência | Antes: mediana | Antes: pior caso | Depois: mediana | Depois: pior caso | Dif. mediana (ms) | Dif. mediana (%) | Dif. pior caso (ms) | Meta |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `select 1` (ida e volta VPS↔banco) | 51.7 ms | 52.9 ms | 51.4 ms | 52.2 ms | −0.3 ms | −0.6% | −0.7 ms | sem alvo numérico |
| `hidratar` direto (transação só de leitura) (4601 registros lidos no antes; 4673 no depois) | 147.5 ms | 203.1 ms | 186.6 ms | 198.4 ms | +39.1 ms | +26.5% | −4.7 ms | sem alvo numérico |
| `GET /estado` (total) | 370.6 ms | 429.7 ms | 337.6 ms | 364.8 ms | −33.0 ms | −8.9% | −64.9 ms | sem alvo numérico |

O comando compara o `hidratar` direto com o limite de 300 ms da sessão C (D-07): no antes, mediana de 147.5 ms, "abaixo do limite"; no depois, mediana de 186.6 ms, "abaixo do limite" (folga de 300 − 186.6 = 113.4 ms). O gatilho continua sem disparar; a sessão C segue fora do ROADMAP.

Por gesto e por etapa:

| Gesto | Etapa | Antes: mediana (ms) | Antes: pior caso (ms) | Depois: mediana (ms) | Depois: pior caso (ms) | Dif. mediana (ms) | Dif. mediana (%) | Dif. pior caso (ms) | Meta |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| createList | conexaoMs | 0.1 | 0.2 | 0.1 | 0.1 | 0.0 | 0.0% | −0.1 | sem alvo numérico |
| createList | inicioMs | 51.5 | 51.8 | 51.3 | 51.5 | −0.2 | −0.4% | −0.3 | sem alvo numérico |
| createList | travaMs | 51.8 | 52.3 | 103.1 | 104.5 | +51.3 | +99.0% | +52.2 | sem alvo numérico |
| createList | hidratarMs | 154.6 | 173.4 | 161.7 | 188.7 | +7.1 | +4.6% | +15.3 | sem alvo numérico |
| createList | canaisMs | 52.8 | 53.0 | 52.7 | 53.0 | −0.1 | −0.2% | 0.0 | sem alvo numérico |
| createList | operacaoMs | 0.3 | 1.5 | 0.3 | 1.2 | 0.0 | 0.0% | −0.3 | sem alvo numérico |
| createList | atualizaMs | 51.8 | 52.3 | 51.5 | 52.0 | −0.3 | −0.6% | −0.3 | sem alvo numérico |
| createList | gravarMs | 105.7 | 145.4 | 109.4 | 120.3 | +3.7 | +3.5% | −25.1 | sem alvo numérico |
| createList | eventosMs | 0.1 | 0.1 | 0.1 | 0.4 | 0.0 | 0.0% | +0.3 | sem alvo numérico |
| createList | commitMs | 52.0 | 52.4 | 51.7 | 51.9 | −0.3 | −0.6% | −0.5 | sem alvo numérico |
| createList | recorteMs | 10.8 | 19.0 | 10.9 | 19.3 | +0.1 | +0.9% | +0.3 | sem alvo numérico |
| createList | totalMs | 495.5 | 540.9 | 557.0 | 574.6 | +61.5 | +12.4% | +33.7 | sem alvo numérico |
| createList | pedidoMs | 551.0 | 597.6 | 611.9 | 629.3 | +60.9 | +11.1% | +31.7 | sem alvo numérico |
| createList | foraDasEtapasMs | 6.2 | 12.1 | 6.2 | 9.0 | 0.0 | 0.0% | −3.1 | sem alvo numérico |
| createList | foraDoHandlerMs | 55.4 | 56.7 | 55.1 | 55.7 | −0.3 | −0.5% | −1.0 | sem alvo numérico |
| createList | tentativas | 1 | 1 | 1 | 1 | 0 (contagem) | 0.0% | 0 (contagem) | sem alvo numérico |
| createList | linhasLidas | 4613 | 4622 | 4685 | 4694 | +72 (contagem) | +1.6% | +72 (contagem) | sem alvo numérico |
| createList | linhasGravadas | 2 | 2 | 2 | 2 | 0 (contagem) | 0.0% | 0 (contagem) | sem alvo numérico |
| createList | regimes | (a linha não trazia) | | travado | | | | | sem alvo numérico |
| createList | desfechos | gravou 10 | | gravou 10 | | | | | sem alvo numérico |
| updateContainer | conexaoMs | 0.1 | 0.2 | 0.1 | 0.1 | 0.0 | 0.0% | −0.1 | sem alvo numérico |
| updateContainer | inicioMs | 51.5 | 51.7 | 51.3 | 51.5 | −0.2 | −0.4% | −0.2 | sem alvo numérico |
| updateContainer | travaMs | 51.8 | 52.6 | 103.2 | 104.4 | +51.4 | +99.2% | +51.8 | sem alvo numérico |
| updateContainer | hidratarMs | 148.1 | 163.6 | 162.1 | 207.3 | +14.0 | +9.5% | +43.7 | sem alvo numérico |
| updateContainer | canaisMs | 52.8 | 53.6 | 52.7 | 53.5 | −0.1 | −0.2% | −0.1 | sem alvo numérico |
| updateContainer | operacaoMs | 0.2 | 1.0 | 0.2 | 0.9 | 0.0 | 0.0% | −0.1 | sem alvo numérico |
| updateContainer | atualizaMs | 51.8 | 52.6 | 51.5 | 52.1 | −0.3 | −0.6% | −0.5 | sem alvo numérico |
| updateContainer | gravarMs | 102.3 | 109.0 | 112.5 | 137.4 | +10.2 | +10.0% | +28.4 | sem alvo numérico |
| updateContainer | eventosMs | 0.0 | 0.1 | 0.1 | 0.1 | +0.1 | — | 0.0 | sem alvo numérico |
| updateContainer | commitMs | 51.8 | 51.9 | 51.6 | 53.7 | −0.2 | −0.4% | +1.8 | sem alvo numérico |
| updateContainer | recorteMs | 11.8 | 22.7 | 15.8 | 24.9 | +4.0 | +33.9% | +2.2 | sem alvo numérico |
| updateContainer | totalMs | 477.5 | 495.0 | 557.0 | 610.1 | +79.5 | +16.6% | +115.1 | sem alvo numérico |
| updateContainer | pedidoMs | 531.9 | 550.0 | 612.1 | 665.1 | +80.2 | +15.1% | +115.1 | sem alvo numérico |
| updateContainer | foraDasEtapasMs | 5.7 | 10.5 | 6.8 | 12.2 | +1.1 | +19.3% | +1.7 | sem alvo numérico |
| updateContainer | foraDoHandlerMs | 54.8 | 55.1 | 55.0 | 55.4 | +0.2 | +0.4% | +0.3 | sem alvo numérico |
| updateContainer | tentativas | 1 | 1 | 1 | 1 | 0 (contagem) | 0.0% | 0 (contagem) | sem alvo numérico |
| updateContainer | linhasLidas | 4628.5 | 4633 | 4700.5 | 4705 | +72 (contagem) | +1.6% | +72 (contagem) | sem alvo numérico |
| updateContainer | linhasGravadas | 2 | 2 | 2 | 2 | 0 (contagem) | 0.0% | 0 (contagem) | sem alvo numérico |
| updateContainer | regimes | (a linha não trazia) | | travado | | | | | sem alvo numérico |
| updateContainer | desfechos | gravou 10 | | gravou 10 | | | | | sem alvo numérico |
| trashContainer | conexaoMs | 0.1 | 0.1 | 0.1 | 0.1 | 0.0 | 0.0% | 0.0 | sem alvo numérico |
| trashContainer | inicioMs | 51.3 | 51.7 | 51.1 | 51.3 | −0.2 | −0.4% | −0.4 | sem alvo numérico |
| trashContainer | travaMs | 51.7 | 52.0 | 102.8 | 103.1 | +51.1 | +98.8% | +51.1 | sem alvo numérico |
| trashContainer | hidratarMs | 147.9 | 167.8 | 159.6 | 202.3 | +11.7 | +7.9% | +34.5 | sem alvo numérico |
| trashContainer | canaisMs | 53.0 | 53.1 | 52.8 | 53.1 | −0.2 | −0.4% | 0.0 | sem alvo numérico |
| trashContainer | operacaoMs | 0.3 | 1.1 | 0.3 | 1.1 | 0.0 | 0.0% | 0.0 | sem alvo numérico |
| trashContainer | atualizaMs | 51.7 | 52.0 | 51.5 | 51.7 | −0.2 | −0.4% | −0.3 | sem alvo numérico |
| trashContainer | gravarMs | 102.4 | 123.0 | 105.9 | 136.4 | +3.5 | +3.4% | +13.4 | sem alvo numérico |
| trashContainer | eventosMs | 0.0 | 0.1 | 0.1 | 0.1 | +0.1 | — | 0.0 | sem alvo numérico |
| trashContainer | commitMs | 51.8 | 52.2 | 51.7 | 51.9 | −0.1 | −0.2% | −0.3 | sem alvo numérico |
| trashContainer | recorteMs | 9.8 | 16.2 | 11.6 | 18.8 | +1.8 | +18.4% | +2.6 | sem alvo numérico |
| trashContainer | totalMs | 471.5 | 508.2 | 559.9 | 588.5 | +88.4 | +18.7% | +80.3 | sem alvo numérico |
| trashContainer | pedidoMs | 526.1 | 563.3 | 614.4 | 644.2 | +88.3 | +16.8% | +80.9 | sem alvo numérico |
| trashContainer | foraDasEtapasMs | 5.3 | 6.3 | 5.6 | 9.8 | +0.3 | +5.7% | +3.5 | sem alvo numérico |
| trashContainer | foraDoHandlerMs | 54.8 | 55.9 | 54.5 | 55.8 | −0.3 | −0.5% | −0.1 | sem alvo numérico |
| trashContainer | tentativas | 1 | 1 | 1 | 1 | 0 (contagem) | 0.0% | 0 (contagem) | sem alvo numérico |
| trashContainer | linhasLidas | 4650 | 4659 | 4722 | 4731 | +72 (contagem) | +1.5% | +72 (contagem) | sem alvo numérico |
| trashContainer | linhasGravadas | 4 | 4 | 4 | 4 | 0 (contagem) | 0.0% | 0 (contagem) | sem alvo numérico |
| trashContainer | regimes | (a linha não trazia) | | travado | | | | | sem alvo numérico |
| trashContainer | desfechos | gravou 10 | | gravou 10 | | | | | sem alvo numérico |
| changeTaskStatus | conexaoMs | 0.1 | 0.1 | 0.1 | 0.1 | 0.0 | 0.0% | 0.0 | sem alvo numérico |
| changeTaskStatus | inicioMs | 51.3 | 51.8 | 51.3 | 51.5 | 0.0 | 0.0% | −0.3 | sem alvo numérico |
| changeTaskStatus | travaMs | 51.7 | 51.8 | 103.0 | 104.2 | +51.3 | +99.2% | +52.4 | sem alvo numérico |
| changeTaskStatus | hidratarMs | 150.3 | 192.8 | 159.3 | 187.4 | +9.0 | +6.0% | −5.4 | sem alvo numérico |
| changeTaskStatus | canaisMs | 53.0 | 53.2 | 52.6 | 53.9 | −0.4 | −0.8% | +0.7 | sem alvo numérico |
| changeTaskStatus | operacaoMs | 0.8 | 2.5 | 0.9 | 6.7 | +0.1 | +12.5% | +4.2 | sem alvo numérico |
| changeTaskStatus | atualizaMs | 51.7 | 51.8 | 51.5 | 52.7 | −0.2 | −0.4% | +0.9 | sem alvo numérico |
| changeTaskStatus | gravarMs | 104.3 | 127.9 | 108.7 | 153.1 | +4.4 | +4.2% | +25.2 | sem alvo numérico |
| changeTaskStatus | eventosMs | 0.0 | 0.1 | 0.1 | 0.1 | +0.1 | — | 0.0 | sem alvo numérico |
| changeTaskStatus | commitMs | 51.8 | 52.1 | 51.6 | 51.7 | −0.2 | −0.4% | −0.4 | sem alvo numérico |
| changeTaskStatus | recorteMs | 8.9 | 10.2 | 10.3 | 17.2 | +1.4 | +15.7% | +7.0 | sem alvo numérico |
| changeTaskStatus | totalMs | 480.9 | 548.4 | 556.7 | 603.3 | +75.8 | +15.8% | +54.9 | sem alvo numérico |
| changeTaskStatus | pedidoMs | 535.5 | 602.7 | 611.0 | 658.1 | +75.5 | +14.1% | +55.4 | sem alvo numérico |
| changeTaskStatus | foraDasEtapasMs | 5.7 | 8.9 | 6.2 | 19.0 | +0.5 | +8.8% | +10.1 | sem alvo numérico |
| changeTaskStatus | foraDoHandlerMs | 54.5 | 55.5 | 54.6 | 55.3 | +0.1 | +0.2% | −0.2 | sem alvo numérico |
| changeTaskStatus | tentativas | 1 | 1 | 1 | 1 | 0 (contagem) | 0.0% | 0 (contagem) | sem alvo numérico |
| changeTaskStatus | linhasLidas | 4666.5 | 4671 | 4738.5 | 4743 | +72 (contagem) | +1.5% | +72 (contagem) | sem alvo numérico |
| changeTaskStatus | linhasGravadas | 2 | 2 | 2 | 2 | 0 (contagem) | 0.0% | 0 (contagem) | sem alvo numérico |
| changeTaskStatus | regimes | (a linha não trazia) | | travado | | | | | sem alvo numérico |
| changeTaskStatus | desfechos | gravou 10 | | gravou 10 | | | | | sem alvo numérico |

Observações de leitura do "antes" (só aritmética sobre números impressos, sem afirmar causa):

- A ida e volta do `select 1` (51.7 ms na mediana) é praticamente igual ao custo de cada etapa de uma ida só: `inicioMs`, `travaMs`, `canaisMs`, `atualizaMs` e `commitMs` ficam entre 51.3 e 53.0 ms de mediana nos quatro gestos.
- `hidratarMs` fica entre 147.9 e 154.6 ms de mediana nos quatro gestos, perto dos 147.5 ms do `hidratar` direto; `gravarMs` fica entre 102.3 e 105.7 ms.
- `foraDoHandlerMs` fica entre 54.5 e 55.4 ms de mediana nos quatro gestos; `foraDasEtapasMs`, entre 5.3 e 6.2 ms.
- O `GET /estado` (370.6 ms) tem 223.1 ms a mais que o `hidratar` direto (147.5 ms); os números não dizem de onde vem a diferença.

Observações de leitura do "depois" (só aritmética sobre números impressos):

- **O que a trava custou, em uma linha por gesto.** `travaMs` (mediana) foi de 51.8, 51.8, 51.7 e 51.7 ms para 103.1, 103.2, 102.8 e 103.0 ms (+51.3, +51.4, +51.1 e +51.3 ms, +99%), quase exatamente um `select 1` (51.4 ms). No "antes" `travaMs` e `atualizaMs` eram o mesmo número (o `update` da revisão era a única instrução da trava); no "depois" `travaMs − atualizaMs` é 51.6, 51.7, 51.3 e 51.5 ms: a diferença é a instrução `select … for update` que ficou antes de `hidratar`. `atualizaMs`, `inicioMs`, `canaisMs` e `commitMs` não mudaram (no máximo 0.4 ms de diferença, para menos, em todos os gestos).
- **`tentativas` e o regime.** Os quatro gestos têm `tentativas` 1 na mediana e no pior caso, `regimes: travado` e `desfechos: gravou 10`. Como não houve gravação concorrente na medição, nenhuma gravação precisou repetir, nem no antes (também `tentativas` 1): a medição de um pedido isolado não exercita o que a trava elimina.
- **O resto da subida.** `pedidoMs` subiu +60.9, +80.2, +88.3 e +75.5 ms; descontada a trava (+51.3, +51.4, +51.1 e +51.3), sobram +9.6, +28.8, +37.2 e +24.2 ms, em `hidratarMs` (+7.1, +14.0, +11.7 e +9.0 ms), `gravarMs` (+3.7, +10.2, +3.5 e +4.4 ms) e, em updateContainer, `recorteMs` (+4.0 ms). Em trashContainer e changeTaskStatus a soma das medianas das etapas não fecha com o `totalMs` (a soma das medianas não é a mediana da soma, ressalva da "Parada"): em trashContainer as onze medianas somam 520.0 ms no antes e 587.5 ms no depois (+67.5 ms), e o `totalMs` mediano vai de 471.5 a 559.9 ms (+88.4 ms); em changeTaskStatus, +65.5 contra +75.8 ms. Em createList e updateContainer as duas contas andam juntas (+61.3 contra +61.5 e +78.9 contra +79.5 ms).

## D-03 em produção

**A linha do passo 2 NÃO foi obtida.** Não há nenhuma linha "gravacao medida" do serviço real neste arquivo, e nenhuma foi escrita à mão.

O que se viu, em fatos, pelo que o dono relatou (ele rodou pela chave de deploy):

- `journalctl -u n1-crm-api.service -n 80 | grep "gravacao medida"` voltou vazio em três tentativas, depois de o dono dizer que renomeou uma Lista na tela.
- As 80 linhas do journal tinham 34 `request completed`, 34 `incoming request`, 1 "scheduler de Automações ativo", 1 "apps/api ouvindo" e 1 "Server listening". O nível de log é `info` e a janela alcança as linhas de inicialização, então as 34 requisições são tudo o que o serviço atendeu desde o deploy.
- Dessas 34, 33 eram `GET` de varredura de bots da internet (nomes de arquivo de credencial e de configuração), mais `GET /saude` e `GET /`. Nenhum `POST /operacoes/...` e nenhum `GET /estado`.
- Uma segunda busca, filtrada por `/operacoes`, `/estado` e `/v1`, voltou vazia: o app que o dono usou não gerou requisição ao serviço da VPS.

**A causa não foi apurada.** As hipóteses levantadas foram que o dono renomeou numa tela local, que a `NEXT_PUBLIC_API_URL` da tela de produção na Vercel não aponta para esta API, ou que o build da tela é anterior à hidratação pela API. Nenhuma delas foi confirmada.

**Estado da prova.** O D-03 está provado em teste (`apps/api/src/rotas/operacoes-medicao.test.ts`, que cobre a linha em 200, recusa, 409 e 500), e o comando `gravacao:medir` leu a linha com sucesso em produção: os quatro gestos têm 10 amostras e desfecho "gravou 10". Mas a linha **não foi observada no serviço real**, por requisição vinda de uma tela. O dono, perguntado, escolheu explicitamente "Seguir sem o passo 2".

**Ponto aberto para o 12-10:** tentar de novo quando a tela de produção falar com a API (renomear uma Lista na tela e procurar a linha no journal), e colar UMA linha aqui.

**Atualização do 12-10:** a segunda tentativa (depois da publicação de `37c1cab`) também voltou vazia e continua aberta; ver "D-03 em produção (depois)".

## Rastro em produção (D-04, T-12-06)

O comando grava de verdade no `ws_n1` (decisão D-04, aceita pelo dono) e nunca apaga nada:

- Cria um Espaço de teste `ZZ-MEDICAO-<carimbo>` e, para o gesto da lixeira, um segundo, `ZZ-MEDICAO-<carimbo>-lixeira`. Dentro deles cria Listas com nome `ZZ-MEDICAO-lista-<n>`, `ZZ-MEDICAO-renomeada-<n>` e `ZZ-MEDICAO-lixeira-<n>`, e uma Tarefa `ZZ-MEDICAO-tarefa`.
- Pelo desenho do comando, os Espaços de teste vão para a lixeira num `finally` (só lixeira, nunca delete); o relatório colado não mostra o estado final da lixeira.
- As Atividades dessas gravações saem assinadas pelo Proprietário do Espaço de Trabalho.
- **O carimbo não foi impresso:** a saída colada não traz o carimbo dos nomes, então ele não está registrado aqui. Quem quiser conferir procura, na lixeira do `ws_n1`, pelo prefixo `ZZ-MEDICAO`.

## Parada (2.2.2, D-06..D-08)

Esta seção prepara a parada do dono. Todo número abaixo é um valor impresso em "Antes — saída do comando" (acima) ou uma conta feita sobre valores impressos, com a conta à vista. Nenhum número vem de outra fonte, e nenhum foi estimado. Onde uma conta precisaria de um número que a saída não traz, a seção diz que ele não está lá. A meta não está aqui: quem a fixa é o dono (D-08).

### O que o "antes" é, e o que não é

- **O "antes" vem do comando em loopback na VPS** (D-17): o mesmo código (SHA `5a74ee7`), o mesmo banco e a mesma rede, mas em outro processo. Não pega o pool quente do serviço de verdade nem o nginx e o TLS do caminho do navegador. O que a pessoa sente na tela inclui esses dois trechos, e eles não estão medidos aqui.
- **O passo 2 de D-03 não foi observado em produção:** nenhuma linha "gravacao medida" do serviço real, vinda de uma requisição de tela, foi obtida (ver "D-03 em produção", acima). O D-03 está provado em teste, e o comando leu a linha com sucesso em produção, mas o "antes" não foi cruzado com uma gravação feita por uma pessoa na tela. O dono escolheu seguir sem esse passo; o 12-10 tenta de novo.
- **A meta que o dono fixar será fixada sobre este "antes"**, medido em loopback. Quem compara o "depois" a ela (12-10) usa o mesmo comando, então a comparação é de igual para igual; o que ela não garante é que a tela do dono sinta o mesmo número.
- 10 amostras por gesto: mediana e pior caso são de 10 valores. Os números têm uma casa decimal; o próprio `select 1` varia de 51.7 (mediana) a 52.9 (pior).

### Como as contas abaixo são arredondadas

- **Múltiplos do `select 1`:** valor da etapa (mediana) ÷ 51.7 (mediana do `select 1`). A conta é mostrada com duas casas e o múltiplo é **arredondado para o 0,5 mais próximo**. Motivo: são 10 amostras e o `select 1` varia cerca de 2% entre mediana e pior caso; uma casa a mais seria precisão que a medição não tem.
- **Frações do total:** etapa (mediana) ÷ `totalMs` (mediana), **arredondadas para o inteiro**. São razões entre duas medianas, não a mediana de uma razão.
- **Somas de etapas:** a soma das medianas de várias etapas **não é** a mediana da soma. Prova nos próprios números: somando as medianas das onze etapas de `createList` dá 531.5 ms, e o `totalMs` mediano impresso é 495.5 ms (diferença de 36.0 ms); em `updateContainer` 522.2 contra 477.5 (44.7), em `trashContainer` 520.0 contra 471.5 (48.5), em `changeTaskStatus` 523.9 contra 480.9 (43.0). Os números não dizem de onde vem a diferença. Por isso as frações abaixo são aproximadas e não fecham em 100% quando somadas.

### Gatilho da sessão C (D-07)

Limite: **300 ms na mediana do `hidratar` direto** (a mediana de `hidratarMs` por gesto aparece ao lado, como o plano manda).

| O que se compara | Mediana | Pior caso | Contra o limite de 300 ms |
|---|---:|---:|---|
| `hidratar` direto (4601 registros lidos) | 147.5 ms | 203.1 ms | abaixo: 300 − 147.5 = 152.5 ms de folga; 300 ÷ 147.5 = 2.03 |
| `hidratarMs` em createList | 154.6 ms | 173.4 ms | abaixo |
| `hidratarMs` em updateContainer | 148.1 ms | 163.6 ms | abaixo |
| `hidratarMs` em trashContainer | 147.9 ms | 167.8 ms | abaixo |
| `hidratarMs` em changeTaskStatus | 150.3 ms | 192.8 ms | abaixo |

**Veredito de D-07: o gatilho NÃO disparou.** A mediana do `hidratar` direto (147.5 ms) está abaixo de 300 ms, e as quatro medianas de `hidratarMs` por gesto (147.9 a 154.6 ms) também. Os dois lados do limite não divergem: nenhum número de mediana passa de 300 ms. Também nenhum pior caso impresso passa disso (o maior é 203.1 ms, o do `hidratar` direto). O comando imprimiu o mesmo veredito: "mediana 147.5 ms, abaixo do limite".

Por D-07, sem o gatilho, a sessão C **não** entra no ROADMAP. O texto dela está preparado abaixo só para o caso de o dono mandar registrá-la mesmo assim.

### Onde está o custo

Uma linha por gesto. `pedidoMs` é o tempo do pedido; `totalMs` é o tempo do `executar()`; `foraDoHandlerMs` é impresso como está, sem que a saída diga o que ele contém. Em todos os quatro gestos a etapa de maior mediana é `hidratarMs`, e a segunda é `gravarMs`.

| Gesto | `pedidoMs` mediana (pior) | `pedidoMs` ÷ 51.7 | Etapa que mais pesa: `hidratarMs` mediana (pior) | ÷ 51.7 | Fração de `totalMs` | Fração de `pedidoMs` | 2ª etapa: `gravarMs` mediana | ÷ 51.7 | `foraDoHandlerMs` mediana | ÷ 51.7 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| createList | 551.0 (597.6) | 10.66 → 10.5 | 154.6 (173.4) | 2.99 → 3.0 | 154.6 ÷ 495.5 = 31% | 154.6 ÷ 551.0 = 28% | 105.7 | 2.04 → 2.0 | 55.4 | 1.07 → 1.0 |
| updateContainer | 531.9 (550.0) | 10.29 → 10.5 | 148.1 (163.6) | 2.86 → 3.0 | 148.1 ÷ 477.5 = 31% | 148.1 ÷ 531.9 = 28% | 102.3 | 1.98 → 2.0 | 54.8 | 1.06 → 1.0 |
| trashContainer | 526.1 (563.3) | 10.18 → 10.0 | 147.9 (167.8) | 2.86 → 3.0 | 147.9 ÷ 471.5 = 31% | 147.9 ÷ 526.1 = 28% | 102.4 | 1.98 → 2.0 | 54.8 | 1.06 → 1.0 |
| changeTaskStatus | 535.5 (602.7) | 10.36 → 10.5 | 150.3 (192.8) | 2.91 → 3.0 | 150.3 ÷ 480.9 = 31% | 150.3 ÷ 535.5 = 28% | 104.3 | 2.02 → 2.0 | 54.5 | 1.05 → 1.0 |

Quanto do pedido é "ida e volta" em múltiplos do `select 1` (51.7 ms). Em todos os quatro gestos há **cinco etapas** com mediana entre 51.3 e 53.0 ms (`inicioMs`, `travaMs`, `canaisMs`, `atualizaMs`, `commitMs`), ou seja, entre 0.99 e 1.03 vezes o `select 1`, todas arredondadas para 1.0. Somadas (soma de medianas, ver ressalva acima):

| Gesto | Soma das cinco etapas de ~1× | ÷ 51.7 | ÷ `totalMs` | Cinco etapas + `foraDoHandlerMs` | ÷ 51.7 | ÷ `pedidoMs` |
|---|---:|---:|---:|---:|---:|---:|
| createList | 259.9 ms | 5.03 → 5.0 | 259.9 ÷ 495.5 = 52% | 259.9 + 55.4 = 315.3 | 6.10 → 6.0 | 315.3 ÷ 551.0 = 57% |
| updateContainer | 259.7 ms | 5.02 → 5.0 | 259.7 ÷ 477.5 = 54% | 259.7 + 54.8 = 314.5 | 6.08 → 6.0 | 314.5 ÷ 531.9 = 59% |
| trashContainer | 259.5 ms | 5.02 → 5.0 | 259.5 ÷ 471.5 = 55% | 259.5 + 54.8 = 314.3 | 6.08 → 6.0 | 314.3 ÷ 526.1 = 60% |
| changeTaskStatus | 259.5 ms | 5.02 → 5.0 | 259.5 ÷ 480.9 = 54% | 259.5 + 54.5 = 314.0 | 6.07 → 6.0 | 314.0 ÷ 535.5 = 59% |

Leitura, só aritmética sobre números impressos, sem causa afirmada:

- Cada gesto tem o `pedidoMs` mediano em cerca de 10 a 10.5 vezes o `select 1`.
- Seis dos trechos do pedido (as cinco etapas e o `foraDoHandlerMs`) custam, cada um, perto de 1× o `select 1`; juntos são cerca de 6× e 57% a 60% do `pedidoMs`. A saída não diz que cada um desses trechos é uma ida e volta ao banco; diz que cada um custa o mesmo que uma.
- `hidratarMs` custa cerca de 3× o `select 1` (31% do `totalMs`) e `gravarMs` cerca de 2× (21% a 22% do `totalMs`: 105.7 ÷ 495.5, 102.3 ÷ 477.5, 102.4 ÷ 471.5, 104.3 ÷ 480.9). O `hidratar` direto, medido fora do pedido, custa 147.5 ÷ 51.7 = 2.85 → 3.0 vezes o `select 1`.
- As etapas `conexaoMs`, `operacaoMs` e `eventosMs` ficam entre 0.0 e 0.8 ms de mediana; `recorteMs` fica entre 8.9 e 11.8 ms. Nenhuma passa de 12 ms de mediana.
- `GET /estado` (370.6 ms) é 370.6 ÷ 51.7 = 7.17 → 7.0 vezes o `select 1`.
- O que a saída **não traz** e que a conta não pode inventar: quantos comandos SQL cada etapa dispara (a saída só tem o tempo de cada etapa e `linhasLidas`/`linhasGravadas`), o que `foraDoHandlerMs` contém, e o `regime` das gravações (impresso "a linha não traz"; o 12-04 o acrescenta).
- Para ler uma meta em múltiplos: 1× = 51.7 ms (o `select 1`); o `pedidoMs` de hoje é de 526.1 a 551.0 ms de mediana.

### Entrada proposta para o ROADMAP (preparada; só entra se o dono mandar)

O gatilho de D-07 **não disparou**, então por padrão este texto **não** vai ao ROADMAP. Está pronto para o caso de o dono, na parada, mandar registrar a sessão C mesmo assim (a Task 3 copia daqui).

```markdown
### Phase N: Clone ClickUp: a Estrutura em tabelas próprias (sessão C da 2.2.2)

**Goal:** Tirar Espaço, Pasta, Lista e Tarefa de `plataforma.registros` e dar a cada um tabela própria, para o `hidratar` deixar de carregar o Espaço de Trabalho inteiro a cada gravação (8 a 10 dias; mexe na maior parte do domínio).
**Depends on:** Phase 12
**Requirements:** TBD — definidos no /gsd-discuss-phase

Nota: registrada por decisão do dono na parada da Fase 12, com `hidratar` direto em 147.5 ms na mediana, abaixo do limite de 300 ms de D-07 (o gatilho não disparou).
```

Se o gatilho tivesse disparado, a última frase seria "registrada pela parada da Fase 12 com `hidratar` direto em <N> ms na mediana (D-07)". Com 147.5 ms ela seria falsa, por isso a nota acima diz o que de fato aconteceu.

### Para o dono decidir

Três respostas possíveis (Task 2):

1. **`b-com-meta`**: o B segue como planejado, com uma meta por gesto (um número em ms, mediana do `pedidoMs`, para cada um de createList, updateContainer, trashContainer e changeTaskStatus, ou a lista dos que ficam sem meta).
2. **`b-ganho-basta`**: o B segue, sem número arbitrário; o "depois" é registrado e a fase fecha.
3. **`replanejar`**: a fase para aqui, com o motivo, e 12-04 a 12-10 não rodam.

E sobre a sessão C: o gatilho não disparou, então por D-07 ela não entra; só entra se o dono responder "C no ROADMAP" (com o texto acima).

A meta pode ser um número por gesto (ms do pedido) ou "o ganho que o B der basta".

### Decisão do dono (2026-11-02)

- **Resposta do dono, sem paráfrase:** "pode seguir com o caminho que voce recomenda"
- **O que isso é:** o dono aceitando a recomendação do orquestrador na parada (`b-ganho-basta` e "C não entra"). Não é um texto em que o dono digitou o nome de uma opção.
- **Lido como:** `b-ganho-basta` e `C não entra`.
- **Opção escolhida:** `b-ganho-basta`. O caminho B segue como planejado (12-04 a 12-10 rodam).
- **Meta:** nenhuma meta numérica por gesto. O ganho que o B der basta. O 12-10 registra o "depois" ao lado do "antes", com o mesmo comando, e a fase fecha com os dois valores. A mesma frase está em `12-CONTEXT.md`, seção "Meta (fixada na parada)".
- **Sessão C:** não entra. O gatilho de D-07 não disparou (a mediana do `hidratar` direto, 147.5 ms, ficou abaixo do limite de 300 ms) e o dono não mandou registrá-la. Nenhuma fase foi adicionada ao ROADMAP; o texto de "Entrada proposta para o ROADMAP" fica aqui só como registro.

## Operações que esperam o servidor (D-13)

Levantamento do plano 12-07 (2026-11-02). A lista mora em `apps/web/src/dados/operacoes-que-esperam.ts` (`OPERACOES_QUE_ESPERAM`, nome → motivo) e o conjunto é fechado por `operacoes-que-esperam.test.ts`. Um gesto em que qualquer chamada está na lista não vira `data` na hora: espera a resposta do servidor, como antes da fase.

### Critério

Espera o servidor a operação cujo resultado local difere do que o servidor grava de um jeito que a pessoa vê e usa: (1) valor aleatório ou de contador de módulo gerado na operação; (2) resolução que só o servidor faz antes da transação (`SERVICOS`); (3) efeito de relógio ou idempotência do servidor que a cópia não enxerga. Ficam otimistas: ids sequenciais (`nextId`, `activity.ts:12`; D-15 cobre com "sem link até confirmar"), timestamps (`now()`), Execuções de Automação e Atividade, o disparo da ponte do Agente (`tarefasAfetadasPelaOperacao`, `apps/api/src/rotas/operacoes.ts:144`, depois do commit) e o recorte por Membro.

### Como o levantamento foi feito

1. Varredura mecânica em `packages/dominio/src` (fora de `*.test.ts`) por `secret(`, `gerarJid(`, `gerarEnderecoDeConvite(`, `gerarChavePublica(`, `gerarIdentificadorDeFlow(`, `gerarIdentificadorDeResposta(`, `crypto.`, `Math.random(`, `randomUUID(`, `getRandomValues`: só `scale.ts:48` (`crypto.getRandomValues`) e as cinco funções de `ferramentas/provedor-simulado.ts:65-96`, que usam o contador de módulo `let sequencia = 0` (`provedor-simulado.ts:55`). Nenhum `Math.random` nem `randomUUID` no domínio.
2. Varredura de contadores de módulo (`^let `): `activity.ts:9` (`sequence`, o `nextId`: ids sequenciais, fora do critério), `provedor-simulado.ts:55` (`sequencia`), `automations.ts:696` e `ferramentas/automacoes.ts:185` (`profundidade`, a guarda de recursão: sobe e desce no `try/finally`, nunca aparece na tela) e `registro.ts:765` (`gravador`, o gravador de chamadas).
3. Para cada ocorrência, a função exportada que a contém (por `awk` sobre o arquivo) e todos os chamadores dela no domínio (`grep` do nome da função): nenhuma função da tabela abaixo tem chamador que seja outra operação do registro; o único chamador de `createForm` fora do registro é `garantirFormularioDaSolicitacao` (`formulario-da-solicitacao.ts:114`), usado só pelo bootstrap da API (`apps/api/src/bootstrap/formulario-da-solicitacao.ts`), que não está em `OPERACOES`.
4. `SERVICOS` em `apps/api/src/rotas/operacoes.ts:228`: tem uma única entrada, `inviteMember`.
5. As sete candidatas `[ASSUMED]` da RESEARCH (A4): o corpo de cada uma foi lido.
6. Os 14 nomes da lista e as 7 candidatas foram conferidos como chaves de `OPERACOES` (`registro.ts:421-742`).

### As catorze verificadas na RESEARCH: ficam na lista

| Operação | Gerador / evidência (arquivo:linha) | Veredito | Motivo |
|---|---|---|---|
| `createForm` | `scale.ts:348` `secret: secret()`; `scale.ts:46-50` `crypto.getRandomValues` | espera | 1: o segredo do link público é aleatório; o da cópia nunca é o do servidor |
| `rotateFormSecret` | `scale.ts:419` `form.secret = secret()` | espera | 1: idem |
| `shareTaskPublicly` | `scale.ts:614` `task.publicShare = { secret: secret(), … }` | espera | 1: idem |
| `criarGrupo` | `ferramentas/grupos.ts:156` `gerarJid(state)`, `:165` `gerarEnderecoDeConvite()`; contador `provedor-simulado.ts:55` | espera | 1: JID e link de convite saem do contador do módulo |
| `sincronizarGrupo` | `grupos.ts:384` `gerarEnderecoDeConvite()` | espera | 1: idem |
| `regenerarLinkDeConvite` | `grupos.ts:530` `gerarEnderecoDeConvite()` | espera | 1: idem |
| `criarComunidade` | `ferramentas/comunidades.ts:70` e `:89` `gerarJid(state)` (a linha 89 está DENTRO de `criarComunidade`, que começa na 45: é o Grupo de avisos da mesma função; fecha a premissa A5 da RESEARCH) | espera | 1: a Comunidade e o Grupo de avisos recebem JID do contador |
| `definirPontoDeTrocaDeDados` | `ferramentas/flows.ts:231` `gerarChavePublica()` | espera | 1: a chave pública sai do contador |
| `regenerarChavesDoPonto` | `flows.ts:243` `gerarChavePublica()` | espera | 1: idem |
| `publicarVersao` | `flows.ts:651` `gerarIdentificadorDeFlow()` | espera | 1: o identificador externo do Flow sai do contador |
| `copiarFlow` | `flows.ts:735` `gerarChavePublica()` | espera | 1: a cópia ganha chave nova do contador |
| `inviteMember` | `apps/api/src/rotas/operacoes.ts:237-249` (`SERVICOS.inviteMember`): o servidor resolve e-mail → `userId` no Supabase Auth antes da transação e reativa Membro removido; a cópia roda sem `userId` | espera | 2: resolução só do servidor (T-12-18) |
| `runScheduledAutomations` | `automations.ts:750`; `jaRodou` em `:794-800`; chamado com `new Date()` em `features/estrutura/bulk-status-bar.tsx:210` e `features/estrutura/financeiro/contas-view.tsx:376` | espera | 3: idempotência e corrida com o agendador do servidor |
| `runCalendarRecurrences` | `collaboration.ts:544`; chamado com `new Date()` em `features/estrutura/bulk-status-bar.tsx:218` | espera | 3: cria registros em massa com ids da sequência, em corrida com o agendador |

As linhas citadas pela RESEARCH para `flows.ts` (`651`, `735`) são as das chamadas ao gerador, não as da função (`publicarVersao` começa na 624, `copiarFlow` na 708); as duas conferem.

### As sete candidatas `[ASSUMED]`: lidas, ficam otimistas

| Candidata | Onde (arquivo:linha) | O que o corpo faz | Veredito | Motivo |
|---|---|---|---|---|
| `importarGruposDoCanal` | `ferramentas/grupos.ts:293`; lê `GRUPOS_NO_PROVEDOR[canal.externalId]` em `:300` | Cria Grupos a partir de uma tabela fixa do módulo (`provedor-simulado.ts:31`): o JID (`remoto.jid`) e o link (`remoto.linkDeConvite`) vêm dela, não de `gerarJid` nem de `gerarEnderecoDeConvite`; só os ids são `nextId("grp")` | otimista | Não há gerador aleatório nem de contador: a tabela é a mesma no cliente e no servidor; o que difere é só o id sequencial (D-15) |
| `criarRascunhoAPartirDe` | `flows.ts:691`; `novaVersao` em `:701` (definida em `:76`) | Copia as telas da Versão de origem; o id é `nextId("vfl")` e o número é `max + 1` | otimista | Sem gerador; id sequencial e número derivados do estado |
| `enviarFlow` | `flows.ts:845`; delega a `sendMessage` (`conversations.ts:165`, `nextId("msg")` em `:225`) | Valida o Flow publicado, a Conversa e o Canal e grava a Mensagem com o Flow anexado; o identificador de resposta do provedor (`gerarIdentificadorDeResposta`, `flows.ts:935`) é de `receberRespostaDeFlow`, que NÃO está em `OPERACOES` (`registro.ts:266`) | otimista | Sem gerador; id sequencial e `now()`. A janela de 24 h compara o relógio da própria cópia (`Date.now()`), não um relógio que só o servidor tem |
| `ensaiarAgente` | `ia/agentes.ts:428`; id `nextId("exe")` em `:444`; passos em `:488-509` | Monta uma Execução `rehearsal` com passos fixos ("Leitura simulada de …", "Escrita não aplicada: ensaio") e referências de Conhecimento lidas do estado; não chama modelo algum. Em `apps/api/src` o nome só aparece no esquema de argumentos (`rotas/esquemas/ia-agentes.ts:24`); o "ensaio" do resto da API (`AUTOMACOES_ENSAIO_PRIMEIRA_VOLTA`, `observabilidade/`) é a primeira volta do agendador de Automações, outra coisa | otimista | A resposta do ensaio é determinística sobre o estado e nasce no domínio, não num servidor nem num gerador |
| `sendChatMessage` | `ai.ts:955`; `nextId("cmg")` em `:970` | Só acrescenta a mensagem do USUÁRIO à Sessão (`role: "usuario"`); não há resposta do assistente nesta operação, e `role: "assistente"` só aparece no seed (`seed.ts:2501,2517,2536`) | otimista | Sem gerador; a resposta do assistente não é produzida por ela |
| `runLancamentoAgent` | `financeiro.ts:406`; `nextId("exe")` em `:437`; de-para `opcoes?.dePara ?? DE_PARA_DO_PROTOTIPO` em `:414` (`:189`) | Gera o Resumo de pagamento a partir da Tarefa e de um de-para constante; o lançamento no ERP é "simulado (Integração ERP do protótipo)" (`:530`). Não há chamador na web (`grep`), só o esquema de argumentos da API | otimista | Sem gerador, sem I/O; determinística sobre o estado |
| `converterSolicitacaoEmContaAPagar` | `conversao-de-solicitacao.ts:185`; `createTask` em `:251`; `agoraISO` em `:59` | Valida a Solicitação aprovada e cria a Conta a pagar, tudo ou nada; o id legível (`CP-n`) sai do contador do ESTADO (`workspace.taskReadableId.next`, `tasks.ts:201-204`), que viaja com `data` | otimista | Sem gerador de módulo; o id e o id legível são sequenciais (D-15 cobre) e a Atividade chega na confirmação |

### Achadas pela varredura e fora do registro

| Função | Onde | Por que não entra |
|---|---|---|
| `receberRespostaDeFlow` | `flows.ts:910`; `gerarIdentificadorDeResposta()` em `:935` | Evento do provedor, sem `actingMemberId`; fora de `OPERACOES` (`registro.ts:266`), nenhum `run` da tela a chama |
| `garantirFormularioDaSolicitacao` | `formulario-da-solicitacao.ts:106` (chama `createForm` em `:114`) | Bootstrap da API; fora de `OPERACOES` |

### Veredito

A lista fica com as catorze entradas verificadas; o levantamento não acrescentou nenhuma e não tirou nenhuma. As sete candidatas `[ASSUMED]` foram lidas e ficam otimistas. Toda operação do registro que usa um gerador aleatório ou de contador do domínio está na lista; o único outro contador de módulo que a pessoa vê é o `nextId`, que D-15 cobre.

### Candidata de UX, fora do critério — decisão do dono

`decideProcessApproval` (o painel de aprovação) e a conferência do resumo (`painel-conferencia-do-resumo.tsx`), que usa o mesmo molde, não entram na lista: o resultado local é o que o servidor grava, então não cumprem o critério acima. Foram achadas pelo 12-06, que reescreveu o teste (e) de `painel-aprovacao.test.tsx` para o comportamento de hoje.

- **O que acontece hoje (D-13):** a decisão aparece na hora, o cartão mostra "Aprovação concluída", o diálogo fecha e o aviso de sucesso sai ANTES da resposta do servidor. Se o servidor recusa, o cartão volta a "Aprovação pendente" com o erro (D-14), mas o diálogo já fechou.
- **O que mudaria se entrasse na lista:** o botão ficaria em "Aprovando…" até a resposta, como era antes da fase; o diálogo só fecharia, e o aviso só sairia, depois da confirmação.
- **O que isso custa:** nesse gesto a tela voltaria a esperar uma ida e volta ao servidor para mostrar a decisão, ou seja, perderia o ganho de velocidade percebida que D-13 dá aos demais gestos. Entrar na lista não é uma decisão técnica (o resultado local não difere do servidor): é a escolha de produto entre "parecer decidida na hora" e "só parecer decidida depois da confirmação". Não foi alterada; a lista e o conjunto fechado do teste ficam como estão até o dono decidir.

## Ensaio local do depois

Ensaio do plano 12-10 (Task 1), feito em 2026-11-02, de 14:32Z a 14:48Z, num Postgres descartável em Docker (`postgres:16`, contêiner criado para o ensaio e removido ao fim; `docker ps -a` sem nenhum contêiner `crm-n1-pg` depois). **Isto NÃO é o "depois".** O "depois" é a saída do mesmo comando na VPS (Task 2, do dono). Nada daqui entra na coluna "Depois" da tabela antes/depois: os tempos locais não se comparam aos da VPS (aqui o `select 1` mediano é 0.3 ms; na VPS, 51.7 ms) e o Espaço local é o seed (1007 registros), não os 4601 de produção.

- **SHA ensaiado (`git rev-parse HEAD` antes do commit deste arquivo):** `faa5be8b9ce2e5b9023c5d5272584fb8118a3fb6`, no ramo `fase-11`.
- **SHA a publicar (último commit de código da fase, `git log --oneline -1 -- apps packages`):** `37c1cab` (`feat(12-09)`: fechar a aba com gravação pendente pede confirmação). Os commits depois dele (`faa5be8` e o deste ensaio) só tocam `.planning/`; para `apps/` e `packages/` o conteúdo é idêntico ao de `37c1cab`. Se o dono passar pela `main` do `n1`, o SHA publicado será o da `main` depois do merge, e o `REVISION` na VPS terá esse SHA.
- **Portão local:** o Postgres descartável foi migrado (`npm run migrar -w @n1/api`, 001 a 010 aplicadas) e o `npm run check` da raiz rodou com `DATABASE_URL` e `DATABASE_URL_MIGRACAO` apontando para ele, na mesma linha de comando; o `.env` não foi usado para o banco.
- **Resultado do `npm run check`: verde na terceira rodada (`EXIT=0`).** Passos de tipos (3 workspaces), lint (0 erros, 2 avisos de import não usado em `apps/web/src/features/ia/conhecimento/rotulos.ts` e `apps/web/src/features/shell/app-shell.tsx`), `verificar:tokens` e `verificar:contratos` passaram nas três rodadas. Testes na rodada verde:

| Workspace | Arquivos | Testes |
|---|---|---|
| `@n1/dominio` | 113 passaram | 2198 passaram |
| `@n1/web` | 97 passaram | 918 passaram |
| `@n1/api` | 158 passaram, 2 pulados (160) | 1722 passaram, 21 pulados, 2 `expected fail`, 1 `todo` (1746) |

- **Rodadas que falharam, sem mudar nada no código:** a primeira (`@n1/api`: `outbox-worker.test.ts`, casos (i) e (k)) e a segunda (mesmo arquivo, caso (i)) falharam só nesse arquivo; `@n1/web` e `@n1/dominio` passaram inteiros nas duas. Rodado isolado, o arquivo falhou também (1 a 2 casos entre (i), (j) e (k) em 8 de 9 rodadas isoladas seguidas; passou 15/15 em 1). Nos casos que falham, o worker não chega a reivindicar a linha (a linha fica `pending`; no (i) o servidor falso recebeu 0 pedidos). O arquivo e o `outbox-worker.ts` não mudam na fase (`git diff` do intervalo vazio para os dois, e para `conexao.ts` e `testes/`). **Hipótese, não provada:** o teste insere `available_at` com o relógio da máquina e o worker reivindica com `available_at <= now()` do banco; numa medição solta o relógio do Postgres em Docker estava cerca de 7 ms atrás do da máquina, e uns dez minutos depois cerca de 0,5 ms. A terceira rodada completa foi verde sem mexer em nada; uma quarta rodada só da API (para listar os pulados) voltou a ter 1 falha no mesmo arquivo. É o ruído já visto nas Fases 11 e 12, não regressão desta fase.
- **O que saiu pulado, e por quê:** `apps/api/src/e2e/dois-servicos.test.ts` (9) e `apps/api/src/e2e/falhas-injetadas.test.ts` (9) ficam inteiros pulados porque o repositório irmão `financeiro-tria` não está ao lado deste (`describe.skip`; ambiental, não corrigido). `contrato-contas-a-pagar.test.ts` pula o bloco "cópia verbatim da pasta do produtor (financeiro-tria)" pelo mesmo motivo. Os outros três pulos avulsos (`rotas/integracao-solicitacoes.test.ts`, `importacao/clickup/contas-a-pagar.test.ts`, `importacao/clickup/contas-a-receber.test.ts`, 1 cada) não tiveram o motivo aberto um a um. `lote-contas-a-pagar` passou com o banco migrado.
- **O domínio e o schema intactos:** com `BASE` = `c821b53` (o primeiro commit de `git log --reverse --grep='(12-01)'`), `git diff --stat BASE^..HEAD -- packages/dominio` não imprime nada, e `git diff --stat BASE^..HEAD -- apps/api/migracoes` também não (nenhuma migração nova na fase; contra `n1/main` local também vazio).
- **O mesmo comando, sobre o código final, no Postgres local:** `npm run --silent gravacao:medir -w @n1/api -- --repeticoes=10` (com `WORKSPACE_ID=ws_n1`, Espaço de Trabalho `ws_n1` semeado com o seed no banco descartável, e as duas variáveis de banco locais). `revisão do código` saiu "(sem REVISION)", como esperado fora da VPS. **Para os quatro gestos, no ensaio local: `regimes: travado`, `tentativas` mediana 1 e pior 1, `desfechos: gravou 10`.**

| Gesto (ensaio local, não é o "depois") | `regimes` | `tentativas` mediana / pior | `desfechos` | `travaMs` mediana | `pedidoMs` mediana |
|---|---|---|---|---:|---:|
| createList | travado | 1 / 1 | gravou 10 | 0.6 ms | 15.8 ms |
| updateContainer | travado | 1 / 1 | gravou 10 | 0.6 ms | 15.5 ms |
| trashContainer | travado | 1 / 1 | gravou 10 | 0.6 ms | 15.4 ms |
| changeTaskStatus | travado | 1 / 1 | gravou 10 | 0.6 ms | 15.4 ms |

  No `medir-gravacao.test.ts` (10 testes) o caso dos quatro gestos com `regimes` igual a `["travado"]` passou também em rodada à parte.
- **Limite deste ensaio:** ele prova que o código final, com o comando de sempre, mostra a trava nova e uma tentativa por gravação num Postgres local. Não prova nada sobre o tempo na VPS, sobre o pool quente do serviço, sobre o nginx e o TLS, nem sobre a tela no navegador (a conferência visual e o aviso ao fechar a aba, `beforeunload`, não foram vistos em navegador nesta fase; só provados por teste).

## D-03 em produção (depois)

**A linha "gravacao medida" do serviço real NÃO foi observada.** Não há, neste arquivo, nenhuma linha do `n1-crm-api.service` colada do `journalctl`, e nenhuma foi escrita à mão. Registro: **NÃO OBSERVADO**, aberto.

O que se viu, em fatos:

- O dono rodou `ssh -i ~/.ssh/n1_crm_deploy_ci n1crm@85.155.186.214 'sudo -n /usr/bin/journalctl --no-pager -u n1-crm-api.service -n 80' | grep "gravacao medida"` e a saída voltou **vazia** (nenhuma linha).
- O dono **não disse** se fez o gesto (criar uma Lista) na tela de produção antes do `grep`, nem o que viu. Também **não disse** "seguir sem este passo": a decisão sobre o D-03 do "depois" não foi tomada.
- A web nova não está no ar: o PR #3 (https://github.com/n1-tecnologia/crm/pull/3) estava **aberto, não mesclado**, quando o orquestrador o leu (2026-11-02, cerca de 19:00Z: `OPEN`, `MERGEABLE`, `UNSTABLE`, `headRefOid` `b997d21c211509f500f3404a45013eab63042b91`, checks `check` e `seguranca` em andamento, preview da Vercel pendente). A web de produção segue no estado de 29/10. Na rodada do "antes", a tela que o dono usou não gerou nenhuma requisição ao serviço da VPS (nenhum `POST /operacoes` nas 34 requisições do journal; ver "D-03 em produção"), e essa causa **não foi apurada**; esta rodada não a esclarece.

**O que a medição de produção prova, e o que não prova.** A saída do `gravacao:medir` (acima) mostra `regimes: travado` e `tentativas` 1 nos quatro gestos, medidos pelo código de `37c1cab` **contra o banco de produção** (`ws_n1`): a linha "gravacao medida" que o comando lê do Fastify que ele mesmo sobe em loopback, no processo dele, traz o regime e a tentativa. Isso prova que o código publicado, executando contra o banco real, escolhe o regime `travado` e grava com uma tentativa. **Não prova** que o serviço de verdade (pool quente do `n1-crm-api.service`, nginx e TLS, uma requisição vinda de uma pessoa na tela) escreve a linha com `"regime":"travado"`: o caminho HTTP real não foi observado. A linha em si continua provada por teste (`apps/api/src/rotas/operacoes-medicao.test.ts`).

**Ponto aberto para o dono** (depois do merge do PR #3 e do deploy da web): criar uma Lista num Espaço seu na tela de produção e rodar `ssh -i ~/.ssh/n1_crm_deploy_ci n1crm@85.155.186.214 'sudo -n /usr/bin/journalctl --no-pager -u n1-crm-api.service -n 200' | grep "gravacao medida"`; colar UMA linha aqui (precisa ter `"regime":"travado"` e nenhum nome):

```text
(vazio: a linha ainda não foi colada)
```

## Conferência do dono na tela

**NÃO FEITA.** Não há resposta do dono sobre a tela. Razões, em fatos: (1) a web nova (store com `confirmado`/`data`, o "salvando", a guarda de navegação, o aviso ao fechar a aba) **não está em produção**, porque o PR #3 não foi mesclado; sem ela, criar uma Lista na tela de produção não mostra nada do que a fase muda; (2) o `grep` do passo 3 voltou vazio e o dono não relatou o gesto nem o que viu. A pergunta do plano, "a Lista apareceu na hora, sem link, e virou link em seguida?", **não foi respondida**.

O que fica provado **só por teste** (jsdom, transporte falso), sem conferência em navegador:

- a Lista aparece na árvore antes da resposta do servidor, e some com o erro quando o servidor recusa (12-06, `store.test.ts`);
- o item novo aparece "salvando", sem link, com `aria-busy`, até o servidor confirmar (12-08, `arvore-salvando.test.tsx`, `tarefa-salvando.test.tsx`);
- o clique cancelado numa âncora com id pendente (`click`, `auxclick`, cmd/ctrl+clique e Enter) e o aviso ao fechar a aba com gravação pendente (12-09, `guarda-de-navegacao.test.tsx`).

O diálogo nativo do navegador no `beforeunload` e o comportamento real do clique em Chrome e Safari não foram vistos. Isso entra nos "Seguimentos" como pendência do dono, ligada ao merge do PR #3.

## Comparação com a meta (D-08)

**A meta** é a decisão `b-ganho-basta` da parada: o ganho que o B der basta, sem alvo numérico por gesto. Com isso, a comparação é só contra o "antes" (`12-CONTEXT.md` § "Meta (fixada na parada)"). Nenhum número de meta foi inventado.

**Veredito, gesto por gesto, na medição que o comando faz (um pedido de cada vez, sem concorrência, em loopback na VPS):** o `pedidoMs` **subiu** nos quatro. Contra "o ganho que o B der basta", nesta medição **não bateu** em nenhum.

| Gesto | `pedidoMs` mediana: antes → depois | Diferença | `travaMs` mediana: antes → depois | Resto da diferença (depois − antes − trava) | Veredito |
|---|---:|---:|---:|---:|---|
| createList | 551.0 → 611.9 ms | +60.9 ms (+11,1%) | 51.8 → 103.1 ms (+51.3) | +9.6 ms (`hidratarMs` +7.1, `gravarMs` +3.7) | não bateu: subiu |
| updateContainer | 531.9 → 612.1 ms | +80.2 ms (+15,1%) | 51.8 → 103.2 ms (+51.4) | +28.8 ms (`hidratarMs` +14.0, `gravarMs` +10.2, `recorteMs` +4.0) | não bateu: subiu |
| trashContainer | 526.1 → 614.4 ms | +88.3 ms (+16,8%) | 51.7 → 102.8 ms (+51.1) | +37.2 ms (`hidratarMs` +11.7, `gravarMs` +3.5, `recorteMs` +1.8; o resto não cabe nas medianas das etapas) | não bateu: subiu |
| changeTaskStatus | 535.5 → 611.0 ms | +75.5 ms (+14,1%) | 51.7 → 103.0 ms (+51.3) | +24.2 ms (`hidratarMs` +9.0, `gravarMs` +4.4, `recorteMs` +1.4) | não bateu: subiu |

**A etapa que explica a maior parte da subida é a trava**, e a conta fecha com o código. Em `executar()` (`apps/api/src/persistencia/unidade-de-trabalho.ts`), no regime `travado` o `travaMs` soma duas instruções: o `select revisao … for update` (`SQL_DA_TRAVA`), que ficou antes de `hidratar`, e o `update … returning revisao` (`SQL_REVISAO_TRAVADO`), que também entra em `atualizaMs`. No regime otimista do "antes" o `travaMs` era só o `update`, e por isso era igual a `atualizaMs` (51.8 = 51.8, 51.8 = 51.8, 51.7 = 51.7, 51.7 = 51.7). No "depois", `travaMs − atualizaMs` é 51.6, 51.7, 51.3 e 51.5 ms, e o `select 1` da mesma rodada é 51.4 ms: **a trava custou exatamente uma ida e volta a mais** (uma instrução de uma ida só custa o `select 1`; `inicioMs`, `canaisMs`, `atualizaMs` e `commitMs` repetem esse valor nas duas rodadas). É a RESEARCH Pitfall 9, e é o que o `12-04-SUMMARY.md` deixou para esta medição decidir (item "o regime travado não piora a gravação sem concorrência"): **piora, em uma ida e volta (cerca de 51 ms), e a medição de um pedido isolado não mostra o ganho que a trava compra.** O resto da subida (+9.6 a +37.2 ms) vem de `hidratarMs`, `gravarMs` e `recorteMs` e acompanha uma base que cresceu 72 registros; a saída não diz mais do que isso, e o ruído entre rodadas (ver a nota sobre `GET /estado` e `hidratar` direto acima) é da mesma ordem.

**Opção para o dono decidir (Pitfall 9), sem implementar.** Recuperar a ida e volta da trava sem mudar a semântica de D-09 (a hidratação continua vindo depois da trava, em instrução própria):

1. **(b1) Juntar `begin` e a trava numa consulta só:** enviar `begin; set local …; select revisao … for update` numa única consulta simples. Exige escapar o `workspaceId` (a RESEARCH aponta `pg.escapeLiteral`, marcada `[ASSUMED]` e ainda a conferir na versão instalada; as fakes de teste só têm `query`).
2. **(b2) Tomar a trava com o próprio `update … set revisao = revisao + 1 … returning revisao` no começo** (o `rollback` desfaz em recusa), o que apaga a instrução `update` do fim.

Qualquer das duas economiza **uma ida e volta, cerca de 51.4 ms (o `select 1` desta rodada)** por gravação. A conta, sobre as medianas impressas e **não medida**: createList 611.9 − 51.4 = 560.5 ms (antes: 551.0), updateContainer 612.1 − 51.4 = 560.7 (531.9), trashContainer 614.4 − 51.4 = 563.0 (526.1), changeTaskStatus 611.0 − 51.4 = 559.6 (535.5). Mesmo assim ficaria 9.5, 28.8, 36.9 e 24.1 ms acima do "antes" nesta medição isolada, porque o resto da subida (hidratação e gravação sobre uma base maior) não é da trava. É decisão do dono; nada foi mudado em `apps/` nem em `packages/`.

**O que a medição NÃO capta.** O ganho da fase não está no `pedidoMs` de um pedido isolado:

- **Na tela:** a mudança aparece na hora, sem esperar a resposta (12-06 a 12-09). Esse ganho é a distância entre o clique e a Lista na árvore, e o `gravacao:medir` mede o pedido ao servidor, não a tela. Está provado por teste, não medido em navegador.
- **Sob concorrência:** uma tentativa em vez de até três, sem re-hidratar a cada falha (12-04). No "antes", cada repetição refazia pelo menos `inicioMs`, `hidratarMs`, `canaisMs` e o `update` (304 a 311 ms em medianas do "antes": 310.7, 304.2, 303.9 e 306.3), fora o `rollback`; a trava custa 51.4 ms em toda gravação e troca essas repetições por uma espera. A medição de um pedido de cada vez nunca tem conflito (`tentativas` 1 nas duas rodadas), então não mostra isso. A prova está no teste de concorrência de 12-04 (`unidade-de-trabalho-concorrencia.test.ts`, contra Postgres 16 local): duas `executar()` simultâneas no mesmo Espaço hidratam 2 vezes em vez de 3, com `tentativas` 1 nas duas.
- **O caminho real do navegador:** o nginx e o TLS, e o pool quente do serviço, não estão no comando (D-17).

**D-07.** `hidratar` direto: mediana 186.6 ms, abaixo do limite de 300 ms (folga de 113.4 ms; no antes, 147.5 ms). Subiu 39.1 ms. O gatilho da sessão C não disparou; ela continua fora do ROADMAP, mas a folga encolheu e `hidratar` é a maior etapa de cada gesto (159.3 a 162.1 ms de mediana no "depois").

## Pronto da 2.2

Os três itens do "Pronto quando" da 2.2 (`docs/09-planejamento/TAREFAS-POR-SESSAO.md`, linhas 503-508, só leitura), com a prova de cada um:

| # | Pronto quando | Prova | Estado |
|---|---|---|---|
| 1 | "Os tempos de `createList`, `updateContainer`, `trashContainer` e `changeTaskStatus` medidos em produção antes e depois estão anotados" | A tabela acima (mesmo comando, SHA `5a74ee7` e SHA `37c1cab`, mediana e pior caso por etapa, `select 1`, `hidratar` e `GET /estado` nas duas rodadas). Medido na VPS contra o banco de produção, em loopback (D-17). | **Provado** pela medição. Ressalva: não é o caminho do navegador (sem nginx/TLS) e a linha de log do serviço real não foi observada (D-03, aberto). |
| 2 | "criar uma Lista aparece na árvore antes da resposta do servidor" | Testes: `store.test.ts` com transporte lento (12-06: `data.lists` já tem a Lista antes de o transporte responder; com `ok: false` ela some e `lastResult.error` traz a mensagem) e `arvore-salvando.test.tsx` (12-08: aparece sem link, "salvando", até confirmar). | **Provado só por teste.** A conferência do dono em produção está **PENDENTE**: a web nova não está no ar (PR #3 aberto) e o dono não respondeu. |
| 3 | "duas gravações simultâneas no mesmo Espaço de Trabalho não hidratam de novo" | `unidade-de-trabalho-concorrencia.test.ts` (12-04), contra Postgres 16 local: as duas `executar()` hidratam 2 vezes (não 3), `tentativas` 1 nas duas, revisões n+1 e n+2, e a segunda hidratação enxerga o que a primeira gravou; o regime otimista, de contraste, hidrata 3 vezes. Em produção, a medição mostra `regimes: travado` e `tentativas` 1 nos quatro gestos. | **Provado só por teste** (Postgres local). A concorrência em produção não foi exercitada. |

A 2.2 está **fechada nos números e nos testes**, e **aberta em dois pontos que dependem do dono**: a conferência visual em produção (item 2) e a linha de log do serviço real (D-03).

## Seguimentos

- **Conferência visual no navegador, PENDENTE do dono**, ligada ao merge do PR #3: criar uma Lista e ver "salvando" e o link depois; o clique cancelado; o aviso ao fechar a aba (`beforeunload`). Hoje só provados por teste.
- **O D-03 em produção, ainda por observar:** a linha `"gravacao medida"` com `"regime":"travado"` do serviço real (seção "D-03 em produção (depois)"); o dono cola UMA linha depois do deploy da web.
- **PR #3 aberto** (https://github.com/n1-tecnologia/crm/pull/3): traz a Fase 11 junto, porque o ramo é `fase-11`. A API de produção roda `37c1cab`, que a `main` do `n1` ainda não tem; enquanto o PR não for mesclado, a VPS está à frente da `main`.
- **Decisão sobre a ida e volta a mais da trava (Pitfall 9)**: juntar `begin` e trava, ou tomar a trava no `update`; economiza cerca de 51.4 ms por gravação. Não implementada.
- **Telas só com a guarda de navegação, sem o visual de "salvando"** (12-09): a guarda cancela o clique em qualquer âncora com id pendente, mas só a árvore e a Tarefa ganharam o texto "Salvando…". As outras telas mostram o item e ele não navega, sem explicação visível.
- **O custo do `structuredClone` de `confirmado` com pendentes (premissa A8)**: não medido no navegador (12-06). Com fila de um não há clone a mais; com dois cliques seguidos há um clone e um refazer por resposta.
- **`apps/web/src/features/crm/iniciar-conversa-dialog.tsx:113`** faz `router.push` para `/crm/caixa-de-entrada/<conversation.id>` com o id do resultado local de um `run`; se o servidor der outro id, leva a uma conversa que não existe. Trocar por `runConfirmado` muda o ritmo do diálogo e é **decisão de produto** (12-06, 12-09).
- **O painel de aprovação (`decideProcessApproval`) e a conferência do resumo** (`painel-conferencia-do-resumo.tsx`) fecham o diálogo e soltam o aviso de sucesso antes de o servidor responder; se ele recusa, o cartão volta a pendente com o erro, mas o diálogo já fechou. Decisão de produto do dono (seção "Candidata de UX, fora do critério").
- **Espaços `ZZ-MEDICAO-*` que sobraram na lixeira do `ws_n1`:** dois do "antes" e dois do "depois" (o Espaço de teste e o da lixeira, por rodada). A medição nunca apaga; o dono limpa se quiser, pelo prefixo `ZZ-MEDICAO`. O carimbo não foi impresso nas duas rodadas.
- **A sessão C (as tabelas próprias de Espaço, Pasta, Lista e Tarefa)** foi registrada na parada como **NÃO executada** (gatilho de D-07 não disparou; o dono não mandou registrá-la). `hidratar` direto foi de 147.5 para 186.6 ms: ainda abaixo de 300 ms, com a folga menor.
- **A ligação da 2.2 para `12-PROVAS.md`** em `docs/09-planejamento/TAREFAS-POR-SESSAO.md` não foi feita (o arquivo tem mudanças do dono não commitadas); fica com o dono.
