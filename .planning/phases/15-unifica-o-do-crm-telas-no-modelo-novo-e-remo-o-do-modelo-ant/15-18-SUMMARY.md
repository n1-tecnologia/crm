---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 18
subsystem: crm
tags: [inicio, panorama, leads, estatisticas, agregado, swr, tdd, ucr-07]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-10: molde de rota/servico de leitura e o mapa tipo -> recurso de permissao; 15-14: o panorama do robo e o selo ja liam Conversas atribuidas da api; 15-06: a guarda sem-crm-antigo"
provides:
  - "GET /crm/inicio/panorama: 5 Contatos ativos mais recentes, total de Contatos, Negocios abertos (quantidade, valor ponderado e moeda unica) e Conversas ativas nao resolvidas, numa consulta"
  - "GET /crm/inicio/leads-a-atender?qualificacao=<id>: Contatos ativos do Membro da sessao, com Qualificacao na lista, semContato ou aguardandoResposta, quem espera ha mais tempo primeiro, ate 50"
  - "GET /crm/inicio/estatisticas?desde=&ate=&fuso=: Mensagens enviadas, Conversas resolvidas e Negocios ganhos do Membro por dia no fuso (e por moeda), janela maxima de 400 dias"
  - "@n1/dominio/crm/inicio: PanoramaDoCrm, LeadAAtenderDoCrm, EstatisticasDoCrm, LIMITE_DE_LEADS, JANELA_MAXIMA_DE_ESTATISTICAS_DIAS, conferirJanelaDeEstatisticas, fusoValido"
  - "usePanoramaDoCrm, useLeadsAAtender (chave estavel) e useEstatisticasDoCrm em apps/web/src/dados/crm/inicio.ts"
affects: [15-23]

plan_head_before: 9779c977e7eb040739397844830fb4b551fbf011
plan_head_after: eb378fbb21c494b18927ff5c88ad8a4d66ee24b1

actuals:
  tokens: 22000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "bloco desligado por parametro booleano (`case when $n::boolean then (subselect) end`): o Papel decide por recurso e o Postgres nao toca a tabela do bloco negado"
    - "varias series numa instrucao so com `union all` + `group by` por dia: uma fotografia consistente, custo limitado pela janela"
    - "dia cortado no fuso com `date_trunc('day', instante at time zone $n::text)` e `to_char`; o fuso so entra como parametro depois de conferido contra a lista IANA"

key-files:
  created:
    - packages/dominio/src/crm/inicio.ts
    - packages/dominio/src/crm/inicio.test.ts
    - apps/api/src/repositorios/crm/inicio.ts
    - apps/api/src/servicos/crm/inicio.ts
    - apps/api/src/servicos/crm/inicio.test.ts
    - apps/api/src/rotas/crm/inicio.ts
    - apps/api/src/rotas/crm/inicio.test.ts
    - apps/web/src/dados/crm/inicio.ts
    - apps/web/src/dados/crm/inicio.test.ts
  modified:
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/rotas/CONTEXT.md
    - apps/web/CONTEXT.md
    - packages/dominio/CONTEXT.md

key-decisions:
  - "\"Meu\" e sempre o Membro da sessao: nenhuma rota, servico ou hook recebe o id do Membro; o querystring `.strict()` recusa `membroId` e `workspaceId` com 400 antes do servico"
  - "O panorama traz tambem `contatosTotal`: o robo do Inicio mostra o total de Contatos, e o plano so listava os 5 recentes; sem ele o 15-23 teria de somar lista no navegador"
  - "Valor ponderado considera so os Negocios abertos COM Valor (o sem Valor soma 0 e nao conta moeda), como o panorama antigo; mais de uma moeda entre eles, `valorPonderado` e `moeda` voltam null"
  - "Panorama e estatisticas respondem 403 so quando o Papel nao le recurso nenhum (Membro desconhecido ou removido); com algum recurso legivel, o bloco negado volta null. Os Leads exigem Contato e Conversa e recusam 403 se faltar um"
  - "Conversas resolvidas = Conversas `resolvida` de que o Membro e o Atribuido, pelo momento de resolucao (suposicao a confirmar com o dono; registrada em WINDOWS)"
  - "Estatisticas por Negocio ganho saem por dia E moeda (`GanhosDoDia`): a web soma numa moeda so, como o resumo antigo (RN-PAI-13), sem o servidor escolher"
  - "`fuso`, `desde` e `ate` sao obrigatorios: um fuso padrao errado em silencio seria pior que um 400; o fuso e conferido contra `Intl.supportedValuesOf` mais UTC e, se o Postgres ainda assim recusar (22023), o servico responde 400 no campo fuso"
  - "Conversa \"aberta\" do panorama e a ativa nao resolvida (`aberta` e `pendente`), a mesma conta do panorama antigo (`state !== resolvida`)"

