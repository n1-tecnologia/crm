---
phase: 12-clone-clickup-grava-o-mais-r-pida
plan: 10
subsystem: api
tags: [medicao, producao, antes-depois, trava, grv-06, pitfall-9]

requires:
  - phase: 12-clone-clickup-grava-o-mais-r-pida
    provides: a trava e os dois regimes (12-04), o store novo (12-05 a 12-09), o comando gravacao:medir e o "antes" (12-02), a meta da parada (12-03)
provides:
  - 12-PROVAS.md com o "depois" colado sem edição (37c1cab, VPS, 2026-11-02), a tabela antes/depois/meta com a diferença em ms e em %, a comparação com a meta (D-08), o Pronto da 2.2 e os Seguimentos
  - a conclusão medida sobre a ida e volta a mais da trava (Pitfall 9): uma ida e volta, 51.1 a 51.4 ms por gravação
affects: [fechamento da Fase 12]

actuals:
  tokens: 14400
  tasks: 3
  commits: 2
plan_head_before: faa5be8b9ce2e5b9023c5d5272584fb8118a3fb6
plan_head_after: 836c7bea139aec7c1af8da6c2d907ae9568a917a

tech-stack:
  added: []
  patterns:
    - "O 'depois' é o mesmo comando do 'antes', sobre o código publicado, e a coluna Meta diz 'sem alvo numérico' porque a parada foi b-ganho-basta"
    - "Todo número da coluna Depois foi conferido por busca mecânica no texto colado; as diferenças foram calculadas por script e conferidas à mão"

key-files:
  created:
    - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-10-SUMMARY.md
  modified:
    - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-PROVAS.md

key-decisions:
  - "A coluna Meta repete 'sem alvo numérico' em toda linha: a meta da parada é b-ganho-basta, e nenhum número de meta foi inventado. A comparação é só contra o 'antes'."
  - "O D-03 do 'depois' e a conferência do dono na tela ficam registrados como NÃO OBSERVADOS e abertos: grep vazio, web nova fora do ar (PR #3 aberto) e nenhuma resposta do dono. O dono não disse 'seguir sem o passo 3'."
  - "A opção do Pitfall 9 (juntar begin e trava, ou tomar a trava no update) fica registrada para o dono decidir, sem implementar. Economiza cerca de 51.4 ms por gravação, a conta é sobre medianas impressas e não foi medida."

requirements-completed: [GRV-06]

coverage:
  - id: D1
    description: "O 'depois' foi medido com o mesmo comando do 'antes', a partir da VPS, sobre 37c1cab: os quatro gestos têm 10 amostras, regimes travado, tentativas 1 e gravou 10"
    requirement: GRV-06
    verification:
      - kind: other
        ref: "12-PROVAS.md § 'Depois — saída do comando' (saída colada pelo dono, conferida por grep/awk: revisão, 10 amostras, regimes, tentativas, desfechos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A tabela antes/depois/meta tem as duas colunas preenchidas para os quatro gestos e a coluna Meta; todo número do Depois aparece na saída colada"
    requirement: GRV-06
    verification:
      - kind: other
        ref: "12-PROVAS.md § 'Tabela antes/depois' (script: 0 números do Depois faltando no texto colado, 80 linhas por gesto, 3 de referência)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O 'depois' está comparado à meta de D-08, gesto por gesto; o pedidoMs subiu nos quatro e a ida e volta a mais da trava explica ~51 ms"
    requirement: GRV-06
    verification:
      - kind: other
        ref: "12-PROVAS.md § 'Comparação com a meta (D-08)'; unidade-de-trabalho.ts (SQL_DA_TRAVA e SQL_REVISAO_TRAVADO somam em travaMs)"
        status: pass
    human_judgment: true
    rationale: "O veredito 'não bateu' é sobre o pedido isolado; o ganho da fase está na tela e sob concorrência, que esta medição não capta. A leitura final é do dono."
  - id: D4
    description: "D-03 em produção (depois): uma linha 'gravacao medida' do serviço real com regime travado"
    requirement: GRV-06
    verification: []
    human_judgment: true
    rationale: "NÃO OBSERVADO. O grep voltou vazio, a web nova não está no ar (PR #3 aberto) e o dono não respondeu. O regime travado e tentativas 1 aparecem na medição contra o banco de produção, mas o caminho HTTP real não foi observado."
  - id: D5
    description: "Conferência do dono na tela de produção (Lista aparece na hora, sem link, vira link; clique cancelado; aviso ao fechar a aba)"
    requirement: GRV-06
    verification: []
    human_judgment: true
    rationale: "NÃO FEITA. Provado só por teste (12-06, 12-08, 12-09). Depende do merge do PR #3 e do dono."

