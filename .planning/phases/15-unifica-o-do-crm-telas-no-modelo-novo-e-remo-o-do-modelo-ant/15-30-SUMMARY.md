---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 30
subsystem: api
tags: [ensaio, migracao, docker, registros-crm-antigo, funil, pasta-meus-negocios, concorrencia, ucr-10]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "migrar:crm-antigo com --seco/--guardar/--migrar/--verificar (15-27), mapeador de entidades (15-28), migracao 012 (15-04)"
provides:
  - "15-ENSAIO.md: os numeros do script sobre a copia de 2026-11-05 (dump restaurado inteiro), nos 19 Espacos e nos dois caminhos do Funil do ws_n1"
  - "prova em Docker de que a segunda execucao espera a trava do Espaco e de que kill -9 no meio deixa o Espaco como antes"
  - "duas linhas deviation abertas no WINDOWS.md (copia parada em 2026-11-05; decisao do Funil e Pasta)"
affects: [15-34, 15-35]

plan_head_before: 88661405d449081e6d89075dc405ee84200d28a5
plan_head_after: d1082f0fd4e8582a61948409f6435e2842e2fb1a
commits: 1

actuals:
  tokens: 9000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "ensaio com a copia restaurada por pg_restore num postgres:16 de Docker ligado so ao 127.0.0.1, com trap que derruba o contêiner também em falha"
    - "prova de interrupção: uma sessão trava uma linha de registros, o --guardar para no delete (visto em pg_stat_activity), kill -9, e as contagens e a revisão voltam ao antes"
    - "prova de espera: uma sessão trava a linha do Espaço e o instante em que ela solta é comparado com o do fim da execução"

key-files:
  created:
    - .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-ENSAIO.md
  modified:
    - .planning/WINDOWS.md

key-decisions:
  - "A cópia de 2026-11-05 foi importada pelo .dump (pg_dump -Fc do schema plataforma, restaurado inteiro) e não pelo CSV das nove coleções; o CSV só conferiu o dump (digest idêntico em 146 grupos, 2128 linhas). Assim a checagem da Pasta Meus negócios rodou com dado real"
  - "A 011 foi aplicada pelo texto e registrada à mão em plataforma.migracoes, que é o estado de produção; a 012 pelo npm run migrar"
  - "O contêiner foi ligado a 127.0.0.1 (e não a todas as interfaces) porque o dump carrega dado pessoal"
  - "Além do que o plano pedia: --migrar --funil=migrar em dois Espaços de teste e o script com o papel n1_api, ambos em Docker, para exercitar o mapeador fora da fixture e as permissões de runtime"

requirements-completed: []

coverage:
  - id: D1
    description: "A 012 e a única migração pendente depois da 011; migrar a aplica; --seco, --guardar, --migrar e --verificar rodam nos 19 Espaços da cópia e a contagem de registros_crm_antigo (2128) é igual à do --seco, por Espaço e por coleção"
    requirement: UCR-10
    verification:
      - kind: manual
        ref: "15-ENSAIO.md, seções 'Saída do --seco das migrações' e 'Contagem por coleção' (script descartável, Docker local)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O ws_n1 passa pelos dois caminhos do Funil (--funil=guardar e --funil=migrar), cada um num banco restaurado do mesmo ponto, com --verificar ok e repetição sem efeito"
    requirement: UCR-10
    verification:
      - kind: manual
        ref: "15-ENSAIO.md, seção 'ws_n1: o relatório e os dois caminhos do Funil'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Borda UCR-10: a segunda execução simultânea espera a primeira (nada a fazer) e matar o processo no meio deixa o Espaço como antes (revisão, registros, registros_crm_antigo)"
    requirement: UCR-10
    verification:
      - kind: manual
        ref: "15-ENSAIO.md, seção 'Concorrência e interrupção'"
        status: pass
    human_judgment: false
  - id: D4
    description: "O que o dono decide no corte com estes números: aceitar a lista de Não migrados, o Funil Padrão do ws_n1 (guardar ou migrar) e a Pasta Meus negócios que fica em 16 Espaços de teste"
    verification: []
    human_judgment: true
    rationale: "O ensaio mostra o que cada caminho faz; escolher é do dono, no --seco do dia do corte (15-34/15-35)."

duration: ~15min
completed: 2026-11-06
---

# Phase 15 Plan 30: Ensaio local do migrar:crm-antigo Summary

**O `migrar:crm-antigo` rodou inteiro em Docker sobre a cópia de 2026-11-05 (dump do schema `plataforma` restaurado, 19 Espaços): `--seco` e `--verificar` contam as mesmas 2128 linhas em cada Espaço, o `ws_n1` passou pelos dois caminhos do Funil, a segunda execução esperou a trava e `kill -9` no meio deixou o Espaço como antes.**

