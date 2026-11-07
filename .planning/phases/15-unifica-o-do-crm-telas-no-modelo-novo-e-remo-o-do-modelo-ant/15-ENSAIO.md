# Fase 15 — Ensaio do `migrar:crm-antigo` sobre a cópia dos dados reais (plano 15-30, F14-D-02)

**Quando:** 2026-11-06 · **SHA do código:** `8866140` · **Script ensaiado:** `apps/api/src/migracao-crm/` (`--seco`, `--guardar`, `--migrar --funil=migrar|guardar`, `--verificar`), migração `012-atividade-do-crm.sql`

**Resultado: o script passou em tudo o que o ensaio cobre.** A `012` é a única pendente depois da `011`; o `--seco` não escreveu nada; o `--guardar` copiou para `registros_crm_antigo` as mesmas 2128 linhas que o `--seco` contou, em 19 Espaços; o `ws_n1` passou pelos dois caminhos do Funil; o `--verificar` respondeu `ok` em todos; a segunda execução simultânea esperou a primeira; matar o processo no meio deixou o Espaço como estava.

Este arquivo só tem números e nomes de configuração. A cópia (que carrega dado pessoal de clientes) ficou em `~/n1-ensaio`, fora do repositório, e o contêiner do ensaio foi apagado.

## Limites da cópia (leia antes dos números)

A checkpoint do plano (o dono renova a cópia) **não foi atendida**: em 2026-11-06 o dono mandou "pode fazer o que precisar para fechar a fase" e o orquestrador aplicou o segundo sinal do plano, **"usar a cópia de 2026-11-05"**. Consequências:

1. **A cópia é de antes de tudo o que o dono fez em produção depois de 2026-11-05.** O `.dump` é de 2026-11-05 11:13 (`backup-plataforma-pre-011-…`, o backup manual feito antes de aplicar a 011) e o CSV é de 10:11 do mesmo dia. O ensaio vale para aquele momento, não para o banco de hoje.
2. **Fonte da importação: o `.dump`, restaurado inteiro.** Ele é um `pg_dump -Fc` do schema `plataforma` (22 tabelas, 51 coleções em `registros`, 23952 linhas, 19 Espaços), e não só das nove coleções do CRM antigo. Por isso a checagem da Pasta "Meus negócios" **rodou com dado real** (Listas, Tarefas e Visualizações de verdade, e não só as nove coleções). O CSV (`registros-crm-antigo.csv`, 2128 linhas) serviu só de conferência: carregado à parte e comparado por digest (`md5` de id, dados e ordem) por Espaço e coleção, é **idêntico** ao que o `.dump` tem nas nove coleções (146 grupos de Espaço e coleção, 2128 linhas).
3. **As tabelas do CRM novo do `ws_n1` não foram recopiadas.** Elas entram pelo `.dump`, no estado de 2026-11-05 11:13 (2 Contatos, 1 Empresa, 1 vínculo Contato-Empresa, 2 Funis, 6 Etapas, 1 Negócio, nenhum Canal, Conversa nem Mensagem). Se o dono mexeu no CRM novo desde então, o Funil "Padrão" do CRM antigo pode encontrar outro cenário no corte (nome em uso, por exemplo).
4. **O dono pode renovar a cópia e o ensaio pode ser repetido antes do corte.** O roteiro está abaixo; o 15-34 deve em qualquer caso rodar o `--seco` do dia de cada Espaço antes de escrever.

## Como foi feito

1. **Contêiner.** `postgres:16` em Docker (`crm-n1-pg-1530`, porta 55730, ligada só ao `127.0.0.1`). Produção é Postgres 17.6; o ensaio roda em 16 como o restante dos testes do projeto. Todo comando levou `DATABASE_URL` e `DATABASE_URL_MIGRACAO` locais escritas na linha; o `.env` não foi lido; nenhuma conexão com produção.
2. **Importação.** `pg_restore --no-owner --no-privileges` do `.dump` para o banco local. Um único erro, ignorável: `unrecognized configuration parameter "transaction_timeout"` (o dump é do `pg_dump` 18 e o contêiner é 16); todas as tabelas e linhas vieram. O estado restaurado é o de produção antes da 011: `plataforma.migracoes` com as 10 primeiras.
3. **Migrações.** `npm run migrar -- --seco` (2 pendentes: `011` e `012`); a `011` foi aplicada pelo texto, numa transação, e registrada em `plataforma.migracoes`, que é o estado que produção tem desde 2026-11-05; de novo `--seco` (só a `012`); `npm run migrar` (aplicou só a `012`, 15 ms); `npm run banco:conceder`.
4. **Contagens antes**, `hidratar` de cada Espaço (só contagens) e `pg_dump -Fc` do banco local: o ponto de restauração do ensaio.
5. **`--seco` nos 19 Espaços** (saída 0 em todos). As contagens e as revisões dos Espaços ficaram iguais antes e depois dele (a sessão é `begin read only`).
6. **`--guardar` nos 18 Espaços de teste; `--migrar --funil=guardar` no `ws_n1`.**
7. **`--verificar` nos 19** (saída 0 em todos), comparando a contagem de `registros_crm_antigo` com a do `--seco` de antes.
8. **Segundo banco:** o ponto de restauração foi restaurado em `ensaio2` (contagens iguais às de antes de qualquer escrita) e o `ws_n1` rodou `--migrar --funil=migrar`, `--verificar` e a repetição.
9. **Concorrência e interrupção** em `ensaio2`.
10. **Extras** (fora do que o plano pedia): o mesmo com o papel `n1_api` e `--migrar --funil=migrar` em dois Espaços de teste.
11. **Limpeza.** O contêiner foi apagado por `trap` (também em falha) depois de cada rodada; o script, o ponto de restauração e as saídas ficaram só no diretório de sessão e foram apagados; nenhum arquivo da cópia entrou no repositório.

