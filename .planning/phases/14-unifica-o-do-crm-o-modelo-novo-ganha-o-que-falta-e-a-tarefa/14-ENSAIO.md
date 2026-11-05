# Fase 14 — Ensaio da migração 011 sobre a cópia dos dados reais (plano 14-19, D-02)

**Quando:** 2026-11-05 · **SHA do código:** `02d1608` · **Migração ensaiada:** `apps/api/migracoes/011-crm-o-que-faltava.sql`

**Resultado: a 011 aplicou limpa sobre a cópia. Nenhuma linha de `plataforma.registros` mudou, as cinco tabelas novas nasceram com 0 linhas e `hidratar` leu os 18 Espaços sem falha.**

Este arquivo só tem números. A cópia (nome, telefone, e-mail e Mensagens de clientes) ficou na pasta do dono, fora do repositório, e o contêiner do ensaio foi apagado.

## Como foi feito

1. **Cópia.** Pelo `psql`, em sessão `default_transaction_read_only = on`, com `\copy` das nove coleções do CRM antigo de `plataforma.registros` (colunas `workspace_id, colecao, id, dados, ordem`; as geradas ficam de fora) e das linhas de `plataforma.workspaces` desses Espaços. Quem rodou foi o agente, a pedido explícito do dono na conversa, em vez de o dono rodar o `\copy` (o plano previa o dono; a mitigação T-14-46 foi dispensada por ele). Só leitura: nenhuma escrita em produção.
2. **Banco do ensaio.** `postgres:16` em Docker (`crm-n1-pg-1419`, porta 55619), com as migrações 001 a 010 aplicadas pelo texto e registradas em `plataforma.migracoes`, que é o estado de produção (lá estão aplicadas as dez e só a 011 está pendente).
3. **Importação** com `\copy ... from stdin csv header` de `plataforma.workspaces` e de `plataforma.registros`.
4. `npm run --silent migrar -- --seco`, `npm run --silent migrar` e `npm run --silent banco:conceder` em `apps/api`, com `DATABASE_URL` e `DATABASE_URL_MIGRACAO` apontando para o Docker local.
5. Contagem antes e depois, e `hidratar(cliente, workspaceId)` de cada Espaço por um script descartável fora do repositório (já apagado), que imprimiu só contagens.
6. `docker rm -f crm-n1-pg-1419` ao fim (por `trap`, também em caso de falha).

## Saída do `--seco`

```
aplicada  001-plataforma.sql
aplicada  002-registros-colunas-geradas.sql
aplicada  003-integracao-e-importacao.sql
aplicada  004-outbox-indice-unico-por-workspace.sql
aplicada  005-agenda-de-automacoes.sql
aplicada  006-outbox-indice-unico-canal.sql
aplicada  007-crm.sql
aplicada  008-canais-conversas-mensagens.sql
aplicada  009-seguranca-e-cofre.sql
aplicada  010-carga-e-bloqueio-da-lista.sql
pendente  011-crm-o-que-faltava.sql
1 pendente(s); nada foi aplicado (--seco).
```

`migrar` aplicou só `011-crm-o-que-faltava.sql` (31 ms).

## Contagem por coleção (as linhas-base da Fase 15)

| Coleção | Antes da 011 | Depois da 011 |
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

Espaços importados: **18**. O total de `plataforma.registros` (todas as coleções, não só as nove) também é 2128 antes e depois, e a contagem por Espaço e coleção é idêntica (146 linhas de contagem, sem diferença).

## Tabelas novas da 011 logo depois de aplicar

| Tabela | Linhas |
|---|---:|
| `contato_consentimentos` | 0 |
| `contato_notas` | 0 |
| `conversa_marcacoes` | 0 |
| `crm_de_para` | 0 |
| `registros_crm_antigo` | 0 |

`crm_de_para` e `registros_crm_antigo` nascem vazias de propósito: quem as enche é o script de migração da Fase 15 (D-03: a 011 não apaga nada de `registros`).

## `hidratar` por Espaço (contagem do estado hidratado, depois da 011)