## Performance

- **Duration:** ~15 min (20:06 a 20:21 UTC; a maior parte foi o script de ensaio e o `npm run` por Espaço)
- **Tasks:** 2 (Task 1, a checkpoint do dono, respondida pelo orquestrador; Task 2, o ensaio)
- **Files:** 1 criado (`15-ENSAIO.md`) e 1 alterado (`WINDOWS.md`), mais este SUMMARY

## Resposta da checkpoint

Resposta da checkpoint: **usar a cópia de 2026-11-05**, dada pelo orquestrador a partir de "pode fazer o que precisar para fechar a fase" do dono em 2026-11-06. O dono não renovou a cópia. A Task 1 foi conferida só com `ls -la` e `wc -l` (nenhum conteúdo aberto): `backup-plataforma-pre-011-20261105-1113.dump`, `contagem-origem.txt`, `registros-crm-antigo.csv` (2128 linhas de dados) e `workspaces.csv` (18 linhas), e `git -C ~/n1-ensaio rev-parse` falha (a pasta está fora do repositório).

## Accomplishments

- **A cópia entrou pelo `.dump`, não só pelo CSV.** O dump é um `pg_dump -Fc` do schema `plataforma` (22 tabelas, 51 coleções, 23952 linhas em `registros`, 19 Espaços). `pg_restore --no-owner --no-privileges` num `postgres:16` trouxe tudo (um erro ignorável: `transaction_timeout`). O CSV carregado à parte tem o mesmo digest do dump nas nove coleções (146 grupos de Espaço e coleção, 2128 linhas). Por isso a checagem da Pasta "Meus negócios" usou Listas e Tarefas reais.
- **Migrações.** Com as 10 primeiras no dump, `--seco` mostrou 011 e 012 pendentes; a 011 foi aplicada pelo texto (estado de produção); `--seco` mostrou só a 012; `migrar` aplicou a 012; `banco:conceder` caiu no ramo "papel não existe".
- **2128 = 2128, por Espaço.** `--seco` nos 19 Espaços não mudou nada (contagens e revisões iguais); `--guardar` nos 18 de teste e `--migrar --funil=guardar` no `ws_n1`; `--verificar` ok nos 19. O total por coleção bate com o do `14-ENSAIO.md` (624, 192, 480, 16, 16, 66, 304, 80, 350). `registros` foi de 23952 a 21838 (saíram 2114 = 2128 menos 14 Conversas de Grupo que ficam). `hidratar` leu os 19 Espaços sem falha, sem nenhuma das oito coleções (só as 2 Conversas de Grupo dos 7 Espaços que as têm).
- **O `ws_n1` pelos dois caminhos.** O CRM antigo do `ws_n1` é só o Funil "Padrão" (1 Etapa, nenhum Negócio). `--funil=guardar`: Funis 2 → 2, Etapas 6 → 6. `--funil=migrar` (num segundo banco restaurado do mesmo ponto): Funis 2 → 3, Etapas 6 → 7, 2 linhas em `crm_de_para`, sem nome em uso. Os dois com `--verificar` ok e repetição "nada a fazer".
- **Pasta "Meus negócios" com dado real.** O `ws_n1` não a tem; 16 Espaços de teste a têm com 18 Tarefas em 4 Listas, então nada saiu e nenhuma Tarefa foi tocada.
- **Concorrência e interrupção (borda UCR-10).** A segunda execução esperou a trava do Espaço (terminou 0,05 s depois de a sessão soltar a linha) e, com duas simultâneas, uma guardou e a outra disse "nada a fazer" (revisão subiu 1). O `--guardar` parado no `delete` (visto em `pg_stat_activity`) levou `kill -9`: revisão, `registros` e `registros_crm_antigo` ficaram como antes, sem transação esquecida, e uma nova execução terminou ok.
- **Extras (fora do plano).** `--migrar --funil=migrar` em `ws_spike_10x` e `ws_outbox_…te7t5z`: as linhas que o `--seco` anunciou foram as que entraram (por exemplo 39 Contatos, 12 Empresas, 19 Negócios, 16 Conversas, 62 e 55 Mensagens), `--verificar` ok. O script com o papel `n1_api` em `DATABASE_URL` (depois do `banco:conceder`) também passou.

## Task Commits

1. **Task 1 (checkpoint):** sem commit; respondida pelo orquestrador (ver acima).
2. **Task 2:** `d1082f0` `docs(15-30): ensaio do migrar:crm-antigo sobre a copia de 2026-11-05` (15-ENSAIO.md e duas linhas em WINDOWS.md).

**Plan metadata:** commit `docs(15-30)` seguinte (este SUMMARY, STATE.md e ROADMAP.md).

## Verificação