patterns-established:
  - "Agregado de leitura em consulta unica com blocos ligados pelo Papel; a regra de forma da entrada (janela, fuso) mora no dominio e a rota e o servico a aplicam igual"

requirements-completed: [UCR-07]

coverage:
  - id: D1
    description: "GET /crm/inicio/panorama soma no servidor os 5 Contatos recentes (lixeira e arquivado fora), os Negocios abertos ponderados e as Conversas nao resolvidas; outro Espaco nao entra"
    requirement: UCR-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/inicio.test.ts#(a) tracador (Postgres local 55718)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mais de uma moeda entre os Negocios abertos deixa o valor ponderado null; a Conversa pendente conta e a da lixeira nao"
    requirement: UCR-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/inicio.test.ts#(b) outra moeda e (c) Conversa pendente"
        status: pass
    human_judgment: false
  - id: D3
    description: "Leads a atender: so os Contatos do Membro da sessao com a Qualificacao pedida, semContato (desde a criacao, nota interna nao conta) ou aguardandoResposta (desde a Mensagem recebida, a Conversa que espera ha mais tempo), mais antigo primeiro, ate 50"
    requirement: UCR-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/inicio.test.ts#(f) leads, (g) meus e (h) teto de 50"
        status: pass
    human_judgment: false
  - id: D4
    description: "Estatisticas por dia no fuso pedido (23h30 e 23h50 locais no mesmo dia local), Conversas resolvidas pelo Atribuido e Negocios ganhos por dia e moeda, so do Membro da sessao"
    requirement: UCR-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/inicio.test.ts#(j) fuso e (k) resolvidas e ganhos"
        status: pass
    human_judgment: false
  - id: D5
    description: "A janela maxima de 400 dias, desde depois de ate e fuso desconhecido sao 400 na rota e no servico; parametro desconhecido (membroId) e 400; sem Authorization e 401"
    requirement: UCR-07
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/crm/inicio.test.ts (27 casos, servico falso; mutacao de controle: sem `.strict()` 7 falham)"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/crm/inicio.test.ts (13 casos)"
        status: pass
    human_judgment: false
  - id: D6
    description: "useLeadsAAtender([q2,q1]) e ([q1,q2]) usam a mesma chave e fazem uma chamada so; nenhum hook manda o Membro; recusa da api vira erro sem repetir"
    requirement: UCR-07
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/inicio.test.ts#(a) e (c) (mutacao de controle: sem o sort da chave, 2 de 10 falham)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Borda UCR-07 (idempotencia e concorrencia): as tres rotas so leem, cada uma numa consulta so; repetir devolve o mesmo, leituras concorrentes veem a mesma fotografia e a revisao do Espaco nao sobe"
    requirement: UCR-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/inicio.test.ts#(e) e leitura, (i) e (m) revisao do Espaco"
        status: pass
    human_judgment: false
  - id: D8
    description: "Prohibition UCR-07 (privacidade): as rotas do Inicio nunca recebem o id do Membro pelo cliente"
    requirement: UCR-07
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/crm/inicio.test.ts (membroId e workspaceId -> 400 nas tres rotas)"
        status: pass
    human_judgment: true
    rationale: "A prohibition esta marcada verification: judgment no plano; os casos provam que a rota recusa o campo e que 'meus' sai da sessao, mas a revisao de que nenhum caminho novo aceita o Membro de fora fica com o revisor."
---

# Phase 15 Plan 18: Agregado do Início no CRM novo Summary

**`GET /crm/inicio/{panorama,leads-a-atender,estatisticas}` somam no banco, sempre do Espaço e do Membro da sessão, o que `derive-resumo` e o panorama do robô somavam sobre o store, e `usePanoramaDoCrm`, `useLeadsAAtender` e `useEstatisticasDoCrm` os entregam à web.**

