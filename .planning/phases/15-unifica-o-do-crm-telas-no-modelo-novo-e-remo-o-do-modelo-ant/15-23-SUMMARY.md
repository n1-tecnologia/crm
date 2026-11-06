---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 23
subsystem: inicio-e-paineis
tags: [inicio, painel, estatisticas, panorama, leads, parcial, swr, tdd, ucr-07]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-18: GET /crm/inicio/{panorama,leads-a-atender,estatisticas} e os hooks usePanoramaDoCrm, useLeadsAAtender, useEstatisticasDoCrm; 15-14: o selo e o robo ja liam Conversas atribuidas da api; 15-06: useConversas, AvatarDoContato e a guarda sem-crm-antigo"
provides:
  - "Inicio sem Contatos, Negocios e Conversas do CRM antigo no store: Leads a atender = useLeadsAAtender(qualificacoesDeLead(state)); Mensagens novas = useConversas({ naoLidas, atribuidoId }) + mensagensNovasDasConversas; estatisticas = Tarefas do store + contagens por dia de GET /crm/inicio/estatisticas"
  - "derive-resumo: qualificacoesDeLead, mensagensNovasDasConversas, estatisticasDoMembro(state, membro, periodo, agora, crm), janelasDeConsultaDoCrm, juntarEstatisticasDoCrm; leadsAAtender e conversasComMensagensNovas removidos"
  - "montarPanorama(state, membro, formato, agora, notificacoes, panorama) usa GET /crm/inicio/panorama; panorama-do-robo.ts sai de CONGELADOS"
  - "widgetReading(state, widget, membro, agora, crm: LeituraDoCrmParaPainel): Fontes de Negocio, Conversa e Contato leem as listas das rotas; leitura marcada parcial quando o total passa do lido"
  - "Painel (/paineis/[painel]) le useNegocios, useConversas, useContatos, useFunis (ate 200, so dos alvos usados) e useEtapasDosFunis; 'Parcial: primeiros 200' no Widget"
affects: [15-33, 15-43]

plan_head_before: c3064f0c58068c62fd42524ca9b896b3f77cfd73
plan_head_after: 846dcc742cc6fff63e2686e91439d3bb585d025d

actuals:
  tokens: 30300
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "derivacao de dominio que junta store e api: o derivado puro recebe a parte do CRM por argumento e o componente a monta (mesmo molde do 15-14)"
    - "duas consultas fixas (janela atual e anterior) em vez de uma, quando o teto de 400 dias da api nao cobre periodo + comparacao"
    - "leitura parcial dita: total > lido marca a leitura e a tela mostra 'Parcial: primeiros N', por alvo de Widget"
    - "estado de carregando/recusado por Widget (texto 'Lendo os dados do CRM…', 403 vira semAcesso) em vez de zero"

key-files:
  created:
    - packages/dominio/src/leitura-de-widget-do-crm.test.ts
    - apps/web/src/features/inicio/inicio-no-crm-novo.test.tsx
    - apps/web/src/app/(shell)/paineis/[painel]/painel-no-crm-novo.test.tsx
  modified:
    - packages/dominio/src/derive-resumo.ts
    - packages/dominio/src/derive-resumo.test.ts
    - packages/dominio/src/derive.ts
    - packages/dominio/src/operations/operations.test.ts
    - packages/dominio/src/sem-crm-antigo.test.ts
    - packages/dominio/CONTEXT.md
    - apps/web/src/features/inicio/resumo-do-inicio.tsx
    - apps/web/src/features/inicio/panorama-do-robo.ts
    - apps/web/src/app/(shell)/paineis/[painel]/page.tsx
    - apps/web/src/dados/crm/funis.ts
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md