| espaco | contacts | companies | contactCompanyLinks | companyCompanyLinks | distinctFromLinks | funnels | deals | channels | conversations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ws_debug_automations | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 21 |
| ws_n1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| ws_outbox_1790002249349_te7t5z | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 21 |
| ws_outbox_1790002291927_omse5x | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 21 |
| ws_outbox_1790003023016_1piqto | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 21 |
| ws_outbox_1790003053712_n8hwvy | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 21 |
| ws_outbox_1790003082199_8p285y | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 21 |
| ws_outbox_1790003204554_88m39n | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 21 |
| ws_outbox_1790003250872_a25rdn | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 21 |
| ws_outbox_1790003328681_yo1893 | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 21 |
| ws_outbox_1790206152726_hx6qku | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 23 |
| ws_spike | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 23 |
| ws_spike_10x | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 23 |
| ws_teste_classificacoes_1790201209011_rkgmin | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 23 |
| ws_teste_classificacoes_1790353187334_ws3at4 | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 23 |
| ws_teste_classificacoes_1792754637371_e6mf4d | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 23 |
| ws_teste_importar_sol_1790373466622_3ery4e_ref | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| ws_teste_integracao_solicitacoes_1790129575792_jyorfo | 39 | 12 | 30 | 1 | 1 | 4 | 19 | 5 | 23 |

`hidratar: 18 Espaço(s), 0 falha(s)`. Cada contagem bate com a da tabela "por Espaço" de antes da 011.

## O que o ensaio mostrou sobre os dados

- **Só `ws_n1` é Espaço real, e nele o CRM antigo está praticamente vazio:** 1 funil e nada de Contatos, Empresas, Negócios, Canais ou Conversas. Os outros 17 Espaços são resíduo de teste (`ws_outbox_*`, `ws_teste_*`, `ws_spike*`, `ws_debug_automations`): 16 carregam a mesma semente de demonstração (39 Contatos, 12 Empresas, 30 vínculos Contato-Empresa, 4 funis, 19 Negócios, 5 Canais, 21 a 23 Conversas) e 1 tem só o funil. Para o script da Fase 15, o que há de CRM antigo em produção é, quase por inteiro, semente de teste, e as 2128 linhas acima são o número que ele precisa conferir.
- **O CRM novo em produção também é pequeno:** 2 Contatos (ambos `ativo`) e 0 Conversas em `plataforma.contatos` e `plataforma.conversas` (leitura de contagem, sem ler dado pessoal).

## O que o ensaio não cobre

- **`plataforma.contatos` e `plataforma.conversas` estavam vazias no banco do ensaio**, porque a cópia é só de `registros`. A 011 acrescenta constraints nelas (`contatos_estado_ck`, `contatos_mesclado_ck`, `contatos_mesclado_em_fk`, `conversas_na_lixeira_em_ck`), que o Postgres confere sobre as linhas existentes, e um `update` de backfill da lixeira. Pelo que há em produção (2 Contatos `ativo`, 0 Conversas, sem nenhuma `mesclado` nem `na_lixeira`) nenhuma delas pode falhar: as colunas novas nascem nulas, o estado `ativo` é aceito pelo novo `check` e o backfill roda sobre 0 linhas. É conclusão por leitura das constraints, não execução.
- **`banco:conceder` só exercitou o ramo "o papel `n1_api` não existe neste banco — nada concedido"**, porque o Postgres do ensaio não tem esse papel. Em produção ele concede de verdade; rode-o depois do `migrar`, como no roteiro do deploy.
- **A 011 não foi ensaiada contra o banco de produção** (nem deveria): ela continua pendente lá, e o roteiro é o do `CONTEXT.md` da raiz (backup manual, `migrar -- --seco`, `migrar`, `banco:conceder`).

## Conferência do incidente do 14-17

`select count(*) from plataforma.registros where workspace_id = 'ws_rotas_teste'` e a mesma contagem em `plataforma.workspaces`: **0 e 0**. O teste do 14-17 que rodou sem `DATABASE_URL` não deixou resíduo em produção.