## Performance

- **Duração:** cerca de 15 min (13:09Z a 13:24Z)
- **Tasks:** 3 (1 traçador, 2 auto), todas `tdd="true"`
- **Arquivos:** 9 criados, 4 modificados
- **Commits:** 5 de tarefa (2 RED + 2 GREEN + 1 de testes/CONTEXT), medidos de `plan_head_before`

## Accomplishments

- **Domínio** (`crm/inicio.ts`, sem barril): os tipos do agregado, os limites (5 recentes, 50 Leads, 20 Qualificações, 400 dias) e `conferirJanelaDeEstatisticas`/`fusoValido`, a regra de forma que a rota e o serviço aplicam igual. Nenhum tipo carrega o id do Membro nem o do Espaço.
- **Repositório** (`repositorios/crm/inicio.ts`): três funções, cada uma UMA instrução SQL (uma fotografia). Panorama com subselects ligados por `case when $n::boolean` (o bloco que o Papel não lê nem toca a tabela); Leads com `left join lateral` que pega a última Mensagem externa de cada Conversa aberta; estatísticas com `union all` + `group by` por dia, o dia cortado no fuso e o fuso como `$n`.
- **Serviço** (`servicos/crm/inicio.ts`): `podeNoCrm(…, "ler", recurso)` por recurso lido do banco a cada chamada; bloco/série negado volta `null`; Membro sem Papel algum, 403. Teto de Qualificações e janela conferidos de novo (o serviço também é chamado sem a rota); fuso que o Node conhece e o Postgres não vira 400.
- **Rotas** (`rotas/crm/inicio.ts`, registradas em `rotas/crm/index.ts` como `rotasDoInicio`, opção `inicio` para teste): `.strict()` nos três `querystring`; `membroId`/`workspaceId` são 400. `qualificacao` repetível (um valor vira lista).
- **Web** (`dados/crm/inicio.ts`): os três hooks; `chaveDeLeads` (Qualificações únicas e ordenadas) e `chaveDeEstatisticas` exportadas; lista vazia de Qualificações não vai à api.
- **CONTEXT** de `apps/api/src/rotas`, `apps/web` e `packages/dominio` dizem o que cada rota soma, que "meu" é a sessão e que `derive-resumo` segue no modelo antigo até o 15-23.

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (traçador, panorama) | `92a3e2f` | `02279ba` |
| 2 (Leads e estatísticas) | `44cda2d` | `64cce48` |
| 3 (recusas, domínio, hooks) | — (testes sobre o que já existe; mutação de controle) | `eb378fb` |

Avaliação semântica do RED:

- **Tarefa 1:** o commit RED leva um esqueleto do serviço que devolve zeros e vazios; os cinco casos do panorama executaram e falharam pela asserção planejada (`quantidade: 0` onde se esperava 2, `negociosAbertos` não `null` para o Convidado). Uma primeira versão do fixture de Conversa na lixeira falhou por fixture (`conversas_na_lixeira_em_ck` exige `na_lixeira_em`) e foi corrigida no GREEN antes de passar.
- **Tarefa 2:** sete dos treze casos falharam por asserção (`[]` onde se esperava a lista, `[]` onde se esperava `null`); o caso `(l)` da janela já passava porque o esqueleto conferia a janela com a função do domínio, e protege regressão.
- **Tarefa 3:** os três arquivos passam de primeira porque a implementação já existia; a prova de que pegam é a mutação de controle: sem `.strict()` nas rotas 7 de 27 falham, sem o `sort` da chave dos Leads 2 de 10 falham (arquivos restaurados). Plano `type: execute`, então `check tdd-red-evidence` não foi usado.
- Sem REFACTOR separado.

## Verification