key-decisions:
  - "As estatisticas pedem DUAS janelas a api (atual e anterior): a api aceita 400 dias por pedido e o 'ano' com o ano anterior para comparar passa de 700. As duas sao estaveis o dia inteiro (a atual termina no fim do dia de hoje, nao no 'agora' do minuto) para a chave do SWR nao mudar a cada minuto; juntarEstatisticasDoCrm une as respostas"
  - "O dia do CRM e um ponto no inicio do dia civil no fuso do Espaco; a janela anterior abre no inicio do dia que contem anteriorInicio (comparacao por dia inteiro, as consultas pedem exatamente esses dias)"
  - "Sem 'crm' (carregando) ou com serie null (Papel sem 'ler'), o CRM vale zero e o robo nao inventa numero; recusa da api vira aviso 'As estatisticas do CRM nao carregaram'"
  - "Mensagens novas soma as 'naoLidas' das linhas lidas (ate 200) e diz 'nas primeiras N de M Conversas' quando o total passa: o numero nao finge ser total (prohibition de UCR-07, transparency)"
  - "widgetReading marca 'parcial' so nos Widgets cuja Fonte e do CRM e a pagina calcula 'parcial' por alvo (Negocios, Conversas, Contatos): Contatos a mais nao mancham um Widget de Negocios; Tarefa nunca e parcial"
  - "Origem e Motivo de Perda do Painel ficam sem linhas ate a lista resumida trazer origem/motivoPerda (texto livre no Negocio novo); o tipo ja aceita os dois campos opcionais"
  - "Etapas do Painel vem de uma GET /funis/:id por Funil lido por Widget 'por Etapa' (useEtapasDosFunis), porque FunilResumo nao traz as Etapas; Funil que a api recusa nao contribui"

requirements-completed: [UCR-07]

coverage:
  - id: D1
    description: "Leads a atender do Inicio vem de GET /crm/inicio/leads-a-atender com as Qualificacoes Lead do Catalogo; os Contatos antigos do store nao entram; link para a ficha ou para a Conversa"
    requirement: UCR-07
    verification:
      - { kind: test, ref: "apps/web/src/features/inicio/inicio-no-crm-novo.test.tsx#Leads a atender (15-23, tracer)", status: pass }
      - { kind: test, ref: "packages/dominio/src/derive-resumo.test.ts#Leads a atender — as Qualificações que a api recebe", status: pass }
    human_judgment: false
  - id: D2
    description: "Mensagens novas vem de GET /conversas?naoLidas=true&atribuidoId=<Membro>; soma das nao lidas das linhas; atalho diz 'nas primeiras N de M' quando parcial"
    requirement: UCR-07
    verification:
      - { kind: test, ref: "apps/web/src/features/inicio/inicio-no-crm-novo.test.tsx#Mensagens novas (15-23, tracer)", status: pass }
      - { kind: test, ref: "packages/dominio/src/derive-resumo.test.ts#mensagens novas — as linhas que a api devolve", status: pass }
    human_judgment: false
  - id: D3
    description: "estatisticasDoMembro com o CRM por dia (baldes, comparacao com o periodo anterior, fuso do Espaco, Valor numa moeda so); duas janelas dentro dos 400 dias; ano incluso"
    requirement: UCR-07
    verification:
      - { kind: test, ref: "packages/dominio/src/derive-resumo.test.ts#estatisticasDoMembro — o CRM vem por argumento; janelasDeConsultaDoCrm e juntarEstatisticasDoCrm", status: pass }
      - { kind: test, ref: "apps/web/src/features/inicio/inicio-no-crm-novo.test.tsx#Estatisticas (15-23)", status: pass }
    human_judgment: false
  - id: D4
    description: "Panorama do robo usa GET /crm/inicio/panorama (Contatos recentes, Negocios abertos e valor ponderado, Conversas abertas); sem panorama ou bloco null, zero e sem valor"
    requirement: UCR-07
    verification:
      - { kind: test, ref: "apps/web/src/features/inicio/inicio-no-crm-novo.test.tsx#Panorama do robo (15-23)", status: pass }
    human_judgment: false
  - id: D5
    description: "widgetReading le Negocios, Conversas, Contatos, Funis e Etapas por argumento (nada de state.deals/conversations/contacts/funnels); permissao do visualizador e RN-PAI-13 mantidas; leitura parcial marcada so em Fonte de CRM"
    requirement: UCR-07
    verification:
      - { kind: test, ref: "packages/dominio/src/leitura-de-widget-do-crm.test.ts (18 casos)", status: pass }
      - { kind: test, ref: "packages/dominio/src/operations/operations.test.ts#Leitura de Widget (massa do seed em forma de lista)", status: pass }
    human_judgment: false
  - id: D6
    description: "Painel le as listas das rotas (200), nomeia Etapas pela ficha do Funil, diz 'Parcial: primeiros 200', mostra 'Lendo…' enquanto carrega e Fonte sem acesso na recusa 403"
    requirement: UCR-07
    verification:
      - { kind: test, ref: "apps/web/src/app/(shell)/paineis/[painel]/painel-no-crm-novo.test.tsx (5 casos; mutacao de controle: parcial=false derruba o caso de parcial)", status: pass }
    human_judgment: false
  - id: D7
    description: "Borda UCR-07 (concorrencia): cada bloco do Inicio le uma rota de leitura pura; recarregar nao muda nada no banco"
    requirement: UCR-07
    verification:
      - { kind: test, ref: "15-18: apps/api/src/servicos/crm/inicio.test.ts#(e) e leitura, (i) e (m) revisao do Espaco; aqui nenhuma gravacao nova (so GET)", status: pass }
    human_judgment: false
  - id: D8
    description: "Aparencia do Inicio e do Painel (anatomia das linhas sem o trecho da Mensagem, aviso de recusa, nota 'Parcial') e a leitura em producao com dados reais"
    requirement: UCR-07
    verification: []
    human_judgment: true
    rationale: "Testes de jsdom nao julgam hierarquia visual nem o efeito dos Paineis semeados abrirem zerados com ids de Funil antigos; o dono ve no navegador (linhas abertas em WINDOWS)."