- `grep -c registros_crm_antigo 15-ENSAIO.md` = 12; `grep -c "funil=migrar\|funil=guardar"` = 12; `grep -c 2128` = 4; `grep -ciE "@[a-z0-9.-]+\.[a-z]{2,}|\+55"` = 0 (nenhum e-mail ou telefone).
- `docker ps` não lista `crm-n1-pg-1530`; o script, o ponto de restauração (`.dump` com dado pessoal) e as saídas foram apagados do diretório de sessão. Nenhum arquivo de `~/n1-ensaio` entrou no repositório. As saídas do script foram conferidas por grep: 0 e-mail ou telefone.
- Nenhum `npm run build`, nenhum `.env` lido, nenhum comando contra banco que não fosse o Docker local (todo comando levou as duas URLs `localhost:55730`); nenhum contêiner `supabase_*` ou volume alheio tocado.

## Decisions Made

Ver `key-decisions` no cabeçalho. A mais importante para o dono: o CRM antigo do `ws_n1` é só o Funil "Padrão" do bootstrap, então o `--funil=migrar` acrescentaria um Funil vazio ao lado dos 2 que o CRM novo já tem; o `--funil=guardar` não muda nada no CRM novo.

## Deviations from Plan

### Fora do contrato do plano (registradas)

- **A checkpoint do dono não foi cumprida.** O plano previa o dono renovar a cópia; o orquestrador aplicou o segundo sinal ("usar a cópia de 2026-11-05"). Consequências no `15-ENSAIO.md`: a cópia é anterior a tudo o que o dono fez em produção depois de 2026-11-05; as tabelas do CRM novo do `ws_n1` vêm do dump daquela hora, não recopiadas; o dono pode renovar e repetir o ensaio antes do corte.
- **Importação pelo `.dump` em vez de `\copy` do CSV.** O plano descrevia `\copy ... from`; o `.dump` já carregava todas as coleções e as tabelas do CRM novo, e o `pg_restore` evita remontar colunas à mão. O CSV virou conferência (digest idêntico).
- **A 011 aplicada pelo texto + `insert` em `plataforma.migracoes`**, como o plano manda ("aplicar 001 a 011 pelo texto"), mas só a 011: as 10 primeiras já vinham no dump.
- **19 Espaços e 18 de teste, não 18 e 17.** A cópia tem `ws_agendaworker_1790352062935_2haflp`, sem nenhuma linha em `registros`; o `--guardar` nele disse "nada a fazer".
- **Além do pedido:** os dois extras (`--migrar --funil=migrar` em dois Espaços de teste e o papel `n1_api`); ligar o contêiner só a `127.0.0.1`.

**Total deviations:** 0 auto-fixed; as decisões acima são escolhas de execução. **Impact:** nenhuma amplia escopo de código (o plano só produz o `15-ENSAIO.md`).

## Known Stubs

Nenhum.

## Linhas abertas em `.planning/WINDOWS.md` (kind `deviation`, fase 15)

- **Copia parada em 2026-11-05:** o corte precisa do `--seco` do dia em cada Espaço; o dono pode renovar a cópia e repetir o ensaio. A cópia tem 19 Espaços.
- **Funil do `ws_n1` e Pasta:** a decisão do Funil e os achados da Pasta (16 Espaços de teste ficam com a Pasta e 18 Tarefas; atualiza o aviso 51, que dizia 17). O aviso 51 continua aberto.

## Issues Encountered

- **Nenhum achado torna o script inseguro para o corte.** O que o ensaio não prova está em "O que o ensaio não cobre" do `15-ENSAIO.md`: o dado de hoje, o mapeador sobre dado real de pessoa (o `ws_n1` não tem CRM antigo além do Funil), o Postgres 17.6 da VM, e a queda do banco (a prova foi `kill -9` do processo do script).
- O primeiro cálculo de colunas da tabela por Espaço saiu trocado (um `join`); refeito antes de escrever o `15-ENSAIO.md`.

## User Setup Required

None - nenhum serviço externo. (A renovação opcional da cópia em `~/n1-ensaio` é do dono, antes do corte.)

## Next Phase Readiness

- Pronto para o corte (15-34/15-35): o dono lê o `--seco` do dia de cada Espaço, decide o Funil do `ws_n1` e roda `--guardar`/`--migrar` Espaço por Espaço, com `--verificar` e a contagem de `registros_crm_antigo` conferida com a do `--seco`.
- `requirements-completed` fica vazio de propósito: UCR-10 é declarado também pelo 15-34 (`requirements.ready-ids`: 0/1).

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivo criado conferido no disco (`[ -f ]`): `15-ENSAIO.md`.
- Commit `d1082f0` é ancestral do HEAD.
- Os dois `grep` de aceite e o `<automated>` da Task 2 reexecutados: passam; nenhum contêiner `crm-n1-pg-1530` de pé.
