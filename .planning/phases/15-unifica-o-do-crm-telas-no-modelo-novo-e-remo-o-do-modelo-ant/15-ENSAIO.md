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