## Saída do `--seco` das migrações

Logo depois de importar a cópia (antes da 011), e depois de aplicar a 011:

```
aplicada  001-plataforma.sql ... aplicada  010-carga-e-bloqueio-da-lista.sql
pendente  011-crm-o-que-faltava.sql
pendente  012-atividade-do-crm.sql
2 pendente(s); nada foi aplicado (--seco).

aplicada  001-plataforma.sql ... aplicada  011-crm-o-que-faltava.sql
pendente  012-atividade-do-crm.sql
1 pendente(s); nada foi aplicado (--seco).
```

`migrar` aplicou só `012-atividade-do-crm.sql`. `banco:conceder` disse que o papel `n1_api` não existe neste banco (ramo sem papel), exceto no extra com o papel, abaixo.

## Contagem por coleção: antes (`--seco`) e depois (`registros_crm_antigo`, no `--verificar`)

| Coleção | Antes (`--seco`) | Depois (`registros_crm_antigo`) |
|---|---:|---:|
| `contacts` | 624 | 624 |
| `companies` | 192 | 192 |
| `contactCompanyLinks` | 480 | 480 |
| `companyCompanyLinks` | 16 | 16 |
| `distinctFromLinks` | 16 | 16 |
| `funnels` | 66 | 66 |
| `deals` | 304 | 304 |
| `channels` | 80 | 80 |
| `conversations` | 350 | 350 |
| **Total** | **2128** | **2128** |

As 2128 linhas são as da linha-base do `14-ENSAIO.md` (mesmas nove coleções, mesmos totais por coleção). A diferença é só de Espaços: a cópia tem **19 Espaços e não 18**, porque ganhou `ws_agendaworker_1790352062935_2haflp`, que não tem nenhuma linha em `registros` (nem das nove coleções nem de outras). O total de `plataforma.registros` (todas as coleções) é 23952; as nove coleções são 2128 dele. Depois do `--guardar`/`--migrar` o total de `registros` é 21838: saíram 2114, que são as 2128 menos as 14 Conversas de Grupo que ficam (7 Espaços com 2).

A comparação foi feita por Espaço e por coleção, e **os 19 Espaços deram igual** (a coluna "nove antes" abaixo é o total do `--seco`; a de `registros_crm_antigo` é o do `--verificar`).

| Espaço | Revisão | `registros` | Nove coleções antes | `registros_crm_antigo` depois | Conversas de Grupo mantidas |
|---|---|---|---:|---:|---:|
| `ws_agendaworker_1790352062935_2haflp` | 5 → 5 | 0 → 0 | 0 | 0 | 0 |
| `ws_debug_automations` | 2 → 3 | 908 → 776 | 132 | 132 | 0 |
| `ws_n1` | 779 → 780 | 5278 → 5277 | 1 | 1 | 0 |
| `ws_outbox_1790002249349_te7t5z` | 5 → 6 | 920 → 788 | 132 | 132 | 0 |
| `ws_outbox_1790002291927_omse5x` | 4 → 5 | 918 → 786 | 132 | 132 | 0 |
| `ws_outbox_1790003023016_1piqto` | 5 → 6 | 920 → 788 | 132 | 132 | 0 |
| `ws_outbox_1790003053712_n8hwvy` | 4 → 5 | 918 → 786 | 132 | 132 | 0 |
| `ws_outbox_1790003082199_8p285y` | 3 → 4 | 916 → 784 | 132 | 132 | 0 |
| `ws_outbox_1790003204554_88m39n` | 5 → 6 | 920 → 788 | 132 | 132 | 0 |
| `ws_outbox_1790003250872_a25rdn` | 4 → 5 | 918 → 786 | 132 | 132 | 0 |
| `ws_outbox_1790003328681_yo1893` | 5 → 6 | 920 → 788 | 132 | 132 | 0 |
| `ws_outbox_1790206152726_hx6qku` | 3 → 4 | 944 → 812 | 134 | 134 | 2 |
| `ws_spike_10x` | 2 → 3 | 4067 → 3935 | 134 | 134 | 2 |
| `ws_spike` | 3 → 4 | 1008 → 876 | 134 | 134 | 2 |
| `ws_teste_classificacoes_1790201209011_rkgmin` | 2 → 3 | 1036 → 904 | 134 | 134 | 2 |
| `ws_teste_classificacoes_1790353187334_ws3at4` | 2 → 3 | 1037 → 905 | 134 | 134 | 2 |
| `ws_teste_classificacoes_1792754637371_e6mf4d` | 5 → 6 | 1123 → 991 | 134 | 134 | 2 |
| `ws_teste_importar_sol_1790373466622_3ery4e_ref` | 3 → 4 | 168 → 167 | 1 | 1 | 0 |
| `ws_teste_integracao_solicitacoes_1790129575792_jyorfo` | 11 → 12 | 1033 → 901 | 134 | 134 | 2 |

A revisão de cada Espaço subiu 1 (uma `executar()`), exceto `ws_agendaworker_…`, que não tinha nada a guardar e continuou em 5 ("nada a fazer"). `crm_de_para` ficou com 0 linhas em todos os Espaços deste caminho (`--guardar` e `ws_n1` com `--funil=guardar` não criam linha no CRM novo). As tabelas do CRM novo do `ws_n1` ficaram iguais (abaixo).

