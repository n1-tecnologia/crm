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

Os números da coluna "Antes" são os impressos acima: mediana e pior caso de 10 amostras por gesto, em ms (as três últimas linhas de cada gesto são contagens: `tentativas`, `linhasLidas`, `linhasGravadas`). As colunas "Depois" e "Meta" ficam vazias: o 12-03 fixa a meta e o 12-10 mede o depois.

Linhas de referência (10 amostras cada):

| Referência | Antes: mediana | Antes: pior caso | Depois | Meta |
|---|---:|---:|---|---|
| `select 1` (ida e volta VPS↔banco) | 51.7 ms | 52.9 ms | | |
| `hidratar` direto (transação só de leitura; 4601 registros lidos) | 147.5 ms | 203.1 ms | | |
| `GET /estado` (total) | 370.6 ms | 429.7 ms | | |

O comando compara o `hidratar` direto com o limite de 300 ms da sessão C (D-07): mediana de 147.5 ms, "abaixo do limite".

Por gesto e por etapa:

| Gesto | Etapa | Antes: mediana (ms) | Antes: pior caso (ms) | Depois | Meta |
|---|---|---:|---:|---|---|
| createList | conexaoMs | 0.1 | 0.2 | | |
| createList | inicioMs | 51.5 | 51.8 | | |
| createList | travaMs | 51.8 | 52.3 | | |
| createList | hidratarMs | 154.6 | 173.4 | | |
| createList | canaisMs | 52.8 | 53.0 | | |
| createList | operacaoMs | 0.3 | 1.5 | | |
| createList | atualizaMs | 51.8 | 52.3 | | |
| createList | gravarMs | 105.7 | 145.4 | | |
| createList | eventosMs | 0.1 | 0.1 | | |
| createList | commitMs | 52.0 | 52.4 | | |
| createList | recorteMs | 10.8 | 19.0 | | |
| createList | totalMs | 495.5 | 540.9 | | |
| createList | pedidoMs | 551.0 | 597.6 | | |
| createList | foraDasEtapasMs | 6.2 | 12.1 | | |
| createList | foraDoHandlerMs | 55.4 | 56.7 | | |
| createList | tentativas | 1 | 1 | | |
| createList | linhasLidas | 4613 | 4622 | | |
| createList | linhasGravadas | 2 | 2 | | |
| createList | desfechos: | gravou | 10 | | |
| updateContainer | conexaoMs | 0.1 | 0.2 | | |
| updateContainer | inicioMs | 51.5 | 51.7 | | |
| updateContainer | travaMs | 51.8 | 52.6 | | |
| updateContainer | hidratarMs | 148.1 | 163.6 | | |
| updateContainer | canaisMs | 52.8 | 53.6 | | |
| updateContainer | operacaoMs | 0.2 | 1.0 | | |
| updateContainer | atualizaMs | 51.8 | 52.6 | | |
| updateContainer | gravarMs | 102.3 | 109.0 | | |
| updateContainer | eventosMs | 0.0 | 0.1 | | |
| updateContainer | commitMs | 51.8 | 51.9 | | |
| updateContainer | recorteMs | 11.8 | 22.7 | | |
| updateContainer | totalMs | 477.5 | 495.0 | | |
| updateContainer | pedidoMs | 531.9 | 550.0 | | |
| updateContainer | foraDasEtapasMs | 5.7 | 10.5 | | |
| updateContainer | foraDoHandlerMs | 54.8 | 55.1 | | |
| updateContainer | tentativas | 1 | 1 | | |
| updateContainer | linhasLidas | 4628.5 | 4633 | | |
| updateContainer | linhasGravadas | 2 | 2 | | |
| updateContainer | desfechos: | gravou | 10 | | |
| trashContainer | conexaoMs | 0.1 | 0.1 | | |
| trashContainer | inicioMs | 51.3 | 51.7 | | |
| trashContainer | travaMs | 51.7 | 52.0 | | |
| trashContainer | hidratarMs | 147.9 | 167.8 | | |
| trashContainer | canaisMs | 53.0 | 53.1 | | |
| trashContainer | operacaoMs | 0.3 | 1.1 | | |
| trashContainer | atualizaMs | 51.7 | 52.0 | | |
| trashContainer | gravarMs | 102.4 | 123.0 | | |
| trashContainer | eventosMs | 0.0 | 0.1 | | |
| trashContainer | commitMs | 51.8 | 52.2 | | |
| trashContainer | recorteMs | 9.8 | 16.2 | | |
| trashContainer | totalMs | 471.5 | 508.2 | | |
| trashContainer | pedidoMs | 526.1 | 563.3 | | |
| trashContainer | foraDasEtapasMs | 5.3 | 6.3 | | |
| trashContainer | foraDoHandlerMs | 54.8 | 55.9 | | |
| trashContainer | tentativas | 1 | 1 | | |
| trashContainer | linhasLidas | 4650 | 4659 | | |
| trashContainer | linhasGravadas | 4 | 4 | | |
| trashContainer | desfechos: | gravou | 10 | | |
| changeTaskStatus | conexaoMs | 0.1 | 0.1 | | |
| changeTaskStatus | inicioMs | 51.3 | 51.8 | | |
| changeTaskStatus | travaMs | 51.7 | 51.8 | | |
| changeTaskStatus | hidratarMs | 150.3 | 192.8 | | |
| changeTaskStatus | canaisMs | 53.0 | 53.2 | | |
| changeTaskStatus | operacaoMs | 0.8 | 2.5 | | |
| changeTaskStatus | atualizaMs | 51.7 | 51.8 | | |
| changeTaskStatus | gravarMs | 104.3 | 127.9 | | |
| changeTaskStatus | eventosMs | 0.0 | 0.1 | | |
| changeTaskStatus | commitMs | 51.8 | 52.1 | | |
| changeTaskStatus | recorteMs | 8.9 | 10.2 | | |
| changeTaskStatus | totalMs | 480.9 | 548.4 | | |
| changeTaskStatus | pedidoMs | 535.5 | 602.7 | | |
| changeTaskStatus | foraDasEtapasMs | 5.7 | 8.9 | | |
| changeTaskStatus | foraDoHandlerMs | 54.5 | 55.5 | | |
| changeTaskStatus | tentativas | 1 | 1 | | |
| changeTaskStatus | linhasLidas | 4666.5 | 4671 | | |
| changeTaskStatus | linhasGravadas | 2 | 2 | | |
| changeTaskStatus | desfechos: | gravou | 10 | | |

Observações de leitura (só aritmética sobre números impressos, sem afirmar causa):

- A ida e volta do `select 1` (51.7 ms na mediana) é praticamente igual ao custo de cada etapa de uma ida só: `inicioMs`, `travaMs`, `canaisMs`, `atualizaMs` e `commitMs` ficam entre 51.3 e 53.0 ms de mediana nos quatro gestos.
- `hidratarMs` fica entre 147.9 e 154.6 ms de mediana nos quatro gestos, perto dos 147.5 ms do `hidratar` direto; `gravarMs` fica entre 102.3 e 105.7 ms.
- `foraDoHandlerMs` fica entre 54.5 e 55.4 ms de mediana nos quatro gestos; `foraDasEtapasMs`, entre 5.3 e 6.2 ms.
- O `GET /estado` (370.6 ms) tem 223.1 ms a mais que o `hidratar` direto (147.5 ms); os números não dizem de onde vem a diferença.

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