duration: ~50min (continuação, depois do checkpoint)
completed: 2026-11-02
status: complete
---

# Phase 12 Plan 10: O "depois" medido na VPS e a 2.2 comparada ao "antes" Summary

**O mesmo `gravacao:medir` sobre `37c1cab` na VPS mostra os quatro gestos com `regimes: travado`, `tentativas` 1 e `gravou 10`, e o `pedidoMs` mediano SUBIU de 11,1% a 16,8% (+60.9 a +88.3 ms) contra o "antes": cerca de 51 ms disso é a ida e volta a mais da trava (`select … for update`), o resto é hidratar/gravar sobre uma base que cresceu 72 registros; o ganho da fase (a mudança na hora na tela, e uma tentativa em vez de até três sob concorrência) não aparece num pedido isolado.**

## Performance

- **Duration:** ~50 min nesta continuação (a Task 1 foi do agente anterior)
- **Completed:** 2026-11-02
- **Tasks:** 3 de 3 registradas; a Task 2 foi cumprida só em parte (ver Deviations)
- **Files modified:** 1 (`12-PROVAS.md`), mais este SUMMARY

## Accomplishments

- **Task 2 (fecho).** O "depois" entrou em `12-PROVAS.md` § "Depois — saída do comando", sem edição, com data, SHA e comando. Conferência do agente: a "revisão do código" é `37c1cab2e6f35b337c5d26318aae5432db5d620c` (igual ao que o `publicar.sh` imprimiu); os quatro gestos têm 10 amostras, `regimes: travado`, `tentativas` 1 (mediana e pior) e `desfechos: gravou 10`; a saída não tem nome de Tarefa, Contato, e-mail, URL, segredo nem nada do `api.env` (busca por `password`, `senha`, `@`, `postgres://`, `http(s)://`, `supabase`, `api.env`, `Bearer`, `eyJ` e `ZZ-` vazia).
- **Task 3.** A tabela antes/depois/meta (3 linhas de referência e 80 linhas por gesto) com a diferença em ms e em % por linha, `select 1`, `hidratar` direto e `GET /estado` nas duas rodadas, os SHAs das duas rodadas e a nota de que a base cresceu de 4601 para 4673 registros. Depois, "Comparação com a meta (D-08)", "Pronto da 2.2" e "Seguimentos".
- **A conclusão sobre a trava (Pitfall 9), medida.** No "antes" `travaMs` era igual a `atualizaMs` (só o `update`); no "depois" `travaMs − atualizaMs` é 51.6, 51.7, 51.3 e 51.5 ms, e o `select 1` da rodada é 51.4 ms: **a trava custou exatamente uma ida e volta a mais** por gravação. A confirmação no código: `SQL_DA_TRAVA` (`select … for update`) e `SQL_REVISAO_TRAVADO` (`update … returning revisao`) somam em `travaMs`; só o segundo soma também em `atualizaMs`.

## A tabela, resumida (mediana de 10 amostras, em ms; diferença = depois − antes)

| Gesto | `pedidoMs` antes → depois | Diferença | `travaMs` antes → depois | Diferença |
|---|---:|---:|---:|---:|
| createList | 551.0 → 611.9 | +60.9 (+11,1%) | 51.8 → 103.1 | +51.3 (+99,0%) |
| updateContainer | 531.9 → 612.1 | +80.2 (+15,1%) | 51.8 → 103.2 | +51.4 (+99,2%) |
| trashContainer | 526.1 → 614.4 | +88.3 (+16,8%) | 51.7 → 102.8 | +51.1 (+98,8%) |
| changeTaskStatus | 535.5 → 611.0 | +75.5 (+14,1%) | 51.7 → 103.0 | +51.3 (+99,2%) |