- Contêiner novo `crm-n1-pg-1518` (porta 55718, as duas URLs explícitas, migrações 001–012): `servicos/crm/inicio.test.ts` 13/13 e `rotas/crm/inicio.test.ts` 27/27 (40/40 juntos), nenhum arquivo `skipped`.
- Tarefa 3 (`<automated>` exato): domínio 13/13, rota 27/27 com `DATABASE_URL=` vazio, web 10/10; `tsc --noEmit` limpo em dominio, api e web; `eslint` limpo nos dois arquivos da web; `verificar:tokens` 0 falhas; `sem-crm-antigo` e `sem-listas-espelho` verdes (este plano não toca página, então não há `CONGELADOS` a encolher).
- Contêiner parado ao fim. Não rodei `npm test` nem `npm run check` inteiros (regra do projeto).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `contatosTotal` no panorama**
- **Found during:** Task 1
- **Issue:** o robô do Início mostra o total de Contatos (`contatos.total` em `montarPanorama`), e o plano só listava os 5 recentes; sem o total o 15-23 teria de somar lista no navegador, o que o plano proíbe.
- **Fix:** o campo `contatosTotal` (um `count` na mesma consulta).
- **Files modified:** `packages/dominio/src/crm/inicio.ts`, `apps/api/src/repositorios/crm/inicio.ts`
- **Commit:** `02279ba`

**2. [Rule 2 - Missing critical] Teto de Qualificações e fuso recusado pelo Postgres conferidos no serviço**
- **Found during:** Task 2
- **Issue:** o serviço também é chamado sem a rota (T-15-46, T-15-47); sem a conferência, mais de 20 Qualificações ou um fuso que o Node conhece e a tzdata do Postgres não (erro 22023) virariam 500.
- **Fix:** o serviço recusa mais de 20 Qualificações (400, campo `qualificacao`) e traduz 22023 em 400 no campo `fuso`.
- **Files modified:** `apps/api/src/servicos/crm/inicio.ts`
- **Commit:** `64cce48`

**3. Arquivos fora de `files_modified`:** só `CONTEXT.md` das três camadas (a regra mudou) e `apps/api/src/rotas/crm/index.ts` já estava na lista.

**Total deviations:** 2 auto-fixed (Rule 2), 0 arquiteturais.

### Suposição a confirmar com o dono (registrada em `.planning/WINDOWS.md`, linha 33, `deviation`, aberta)

"Conversas resolvidas" agora conta as Conversas `resolvida` de que o Membro é o Atribuído (`resolvida_em`), não as que ele clicou em resolver: o modelo novo não guarda quem resolveu, e resolver não grava Atividade em D-15-09. Efeito visível quando a tela trocar (15-23): quem resolve uma Conversa que não é dele, ou reabre e resolve de novo, deixa de contar como antes (reabrir e resolver duas vezes conta uma Conversa, não dois atos). Se o dono quiser o ato de quem clicou, é gravar o Ator ao resolver (domínio, api e migração).

### WINDOWS

- **Linha 33 (nova, aberta):** a suposição acima.
- **Linha 34 (nova, aberta):** as três rotas e os hooks existem, mas nenhuma tela os chama ainda; o panorama do robô, o painel de Leads e as estatísticas seguem no store até o 15-23.
- **Linha 24 (15-14, panorama do robô lê `state.conversations/contacts/deals`) continua ABERTA:** este plano entrega a fonte (`usePanoramaDoCrm`), mas quem troca o `montarPanorama` e as telas é o 15-23. Não a marquei como corrigida.

## Known Stubs

Nenhum. Os três hooks ainda não têm chamador (é o contrato que o 15-23 usa), o que é o escopo do plano e não um stub.

## Threat Flags

Nenhum. A superfície nova (`GET /crm/inicio/*`) é a do threat model do plano: T-15-45 (Espaço e Membro sempre da sessão, `.strict()` recusa `membroId`, casos entre Espaços e entre Membros), T-15-46 (teto de 400 dias, 20 Qualificações, 50 Leads e `group by` por dia) e T-15-47 (fuso conferido contra a lista IANA e passado como `$n`) estão mitigados e provados.

## Next Phase Readiness

Pronto para o 15-23: as telas do Início e do Painel trocam `leadsAAtender`, `estatisticasDoMembro` e o `montarPanorama` por `useLeadsAAtender`, `useEstatisticasDoCrm` e `usePanoramaDoCrm`. A tela precisa passar `desde`/`ate` estáveis (arredondados) aos hooks de estatística, ler do Catálogo os ids das Qualificações chamadas "Lead" e somar `GanhosDoDia` numa moeda só.

## Self-Check: PASSED

Arquivos criados conferidos no disco; commits `92a3e2f`, `02279ba`, `44cda2d`, `64cce48` e `eb378fb` são ancestrais de `HEAD`.