---

# Phase 15 Plan 23: Inicio e Painel sem o CRM antigo Summary

**O Inicio abre sem Contatos, Negocios e Conversas do store (Leads, Mensagens novas, estatisticas por dia em duas janelas e panorama do robo vem das rotas do 15-18 e de `GET /conversas`), e o Painel le as listas da api por argumento em `widgetReading`, dizendo "Parcial: primeiros 200" quando o total passa do lido.**

## Performance

- **Duration:** ~16 min de execucao do executor (17:38 a 17:54 UTC, 2026-11-06)
- **Tasks:** 3 (1 tracer + 2 auto, todas `tdd="true"`)
- **Files:** 15 alterados em `packages/` e `apps/` (3 testes novos, 1 hook novo)

## Accomplishments

- **Tracer (Task 1):** `leadsAAtender` e `conversasComMensagensNovas` sairam do dominio. O bloco "Leads a atender" chama `useLeadsAAtender(qualificacoesDeLead(state))` (so o Catalogo ainda e do store) e "Mensagens novas" chama `useConversas({ naoLidas: true, atribuidoId: <Membro>, limite: 200 })`. Os Leads trazem `AvatarDoContato` com o nome da api e levam a ficha do Contato ou direto a Conversa. O tracer foi verificado de ponta a ponta (dominio + web + guarda) antes de seguir.
- **Estatisticas e panorama (Task 2):** `estatisticasDoMembro(state, m, periodo, agora, crm)` mantem os baldes, a comparacao com o periodo anterior e o fuso do Espaco, soma por dia as contagens do CRM e deixa so as Tarefas concluidas no store. `montarPanorama` usa `GET /crm/inicio/panorama`.
- **Painel (Task 3):** `widgetReading(..., crm)` le Negocios, Conversas e Contatos das listas; a pagina busca so os alvos que algum Widget usa, nomeia a Etapa pela ficha do Funil e mostra a nota "Parcial: primeiros 200".
- **Guardas:** `derive-resumo.ts` (dominio) e `features/inicio/panorama-do-robo.ts` (web) sairam de `CONGELADOS`. `derive.ts` continua congelado (outras funcoes ainda leem o CRM antigo).

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (tracador) | `8bcd1fe` | `3ea8223` |
| 2 (estatisticas e panorama) | `621fd6b` | `f6cbe26` |
| 3 (Painel) | `41f89f1` | `7fe68e3` |

Avaliacao semantica do RED (plano `type: execute`, entao nao rodei `check tdd-red-evidence`):

- **Task 1:** dominio: oito casos falharam porque `qualificacoesDeLead` e `mensagensNovasDasConversas` nao existiam (`is not a function`); web: os seis casos renderizaram o `ResumoDoInicio` de verdade e falharam porque o componente nunca chamava `fetch` (elemento da api ausente, 0 chamadas).
- **Task 2:** doze casos de dominio falharam (os de `estatisticasDoMembro` por assercao, ja que o argumento novo era ignorado; as duas funcoes novas por inexistencia); sete casos web falharam (nenhuma chamada a `/crm/inicio/estatisticas`, `montarPanorama` sem o sexto argumento, `useRespostaDoRobo` sem `GET /crm/inicio/panorama`).
- **Task 3:** quinze dos dezoito casos do arquivo novo falharam (os tres que passavam sao regressao protegida: semAcesso da Convidada, Tarefa e texto sem marca). Sem REFACTOR separado. O teste de pagina nasceu junto da implementacao (nao estava no `files_modified`), e foi validado por mutacao: com `parcial: false` fixo, o caso de "Parcial" falha.

## Task Commits