| Referência | Antes | Depois | Diferença |
|---|---:|---:|---:|
| `select 1` | 51.7 | 51.4 | −0.3 (−0,6%) |
| `hidratar` direto (registros lidos: 4601 → 4673) | 147.5 | 186.6 | +39.1 (+26,5%) |
| `GET /estado` | 370.6 | 337.6 | −33.0 (−8,9%) |

Meta: `b-ganho-basta`, sem alvo numérico (a sessão C não entra). O veredito contra o "antes", no pedido isolado: **não bateu** nos quatro (o `pedidoMs` subiu). O que a medição não capta, e que é o ganho da fase: a mudança na hora na tela (provada por teste, não medida em navegador) e uma tentativa em vez de até três sob concorrência (provado por `unidade-de-trabalho-concorrencia.test.ts` contra Postgres 16 local, 12-04). `hidratar` direto segue abaixo de 300 ms (186.6; folga 113.4 ms), a sessão C continua fora.

## A ida e volta a mais da trava, e a opção (sem implementar)

- Custo: uma ida e volta, 51.1 a 51.4 ms por gravação (`travaMs` +51.3, +51.4, +51.1, +51.3 ms).
- Opção do Pitfall 9 para o dono decidir: (b1) `begin; set local …; select revisao … for update` numa só consulta (exige escapar o `workspaceId`; `pg.escapeLiteral` está `[ASSUMED]` na RESEARCH), ou (b2) tomar a trava com o `update … returning revisao` no começo. Qualquer das duas economiza uma ida e volta, cerca de 51.4 ms (o `select 1` desta rodada). Conta sobre medianas impressas, **não medida**: `pedidoMs` iria a 560.5, 560.7, 563.0 e 559.6 ms, ainda 9.5, 28.8, 36.9 e 24.1 ms acima do "antes", porque o resto da subida (hidratar e gravar sobre uma base maior) não é da trava.
- No "antes", cada repetição por conflito refazia ao menos `inicioMs + hidratarMs + canaisMs + atualizaMs` (310.7, 304.2, 303.9 e 306.3 ms em medianas do "antes"); a trava troca essas repetições por uma espera. A medição de um pedido de cada vez nunca tem conflito, então não mostra o lado bom.

## Task Commits

1. **Task 1 (traçador)** — `b997d21` (docs): o ensaio local do "depois", `npm run check` verde, regime travado (agente anterior).
2. **Tasks 2 e 3** — `836c7be` (docs): o "depois" colado, D-03 e conferência do dono (não observados), a tabela, a comparação, o Pronto da 2.2 e os Seguimentos, em `12-PROVAS.md`.

**Plan metadata:** commit `docs(12-10)` que carrega este SUMMARY, STATE, ROADMAP e REQUIREMENTS.

Tracer feedback gate (Task 1): feito pelo agente anterior; `<verify>` automatizado (`npm run check` verde) e sem `gate="blocking-human"`; expansão liberada.

## Pendências que dependem do dono

1. **Merge do PR #3** (https://github.com/n1-tecnologia/crm/pull/3, aberto quando lido, `check` e `seguranca` em andamento) e o deploy da web. Ele traz a Fase 11 junto. Até lá a web de produção não tem o store novo, e a API (`37c1cab`) está à frente da `main`.
2. **A conferência visual em produção** (Lista aparece na hora, "salvando", vira link; clique cancelado; aviso ao fechar a aba): depois do merge, o dono responde o que viu.
3. **A linha de log com `"regime":"travado"`:** depois do deploy da web, criar uma Lista na tela, rodar o `journalctl … | grep "gravacao medida"` e colar UMA linha em `12-PROVAS.md` § "D-03 em produção (depois)". Hoje o D-03 do "depois" está **NÃO OBSERVADO**.
4. **A decisão sobre a opção do Pitfall 9** (juntar `begin` e trava): economiza cerca de 51.4 ms por gravação.
5. Os demais Seguimentos de `12-PROVAS.md` (o painel de aprovação, `iniciar-conversa-dialog.tsx`, os Espaços `ZZ-MEDICAO-*` na lixeira do `ws_n1`, a ligação da 2.2 em `TAREFAS-POR-SESSAO.md`).