## `ws_n1`: o relatório e os dois caminhos do Funil

**O que o CRM antigo tem no `ws_n1` na cópia:** 1 Funil e mais nada (0 Contatos, Empresas, vínculos, Negócios, Canais e Conversas). O Funil é `fnl_padrao` "Padrão", ativo, com 1 Etapa ("Novo", 0%); só o registro do Espaço (workspace) aponta para ele. **A Pasta "Meus negócios" não existe no `ws_n1`**. "Não migrados": nenhum item, nos dois caminhos. O Espaço já tem no CRM novo 2 Funis (um é o padrão) e 6 Etapas.

| | `--funil=guardar` (banco `postgres`) | `--funil=migrar` (banco `ensaio2`, restaurado do mesmo ponto) |
|---|---|---|
| Comando | `--migrar --funil=guardar` | `--migrar --funil=migrar` |
| Saída | 0 · "migrado. 1 linha copiada para `registros_crm_antigo`; apagada de `registros`: `funnels` 1" | 0 · o mesmo, mais "Funil: 1 migrado (1 Etapa)" |
| Revisão do Espaço | 779 → 780 | 779 → 780 |
| `registros` | 5278 → 5277 | 5278 → 5277 |
| `registros_crm_antigo` | 0 → 1 (`funnels`) | 0 → 1 (`funnels`) |
| Funis no CRM novo | 2 → 2 | 2 → **3** |
| Etapas no CRM novo | 6 → 6 | 6 → **7** |
| `crm_de_para` | 0 | 2 (o Funil e a Etapa) |
| Contatos, Empresas, vínculo, Negócios, Canais, Conversas, Mensagens no CRM novo | 2, 1, 1, 1, 0, 0, 0 (iguais) | 2, 1, 1, 1, 0, 0, 0 (iguais) |
| `--verificar` | ok (`funnels 1`) | ok (`funnels 1`) |
| Repetir o `--migrar` | "nada a fazer"; a revisão não subiu | "nada a fazer" |

O Funil entrou "não como padrão", porque o Espaço já tem Funil padrão. O Funil "Padrão" do CRM antigo é o do bootstrap do Espaço, sem nenhum Negócio, então o `--funil=migrar` só acrescentaria um Funil vazio, com a Etapa "Novo", ao lado dos 2 que o `ws_n1` já tem. Quem decide é o dono, no corte; o ensaio mostra que os dois caminhos funcionam, que o `--funil=guardar` não tira nada do CRM novo e que o `--funil=migrar` não encontrou nome em uso. Lembrete do `CONTEXT.md` do script: a decisão vale antes da primeira escrita; depois de um `--guardar` o Funil só volta recriado pela tela de Funis.

## A Pasta "Meus negócios" (D-15-14), com dado real

| Situação | Espaços | O que o script fez |
|---|---:|---|
| Espaço sem a Pasta (`ws_n1`, `ws_teste_importar_sol_…_ref`, `ws_agendaworker_…`) | 3 | "este Espaço não tem"; nada a fazer |
| Pasta com Tarefa em 4 Listas (`SDR` 6 Tarefas, `Closer` 10, `Validação Full Face Avançado` 1, `Venda direta` 1: 18 Tarefas) | 16 | **nada da Pasta saiu**: nem a Pasta, nem as Listas, nem as Visualizações; o resultado listou as Listas e as contagens |

Resultado: a Pasta fica, com as 18 Tarefas "espelho" dos Negócios, em 16 Espaços de teste, e nenhuma Tarefa foi tocada. Em nenhum Espaço a Pasta estava vazia, então o ramo "remover a Pasta" não foi exercitado por esta cópia (está provado em Docker com dado sintético, 15-27). O `ws_n1`, o único Espaço real, não tem a Pasta.

## O que fica de fora do `--migrar` ("Não migrados", só contagens)

- `ws_n1`: nenhum item.
- 7 Espaços de teste com 134 linhas (`ws_outbox_1790206152726_hx6qku`, `ws_spike`, `ws_spike_10x`, três `ws_teste_classificacoes_…` e `ws_teste_integracao_solicitacoes_…`): **160 itens em 16 categorias**. 9 Espaços de teste com 132 linhas (`ws_debug_automations` e oito `ws_outbox_…`): **141 itens em 15 categorias** (10 Tags em vez de 25 e sem a categoria "Mensagem de Flow"). A semente dos 160 é a mesma da fixture do 15-28.
- Categorias do grupo de 160: Temperatura do Contato 35 · Tags 25 · Foto do Contato 1 · Cópia de antes da mesclagem 1 · Identificadores de LinkedIn, TikTok e chat do site 32 · Campo personalizado com lista de valores 1 · Vínculo Empresa-Empresa 1 · Vínculo "distinto de" 1 · Marca de Empresa principal do Contato 27 · Requisitos e transições da Etapa 4 · Código legível, campos, histórico e demais Contatos do Negócio 19 · Canal de LinkedIn ou chat do site 2 · Modelos de Mensagem do Canal 1 · Conversa de um Canal que não migrou 5 · Rascunhos, Tags e campos da Conversa 1 · Mensagem de Flow 4.
- Esses números são **do dado de teste**. Os 18 Espaços de teste só têm a semente de demonstração (39 Contatos, 12 Empresas, 30 vínculos Contato-Empresa, 4 Funis, 19 Negócios, 5 Canais, 21 a 23 Conversas), não dado de cliente.

## Extra: o `--migrar --funil=migrar` em dois Espaços de teste (mapeador sobre dado que não é a fixture)