1. `8bcd1fe` test(15-23) RED Leads e Mensagens novas
2. `3ea8223` feat(15-23) Leads e Mensagens novas do CRM novo
3. `621fd6b` test(15-23) RED estatisticas e panorama
4. `f6cbe26` feat(15-23) estatisticas e panorama do servidor
5. `41f89f1` test(15-23) RED widgetReading por argumento
6. `7fe68e3` feat(15-23) Painel com as linhas da api
7. `846dcc7` docs(15-23) CONTEXT do dominio e da web

## Verificacao

Tudo em vitest/jsdom, sem banco: **nenhum Postgres nem contêiner foi usado ou criado** (nada a parar); `apps/api` nao foi tocado.

- `packages/dominio`: suite inteira 128 arquivos, 2456 testes, todos verdes; `tsc --noEmit` limpo; `derive-resumo.test.ts` 28, `leitura-de-widget-do-crm.test.ts` 18, `operations.test.ts` 252, `sem-crm-antigo.test.ts` verde.
- `apps/web`: suite inteira 132 arquivos, 1295 testes, todos verdes; `tsc --noEmit` limpo; `eslint .` 0 erros (2 avisos antigos: `KnowledgeDocument` em `rotulos.ts` e `Target` em `app-shell.tsx`); `verificar-tokens` 0 falhas; `apps/api` `tsc --noEmit` limpo.
- Criterios de aceitacao: `grep -c useLeadsAAtender resumo-do-inicio.tsx` = 3 (>= 1); `grep -cE "state\.(contacts|deals|conversations)"` em `derive-resumo.ts` + `panorama-do-robo.ts` = 0; o corpo de `widgetReading` com `state.(deals|contacts|conversations|funnels)` = 0; `grep -c "Parcial: primeiros"` na pagina do Painel = 2 (>= 1).
- Guarda: o regex da guarda (`(state|data|estado|s|d).(contacts|companies|deals|funnels|channels|…)`) tem 0 acertos em `derive-resumo.ts` e em `panorama-do-robo.ts`; os dois sairam de `CONGELADOS` e as duas guardas seguem verdes (dominio 2/2, web 2/2).
- Nao rodei `npm test`, `npm run build` nem o `npm run check` inteiro (regras do projeto e disco: 7,7 GiB livres, sem build).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A api recusa janela de estatisticas acima de 400 dias; o "ano" com o anterior passa de 700**
- **Found during:** Task 2
- **Issue:** o plano manda `useEstatisticasDoCrm(janela, fuso)` com a janela de `janelaDoResumo` e a comparacao com o periodo anterior; para o periodo Ano (inicio + anterior de mesma duracao, ~700 dias) a rota daria 400. Alem disso `ate = agora` mudaria a chave do SWR a cada minuto.
- **Fix:** `janelasDeConsultaDoCrm` devolve a janela atual (do inicio do primeiro balde ao fim do dia de hoje) e a anterior (do inicio do dia que contem `anteriorInicio` a 1 ms antes da atual), ambas estaveis o dia inteiro e dentro de 400 dias; o Inicio faz duas consultas e `juntarEstatisticasDoCrm` as une. A comparacao do periodo anterior passa a ser por dia inteiro.
- **Files modified:** `packages/dominio/src/derive-resumo.ts` (+ testes), `apps/web/src/features/inicio/resumo-do-inicio.tsx`
- **Commit:** `f6cbe26`

**2. [Rule 3 - Blocking] Etapas do Painel nao vem da lista de Funis**
- **Found during:** Task 3
- **Issue:** a dimensao "por Etapa" precisa do nome da Etapa; `FunilResumo` (lista) nao traz Etapas e o argumento `funis: Funil[]` do plano nao as tem.
- **Fix:** `LeituraDoCrmParaPainel` ganhou `etapas` e `useEtapasDosFunis(ids)` em `apps/web/src/dados/crm/funis.ts` (fora de `files_modified`) le `GET /funis/:id` so dos Funis que algum Widget "por Etapa" usa; Funil recusado nao contribui.
- **Commit:** `7fe68e3`

**3. [Rule 2 - Missing] Carregando, recusa e leitura parcial por Widget**
- **Found during:** Tasks 2 e 3
- **Issue:** sem isso, lista ainda carregando ou 403 da api virava zero, e uma lista curta virava numero com cara de total (T-15-56, T-15-57).
- **Fix:** o Widget cuja lista carrega diz "Lendo os dados do CRM…", a recusa 403 vira `semAcesso` (outra falha vira texto), `parcial` e calculado por alvo pela pagina e marcado so nas leituras de Fonte do CRM; as estatisticas mostram "As estatisticas do CRM nao carregaram…" na recusa.
- **Commit:** `f6cbe26`, `7fe68e3`