## Deviations from Plan

### Cumprimento parcial do checkpoint

**1. [Desvio do plano] Task 2 cumprida só em parte**
- **Plano:** os quatro passos do dono (web publicada com `check` verde; API publicada pela `main`; Lista aparece na hora e uma linha de log com `regime` travado; a medição do "depois"). Critério de aceitação: "Passo 1: PR com `check` verde e web publicada. Passo 2: o `REVISION` é o SHA da `main`. Passo 3: 'Lista apareceu na hora' e a linha com `regime` 'travado'. Passo 4: a saída com os quatro gestos."
- **Feito:** passo 2 da API (publicada, sem migração) e passo 4 (o "depois" medido e colado inteiro).
- **Não feito:** (a) **web não publicada**: o PR #3 estava aberto e não mesclado (checks em andamento), sem link de deploy de produção da web; (b) **passo 3 não observado**: o `grep "gravacao medida"` voltou vazio e o dono não disse se fez o gesto nem o que viu, e não disse "seguir sem o passo 3"; (c) o `cat REVISION` não foi colado (a igualdade foi conferida entre o `publicar.sh` e a revisão impressa pelo comando).
- **API publicada pelo SHA do ramo, não da `main`:** `publicar.sh 37c1cab…` direto do ramo `fase-11`, como o "antes" (`5a74ee7`) também foi. O critério "o `REVISION` é o SHA da `main`" não se aplica: a `main` não tem esse commit.
- **Efeito:** a medição (GRV-06) está completa; a prova em produção de D-03 e a conferência visual ficaram pendentes (registradas como NÃO OBSERVADO / NÃO FEITA, nunca como cumpridas).

### Auto-fixed Issues

None - o resto do plano foi executado como escrito.

## Issues Encountered

- O `pedidoMs` do "depois" ficou acima do "antes" nos quatro gestos (ver acima). Não é falha de execução: é o resultado medido, registrado como veio.
- O 12-04 deixou como juízo humano (D4 do `coverage`) se "o regime travado não piora a gravação sem concorrência por causa da ida e volta a mais da trava". A medição responde: piora, em uma ida e volta (cerca de 51 ms).

## Known Stubs

None.

## Threat Flags

None. T-12-22 (código não conferido em produção): `npm run check` verde no Postgres local (Task 1), o dono publicou. T-12-23 (segredo ou dado de negócio colado no git): a saída colada só tem números e nomes técnicos; busca por padrões sensíveis vazia; nenhuma linha de log colada, nenhum `api.env`, nenhuma URL com senha.

## Next Phase Readiness

- Todos os planos da Fase 12 têm SUMMARY. O fecho da fase fica com o orquestrador (inclusive a linha do GRV-01 em `REQUIREMENTS.md`, que ainda diz "Pendente.").
- Abertos, de responsabilidade do dono: o merge do PR #3, a conferência visual em produção, a linha de log do D-03 e a decisão do Pitfall 9.

## Self-Check: PARTIAL (o que passou e o que ficou pendente)

**Passou** (comandos rodados antes de escrever esta linha):

- `[ -f ]` em `12-PROVAS.md`: FOUND. `grep -c` de "Comparação com a meta (D-08)" = 2, "Pronto da 2.2" = 1, "Depois — saída do comando" = 2 (todos diferentes de 0).
- `git merge-base --is-ancestor` para `b997d21` e `836c7be`: FOUND.
- `git rev-list --count faa5be8..HEAD` = 2 (medido imediatamente antes de escrever o SUMMARY; o commit `docs(12-10)` de metadados vem depois e não entra na conta, como nos planos anteriores).
- Busca mecânica: 0 números da coluna "Depois" faltando no texto colado.
- `git status --porcelain -- apps packages`: vazio (nenhum código mudou).

**Pendente, NÃO observado** (não é "PASSED"): o D-03 do "depois" (linha de log do serviço real), a conferência do dono na tela e a web nova em produção. Estão nos Seguimentos e em "Pendências que dependem do dono".