Fora do que o plano pedia, e só no contêiner: `ws_spike_10x` (160 itens) e `ws_outbox_1790002249349_te7t5z` (141 itens), num banco novo restaurado do ponto. Em ambos, saída 0, `--verificar` ok, repetir "nada a fazer", e **as linhas que o `--seco` disse que levaria foram as que entraram** (sem erro de `commit`):

| Espaço | contatos | identificadores | empresas | id. de empresa | contato_empresa | Funis | Etapas | negócios | canais | conversas | mensagens | consentimentos | `crm_de_para` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `ws_spike_10x` | 39 | 75 | 12 | 24 | 30 | 4 | 23 | 19 | 3 | 16 | 62 | 45 | 307 |
| `ws_outbox_1790002249349_te7t5z` | 39 | 75 | 12 | 24 | 30 | 4 | 23 | 19 | 3 | 16 | 55 | 45 | 300 |

## Extra: com o papel `n1_api` (o `DATABASE_URL` de runtime)

Num terceiro banco restaurado do ponto, com o papel `n1_api` criado e `banco:conceder` rodado (saída: "n1_api: concessões aplicadas"), o script rodou com `DATABASE_URL` do `n1_api` e `DATABASE_URL_MIGRACAO` do dono: `ws_n1 --migrar --funil=migrar` (0), `ws_spike --guardar` (0) e `--verificar` dos dois (0). Resultado igual ao dos outros bancos (`ws_n1`: Funis 3, Etapas 7, `crm_de_para` 2; `ws_spike`: 876 linhas em `registros`, 134 em `registros_crm_antigo`). Isso mostra que o conjunto de permissões que `banco:conceder` dá ao `n1_api` basta para as tabelas da 011 e da 012; no corte o dono roda `migrar` e `banco:conceder` antes do script.

## `hidratar` por Espaço, depois (só contagens do estado hidratado)

Antes, as contagens eram as da tabela do `14-ENSAIO.md` (39/12/30/1/1/4/19/5/21 a 23 nos Espaços com semente, e o `ws_n1` com 1 Funil), mais o Espaço novo com tudo zero. Depois:

| Espaço | contacts | companies | contactCompanyLinks | companyCompanyLinks | distinctFromLinks | funnels | deals | channels | conversations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `ws_agendaworker_1790352062935_2haflp` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_debug_automations` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_n1` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_outbox_1790002249349_te7t5z` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_outbox_1790002291927_omse5x` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_outbox_1790003023016_1piqto` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_outbox_1790003053712_n8hwvy` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_outbox_1790003082199_8p285y` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_outbox_1790003204554_88m39n` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_outbox_1790003250872_a25rdn` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_outbox_1790003328681_yo1893` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_outbox_1790206152726_hx6qku` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| `ws_spike` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| `ws_spike_10x` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| `ws_teste_classificacoes_1790201209011_rkgmin` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| `ws_teste_classificacoes_1790353187334_ws3at4` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| `ws_teste_classificacoes_1792754637371_e6mf4d` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| `ws_teste_importar_sol_1790373466622_3ery4e_ref` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `ws_teste_integracao_solicitacoes_1790129575792_jyorfo` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |

`hidratar: 19 Espaço(s), 0 falha(s)`, antes e depois. Nenhum Espaço ficou com alguma das oito coleções; o que sobra em `conversations` são só as 2 Conversas de Grupo (F14-D-05) dos 7 Espaços que tinham.

## Concorrência e interrupção (UCR-10), em `ensaio2`

**A segunda execução espera a trava do Espaço.**

- *Espera medida.* Uma sessão separada travou a linha do Espaço `ws_spike` (`select … for update` e `pg_sleep(7)`) e, 1 s depois, o `--guardar` foi lançado no mesmo Espaço. A trava foi solta em T e o `--guardar` terminou 0,05 s depois de T, com saída 0 e "guardado. 134 linhas copiadas": ele ficou parado na trava e só andou quando ela saiu. Revisão 3 → 4; `registros_crm_antigo` 134; `--verificar` ok.
- *Duas execuções simultâneas no mesmo Espaço* (`ws_teste_classificacoes_1790201209011_rkgmin`): as duas saíram com 0; **uma disse "guardado. 134 linhas copiadas" e a outra "nada a fazer"**. Revisão 2 → 3 (subiu uma vez só); `registros` 1036 → 904; `registros_crm_antigo` 134; `--verificar` ok.

**Matar o processo no meio deixa o Espaço como antes** (`ws_outbox_1790002249349_te7t5z`).

- Uma sessão travou uma linha de `deals` do Espaço em `registros`. O `--guardar` abriu a transação, copiou e parou no `delete from plataforma.registros` esperando essa linha; foi confirmado no `pg_stat_activity` (espera do tipo `Lock`, instrução `delete from plataforma.r…`). Nesse ponto o processo levou `kill -9` (nenhum processo restou).
- Depois que a sessão soltou a linha: revisão 5 → 5, `registros` 920 → 920, `registros_crm_antigo` 0 → 0, nenhuma transação aberta esquecida. Um `--guardar` normal em seguida terminou com 0 ("guardado. 132 linhas copiadas") e o `--verificar` deu ok.

## O que o ensaio não cobre

- **O que mudou em produção depois de 2026-11-05 11:13.** A cópia está parada nessa hora. O corte precisa do `--seco` do dia.
- **Mapeador sobre dado de cliente.** O único Espaço real (`ws_n1`) não tem Contato, Empresa, Negócio, Canal nem Conversa no CRM antigo, e os 18 Espaços de teste só têm a semente de demonstração. O mapeador foi exercitado em dois deles (extra acima) e na fixture do 15-28, não em dado real de pessoa.
- **O `--funil=migrar` no `ws_n1` real do dono de hoje.** Se o CRM novo do `ws_n1` mudou desde 2026-11-05, o resultado pode mudar (nome em uso).
- **Postgres 17.6 e a VM.** O ensaio rodou em Postgres 16, sem latência de rede, sem o pooler e sem o resto do `apps/api` em pé. Os tempos não valem para produção. A `011` foi aplicada pelo texto e registrada à mão (como produção tem), e a `012` pelo `migrar`.
- **A queda da VM ou do Postgres.** A prova de interrupção foi `kill -9` do processo do script com a transação aberta, não queda do banco; o commit parcial não existe no Postgres de qualquer forma, mas não foi provado com falha de disco ou de rede.
- **Papéis e grants de produção.** Só o conjunto que `banco:conceder` dá ao `n1_api` foi provado (extra); a senha, o pooler e o proprietário reais não existem aqui.
- **O volume do corte.** O maior Espaço tem 4067 linhas em `registros`. Cada execução terminou em poucos segundos (não foram cronometradas); o corte tem a mesma ordem de grandeza se a produção não tiver crescido muito.

## Como repetir com a cópia renovada

O dono, em sessão `psql` de produção com `set default_transaction_read_only = on;`, gera de novo o `pg_dump -Fc --schema=plataforma` (ou os `\copy` do plano) em `~/n1-ensaio/`, fora do repositório. Quem ensaiar restaura num `postgres:16` de Docker (`pg_restore --no-owner --no-privileges`), aplica as migrações que faltarem (`migrar -- --seco`, `migrar`, `banco:conceder`) e roda, em cada Espaço, `--seco`, `--guardar` ou `--migrar --funil=migrar|guardar` e `--verificar`, sempre com as duas URLs do Docker escritas no comando.

---

# Ensaio final (código final) — plano 15-34

**Quando:** 2026-11-06 · **SHA do código:** `f268958` (o `HEAD` depois do 15-43, 45 commits depois do `8866140` do ensaio acima) · **Cópia:** a mesma de 2026-11-05 (`~/n1-ensaio`, o `.dump` restaurado inteiro; ninguém renovou a cópia).

**Resultado: o código final passou sobre a cópia com os mesmos números do ensaio do 15-30, Espaço a Espaço, sem nenhuma diferença.** As 60 chamadas do script registradas saíram com 0. Nada aqui é novo no número; o que é novo é o código sob teste (sem a ponte dos Canais em `executar()`, sem as oito coleções no `DataState`, com o `--migrar` completo do 15-28). Este trecho só tem números e nomes de configuração; as saídas brutas (conferidas com `grep`: nenhum endereço de e-mail e nenhum telefone) e o ponto de restauração (`.dump` com dado pessoal) foram apagados; o contêiner foi apagado por `trap`.

## Como foi feito (igual ao do 15-30, com as diferenças marcadas)

1. Contêiner `postgres:16` (`crm-n1-pg-1534`, porta 55734, só em `127.0.0.1`). Toda chamada levou `DATABASE_URL` e `DATABASE_URL_MIGRACAO` locais escritas na linha; o `.env` não foi lido. As 80 linhas `Banco:` que o script imprimiu (host e porta, sem usuário) diziam `localhost:55734`.
2. `pg_restore --no-owner --no-privileges` do `.dump` (um único erro ignorável, `transaction_timeout`, como antes): 23952 registros, 19 Espaços, 51 coleções, 10 migrações registradas.
3. Migrações: `--seco` (011 e 012 pendentes); 011 pelo texto (`psql -1`) e registrada em `plataforma.migracoes`, que é o estado de produção; `--seco` (só a 012); `npm run migrar` (aplicou só a 012); `banco:conceder` (ramo "o papel não existe").
4. Contagens, revisões e ponto de restauração (`pg_dump -Fc`).
5. `--seco` nos 19 Espaços (todos 0; contagens e revisões iguais depois: sim).
6. `--guardar` nos 18 Espaços de teste e `--migrar --funil=guardar` no `ws_n1`; `--verificar` nos 19.
7. Repetir `ws_n1` e `ws_spike`: "nada a fazer", revisão não sobe. `hidratar` dos 19 Espaços.
8. Segundo banco restaurado do ponto: `ws_n1` com `--migrar --funil=migrar`, `--verificar` e repetição; duas execuções simultâneas; `kill -9` no meio.
9. Terceiro banco: `--migrar --funil=migrar` em dois Espaços de teste. Quarto banco: o papel `n1_api`.

**O que difere do método do 15-30:** (a) o código; (b) no `kill -9`, a primeira rodada deste ensaio mostrou um artefato do roteiro e não do script: a sessão que segurava a linha ficou presa no `pg_sleep` (o servidor só percebe o `psql` morto depois dele), então o `--guardar` seguinte esbarrou no `lock timeout`; o roteiro passou a encerrar essa sessão do próprio ensaio antes de medir, e a rodada que vale é a segunda; (c) a comparação por Espaço contra os números do 15-30 foi automática (diferença zero).

## Contagem por coleção, antes e depois (igual ao 15-30)

| Coleção | Antes (`--seco`) | Depois (`registros_crm_antigo`) |
|---|---:|---:|
| `contacts` | 624 | 624 |
| `companies` | 192 | 192 |
| `contactCompanyLinks` | 480 | 480 |
| `companyCompanyLinks` | 16 | 16 |
| `distinctFromLinks` | 16 | 16 |
| `funnels` | 66 | 66 |
| `deals` | 304 | 304 |
| `channels` | 80 | 80 |
| `conversations` | 350 | 350 |
| **Total** | **2128** | **2128** |

- **Por Espaço e coleção, as 146 contagens de antes e as de depois são idênticas** (19 Espaços), e a revisão de antes e de depois e as linhas guardadas de cada um dos 19 Espaços são idênticas às da tabela do 15-30 (comparação automática, diferença zero). A revisão subiu 1 em 18 Espaços e ficou em 5 no `ws_agendaworker_…` ("nada a fazer").
- `registros`: **23952 → 21838** (saíram 2114 = 2128 menos as 14 Conversas de Grupo que ficam, em 7 Espaços com 2).
- O roteiro de comparação do `15-CORTE.md` (passo 7, `seco/<Espaço>.txt` contra `verificar/<Espaço>.txt`) foi testado sobre estas saídas: 19 Espaços "igual".

## `ws_n1`: os dois caminhos do Funil (igual ao 15-30)

| | `--funil=guardar` (banco `postgres`) | `--funil=migrar` (banco restaurado do mesmo ponto) |
|---|---|---|
| Saída | 0 · "migrado. 1 linha(s) copiadas…; apagadas de registros: funnels 1. Não migrados: nenhum item." | 0 · o mesmo, mais "Funil: 1 migrado (1 Etapa)" |
| Revisão do Espaço | 779 → 780 | 779 → 780 |
| Funis no CRM novo | 2 → 2 | 2 → **3** |
| Etapas no CRM novo | 6 → 6 | 6 → **7** |
| `crm_de_para` | 0 | 2 |
| Contatos, Empresas, vínculo, Negócios, Canais, Conversas, Mensagens no CRM novo | 2, 1, 1, 1, 0, 0, 0 (iguais) | 2, 1, 1, 1, 0, 0, 0 (iguais) |
| `--verificar` | ok | ok |
| Repetir o `--migrar` | "nada a fazer"; a revisão não subiu | "nada a fazer"; a revisão não subiu |

O CRM antigo do `ws_n1` na cópia continua sendo só o Funil "Padrão" (1 Etapa, nenhum Negócio), sem a Pasta "Meus negócios". O Funil entra não padrão, porque o Espaço já tem Funil padrão.

## A Pasta "Meus negócios" (D-15-14), com dado real (igual ao 15-30)

3 Espaços não a têm (`ws_n1`, `ws_teste_importar_sol_…_ref`, `ws_agendaworker_…`); **16 Espaços de teste têm a Pasta com 18 Tarefas em 4 Listas** (`SDR` 6, `Closer` 10, `Validação Full Face Avançado` 1, `Venda direta` 1) e **nada da Pasta saiu**: depois de tudo, os mesmos 16 Espaços ainda têm `fld_meus_negocios` em `registros`. O ramo "remover a Pasta vazia" segue provado só em Docker com dado sintético (15-27).

## Não migrados (iguais ao 15-30)

`ws_n1`: nenhum item. 7 Espaços de teste (os de 134 linhas): **160 itens em 16 categorias**. 9 Espaços de teste (os de 132 linhas): **141 itens em 15 categorias**.

## `--migrar --funil=migrar` em dois Espaços de teste (igual ao 15-30)

Saída 0, `--verificar` ok, repetir "nada a fazer", e as linhas que o `--seco` anunciou foram as que entraram.

| Espaço | contatos | identificadores | empresas | id. de empresa | contato_empresa | Funis | Etapas | negócios | canais | conversas | mensagens | consentimentos | `crm_de_para` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `ws_spike_10x` | 39 | 75 | 12 | 24 | 30 | 4 | 23 | 19 | 3 | 16 | 62 | 45 | 307 |
| `ws_outbox_1790002249349_te7t5z` | 39 | 75 | 12 | 24 | 30 | 4 | 23 | 19 | 3 | 16 | 55 | 45 | 300 |

## Com o papel `n1_api` (igual ao 15-30)

`banco:conceder` ("n1_api: concessões aplicadas"); com `DATABASE_URL` do `n1_api` e `DATABASE_URL_MIGRACAO` do dono: `ws_n1 --migrar --funil=migrar` (0), `ws_spike --guardar` (0), `--verificar` dos dois (0). `ws_n1`: Funis 3, Etapas 7, `crm_de_para` 2; `ws_spike`: 876 em `registros`, 134 em `registros_crm_antigo`.

## `hidratar` por Espaço, com o código final

`hidratar: 19 Espaço(s), 0 falha(s)`, **nenhum Espaço com alguma das oito coleções antigas**, e 14 Conversas de Grupo (as 2 de cada um dos 7 Espaços). É o mesmo resultado do 15-30, agora com o `DataState` sem as oito coleções. O que o `DataState` novo não faz sozinho é recusar uma linha antiga que sobre em `registros`: `hidratar()` a carrega como chave desconhecida (`hidratar-crm-antigo.test.ts` prova as duas metades). Por isso o `15-CORTE.md` manda rodar o script antes de publicar.

## Concorrência e interrupção (UCR-10), em banco restaurado do ponto

- **Duas execuções simultâneas** no mesmo Espaço (`ws_teste_classificacoes_1790201209011_rkgmin`): as duas saíram com 0; uma disse "guardado. 134 linha(s) copiadas" e a outra "nada a fazer". Revisão 2 → 3 (uma vez só); `registros` 1036 → 904; `registros_crm_antigo` 134; `--verificar` ok.
- **`kill -9` no meio** (`ws_outbox_1790002249349_te7t5z`): o `--guardar` parou no `delete from plataforma.registros` esperando uma linha travada por outra sessão (visto em `pg_stat_activity`, uma sessão em `Lock`) e levou `kill -9`. Depois de soltar a linha e de não restar sessão ligada ao banco: revisão 5 → 5, `registros` 920 → 920, `registros_crm_antigo` 0 → 0. Um `--guardar` normal em seguida terminou com 0 ("guardado. 132 linha(s) copiadas") e o `--verificar` deu ok.

## O que este ensaio final não cobre (além dos limites do ensaio do 15-30, que seguem valendo)

- **A API e a web finais não foram levantadas sobre a cópia migrada.** Só o script, as migrações e `hidratar` rodaram; `GET /estado` e as telas sobre esse banco não. As telas nunca foram abertas em navegador real nesta fase (ver "Provas manuais pendentes" em `15-PROVAS.md`).
- **A cópia continua sendo a de 2026-11-05 11:13.** O corte precisa do `--seco` do dia em cada Espaço (`15-CORTE.md`, passo 4), e o dono pode renovar a cópia e repetir este ensaio antes.

---

# Ensaio pós-revisão — plano 15-44

**Quando:** 2026-11-06 · **SHA do código:** `9e8d05e` (o `HEAD` depois das correções H-01, H-02, M-01 e M-04 da revisão `15-REVIEW.md`) · **Cópia:** a mesma de 2026-11-05 (`~/n1-ensaio`, o `.dump` restaurado inteiro; ninguém renovou a cópia).

**Resultado: o código corrigido deu os mesmos números do 15-30 e do 15-34, Espaço a Espaço, sem nenhuma diferença.** Nenhuma chamada do script saiu com código diferente de 0. Este trecho só tem números e nomes de configuração. As saídas brutas (conferidas com `grep`: 0 endereços de e-mail e 0 telefones) e o ponto de restauração (`.dump` com dado pessoal) foram apagados; o contêiner foi apagado por `trap`.

## Como foi feito (o método do 15-34, com o script do ensaio refeito)

Os scripts descartáveis do 15-30 e do 15-34 tinham sido apagados; este foi reescrito do zero, **fora do repositório** (diretório de sessão), com `trap` que remove o contêiner mesmo em falha. Mesma sequência: contêiner `postgres:16` (`crm-n1-pg-1544`, porta 55744, só em `127.0.0.1`); `pg_restore --no-owner --no-privileges` do `.dump` (um único erro ignorável, `transaction_timeout`; 23952 registros, 19 Espaços, 51 coleções, 10 migrações); `--seco` das migrações (011 e 012 pendentes); 011 pelo texto e registrada em `plataforma.migracoes` (o estado de produção); `--seco` (só a 012); `migrar` (aplicou só a 012); `banco:conceder` (ramo "o papel não existe"); ponto de restauração; `--seco` nos 19 Espaços; `--guardar` nos 18 Espaços de teste e `--migrar --funil=guardar` no `ws_n1`; `--verificar` nos 19; repetir `ws_n1` e `ws_spike`; `hidratar` dos 19; segundo banco restaurado do ponto (`ws_n1 --funil=migrar`, concorrência, `kill -9`); terceiro banco (`--migrar --funil=migrar` em dois Espaços de teste); quarto banco (papel `n1_api`). Toda chamada levou `DATABASE_URL` e `DATABASE_URL_MIGRACAO` locais escritas na linha; o `.env` não foi lido. As 19 linhas `Banco:` do `--seco` dizem `localhost:55744`, agora vindas do host que o `pg` usa (M-01, L-02).

A comparação com o 15-30/15-34 foi automática: uma tabela esperada (revisão antes e depois, linhas de `registros` antes e depois, as nove coleções do `--seco` e as Conversas que ficam) contra a medida, nos 19 Espaços: **igual**.

## Os números (iguais aos do 15-30 e do 15-34)

| Coleção | Antes (`--seco`) | Depois (`registros_crm_antigo`) |
|---|---:|---:|
| `contacts` | 624 | 624 |
| `companies` | 192 | 192 |
| `contactCompanyLinks` | 480 | 480 |
| `companyCompanyLinks` | 16 | 16 |
| `distinctFromLinks` | 16 | 16 |
| `funnels` | 66 | 66 |
| `deals` | 304 | 304 |
| `channels` | 80 | 80 |
| `conversations` | 350 | 350 |
| **Total** | **2128** | **2128** |

- **2128 = 2128 em cada um dos 19 Espaços** (a comparação do passo 7 do `15-CORTE.md`, com o filtro das nove coleções dos dois lados: 19 "igual"). Todas as saídas do `--seco`, do `--guardar`/`--migrar` e do `--verificar` saíram com 0.
- `registros`: **23952 → 21838**. As **14 Conversas de Grupo ficam** (2 em cada um dos 7 Espaços). A revisão de cada Espaço subiu 1, exceto `ws_agendaworker_…` (5 → 5, "nada a fazer"), como no 15-30.
- **Nenhuma Conversa 1:1 de Flow ou Automação** na cópia: as linhas "1:1 de Flow, Automação ou convite de Grupo continuam em registros" saíram com 0 nos 19 Espaços. O novo critério (H-02) não mudou nada nesta cópia; ele muda o que o script faz com dado vivo depois do corte, e isso está provado só com dado sintético em Docker (`colecoes.test.ts`, `migrar-crm-antigo.test.ts`).
- **A Pasta "Meus negócios" fica em 16 Espaços de teste, com 18 Tarefas em 4 Listas** (`SDR` 6, `Closer` 10, `Validação Full Face Avançado` 1, `Venda direta` 1); 3 Espaços não a têm. `fld_meus_negocios` continua em `registros` nos mesmos 16.
- **`ws_n1`, os dois caminhos do Funil (igual ao 15-34):** `--funil=guardar` (banco `postgres`): saída 0, "migrado", `funnels` 1 apagada de `registros`, Funis 2 → 2, Etapas 6 → 6, `crm_de_para` 0, revisão 779 → 780; `--funil=migrar` (segundo banco, mesmo ponto): saída 0, "Funil: 1 migrado (1 Etapa)", Funis 2 → **3**, Etapas 6 → **7**, `crm_de_para` 2, revisão 779 → 780. Contatos 2, Empresas 1, vínculo 1, Negócios 1, Canais 0, Conversas 0 nos dois. `--verificar` ok e repetir "nada a fazer" (revisão 780 → 780 no primeiro banco).
- **Não migrados (iguais):** `ws_n1`, `ws_teste_importar_sol_…_ref` e `ws_agendaworker_…`: nenhum item; 7 Espaços de 134 linhas: **160 itens em 16 categorias** (Temperatura 35, Tags 25, Foto 1, Cópia pré-mesclagem 1, Identificadores de LinkedIn/TikTok/chat do site 32, Campo com lista 1, Vínculo Empresa-Empresa 1, "distinto de" 1, Marca de Empresa principal 27, Requisitos e transições da Etapa 4, detalhes do Negócio 19, Canal sem destino 2, Modelos de Mensagem 1, Conversa de Canal que não migrou 5, detalhes da Conversa 1, Mensagem de Flow 4); 9 Espaços de 132 linhas: **141 itens em 15 categorias**. A categoria nova `mensagem-sem-id` (M-04) não apareceu: nenhuma Mensagem da cópia está sem id.
- **`--migrar --funil=migrar` em dois Espaços de teste (igual):** saída 0, `--verificar` 0, repetir "nada a fazer", as linhas do `--seco` foram as que entraram.

  | Espaço | contatos | identificadores | empresas | id. de empresa | contato_empresa | Funis | Etapas | negócios | canais | conversas | mensagens | consentimentos | `crm_de_para` |
  |---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
  | `ws_spike_10x` | 39 | 75 | 12 | 24 | 30 | 4 | 23 | 19 | 3 | 16 | 62 | 45 | 307 |
  | `ws_outbox_1790002249349_te7t5z` | 39 | 75 | 12 | 24 | 30 | 4 | 23 | 19 | 3 | 16 | 55 | 45 | 300 |

- **Papel `n1_api` (igual):** "n1_api: concessões aplicadas"; `ws_n1 --migrar --funil=migrar` (0), `ws_spike --guardar` (0), `--verificar` dos dois (0); `ws_n1`: Funis 3, Etapas 7, `crm_de_para` 2; `ws_spike`: 876 em `registros`, 134 em `registros_crm_antigo`.
- **`hidratar` (igual):** `19 Espaço(s), 0 falha(s)`; nenhum Espaço com alguma das oito coleções antigas; 14 Conversas de Grupo no total.

## Concorrência e interrupção (UCR-10, M-05)

- **Espera medida:** uma sessão travou a linha do Espaço `ws_spike` por cerca de 7 s; o `--guardar` lançado 1 s depois saiu com 0 e 6,1 s depois do lançamento, isto é, esperou a trava (a trava durou ~6 s depois do lançamento). Dentro do prazo de ~10 s.
- **Duas execuções simultâneas** no mesmo Espaço (`ws_teste_classificacoes_1790201209011_rkgmin`): as duas saíram com 0; uma "guardado" e a outra "nada a fazer"; revisão 2 → 3 (uma vez só); `--verificar` ok. Isso vale porque a primeira terminou em menos de ~10 s. **A segunda espera a trava por ~10 s; se a primeira demorar mais, a segunda sai com 1 e "Outra alteração entrou antes desta. Tente de novo." sem escrever nada (M-05; o texto do `15-CORTE.md` foi corrigido).** Esse caminho (esgotar o prazo) está provado por `unidade-de-trabalho-concorrencia.test.ts`, não por este ensaio.
- **`kill -9` no meio** (`ws_outbox_1790002249349_te7t5z`): o `--guardar` parou no `delete from plataforma.registros` esperando uma linha travada por outra sessão (1 sessão em `Lock`) e levou `kill -9` (nenhum processo restou). Depois de encerrar a sessão do próprio ensaio: nenhuma transação aberta esquecida, revisão 5 → 5, `registros` 920 → 920, `registros_crm_antigo` 0 → 0. Um `--guardar` normal em seguida terminou com 0 ("guardado. 132 linha(s)") e o `--verificar` deu ok.

## O que este ensaio não cobre (além dos limites do 15-30 e do 15-34, que seguem valendo)

- **H-01 e H-02 não aparecem nesta cópia.** Não há nela Conversa cujo Canal já esteja só em `plataforma.canais`, nem Conversa 1:1 de Flow em `registros`: o ensaio prova que o código corrigido não mudou nenhum número do caminho antigo; o caminho novo está provado só em Docker com dado sintético (`mapeador.test.ts`, `migrar-entidades.test.ts`, `migrar-crm-antigo.test.ts`, `colecoes.test.ts`). O dono pode ter dado vivo desse tipo hoje: por isso o `15-CORTE.md` manda rodar o `--seco` do `ws_n1` de novo imediatamente antes do `--migrar`.
- **A cópia continua sendo a de 2026-11-05 11:13.**