**4. Arquivos fora de `files_modified`**
- `packages/dominio/src/operations/operations.test.ts` (as 5 chamadas de `widgetReading` ganharam o argumento; a massa de dados do seed antigo vira lista via helper `crmDoSeed`), `packages/dominio/src/sem-crm-antigo.test.ts` e `apps/web/src/sem-crm-antigo.test.ts` (saida de `CONGELADOS`), `apps/web/src/dados/crm/funis.ts`, `apps/web/src/app/(shell)/paineis/[painel]/painel-no-crm-novo.test.tsx`, `packages/dominio/CONTEXT.md` e `apps/web/CONTEXT.md`. So testes, hook e documentacao.

**5. Contrato do plano ajustado (registrado, nao silencioso)**
- `widgetReading` recebe `LeituraDoCrmParaPainel` com tipos `Pick` das listas resumidas (`NegocioResumo`, `ConversaNaLista`, `ContatoResumo`) em vez de `Negocio[]`/`Contato[]`/`Funil[]`, porque e isso que as rotas de lista devolvem; `funis` entra como `Pick<Funil, "id"|"nome">` (serve a dimensao `funnelId`).
- `leadsAAtender` e `conversasComMensagensNovas` foram removidos (o plano admitia "ou somem"): o bloco so precisa das linhas da api. `naoLidas` e `ultimaAtividade` ficam porque `inbox-columns.tsx` ainda os usa.

**Total deviations:** 3 auto-fixed (2 Rule 3, 1 Rule 2) mais arquivos fora da lista e ajuste de contrato; 0 arquiteturais.
**Impact:** nenhuma mudanca de camada nem de schema; a regra de dependencia (web e api so conhecem o dominio) foi mantida.

### Comportamento visivel que muda (abertas em `.planning/WINDOWS.md`, fase 15, `deviation`)

- Mensagens novas perde o trecho da ultima Mensagem (a lista nao o traz); acima de 200 Conversas o atalho diz "nas primeiras N de M"; Leads mostra iniciais (sem foto no modelo novo) e a api limita a 50.
- Estatisticas: duas consultas por abertura, comparacao por dia inteiro, metrica aberta por padrao e a de maior valor do periodo atual e pode mudar ao trocar de periodo ate o primeiro clique; recusa da api zera as tres metricas do CRM com aviso.
- Painel: os Paineis semeados (SDR, Closer, Atendimento) tem Fonte com ids do modelo antigo (`fnl_sdr`, `fnl_closer`, `fila_com`, `inbox_n1`) e abrem zerados com o CRM novo ate a Fonte apontar para um Funil/Fila novo (Sessao 20.3); Origem e Motivo de Perda ficam sem linhas (`NegocioResumo` nao traz os dois); cada Widget le ate 200 registros por recurso.
- **Resolvidas por este plano:** WINDOWS #24 (panorama do robo no store) e #34 (rotas do 15-18 sem tela) marcadas `fixed`.

## Self-Check

- Arquivos criados existem: `leitura-de-widget-do-crm.test.ts`, `inicio-no-crm-novo.test.tsx`, `painel-no-crm-novo.test.tsx` (conferidos na suite: rodaram verdes).
- Commits `8bcd1fe`, `3ea8223`, `621fd6b`, `f6cbe26`, `41f89f1`, `7fe68e3`, `846dcc7` estao no historico da branch (7 medidos de `plan_head_before` a `plan_head_after`).

## Known Stubs

Nenhum stub de dado. O trecho da ultima Mensagem do bloco "Mensagens novas" foi removido (nao e stub: esta documentado acima e em WINDOWS).

## Threat Flags

Nenhuma superficie nova: nenhuma rota, nenhum caminho de auth nem tabela. O Painel passa a chamar rotas de leitura que ja existem (`GET /negocios`, `/conversas`, `/contatos`, `/funis`, `/funis/:id`) com Papel e Espaco da sessao. T-15-56 e T-15-57 mitigados (403 vira `semAcesso`, `scopeVisible` mantido, marca "Parcial").

## Next Phase Readiness

Pronto para o proximo plano da onda. `derive.ts` segue em `CONGELADOS` do dominio ate os planos que removem o resto (15-33, 15-43).

## Self-Check: PASSED
