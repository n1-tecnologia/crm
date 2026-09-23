---
phase: 03-contas-a-pagar
plan: 03
subsystem: domain
tags: [recorrencia, contas-a-pagar, a1, d3-05, d3-06, d3-07, vitest, prova-nao-construcao]

# Dependency graph
requires:
  - phase: 01-fundacao
    provides: "setRecurrence/nextOccurrenceRefusal/spawnNextOccurrence e o pipeline addMonths → shift → toBusinessDay em operations/collaboration.ts"
  - phase: 01-fundacao
    provides: "seed-financeiro.ts::recorrente() — a regra real do Financeiro (mensal, interval 1, aoConcluir, businessDays anterior)"
provides:
  - "recorrencia-contas-a-pagar.test.ts: 19 casos que travam por par de datas exato a saturação de fim de mês (D3-07), o deslocamento só por fim de semana (D3-06) e a ocorrência única por fechamento (D3-05/RN-CP-06)"
  - "guarda executável de D3-06: o teste lê packages/dominio/package.json e exige `dependencies` exatamente [\"zod\"]"
  - "a cadeia de recorrência provada por proveniência: a terceira ocorrência aponta para a segunda, não para a origem"
  - "JSDoc de addMonths/toBusinessDay e seção de packages/dominio/CONTEXT.md que dizem, onde o código mora, que estas regras são decisão com dono e com teste"
affects: [03-05 importação de Contas a pagar, 03-09/03-10 histórico do ClickUp, Phase 5 contas a receber]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "prova de regra de data por par exato (entrada → saída) em vez de predicado fraco (`dow !== 0 && dow !== 6`)"
    - "cadeia realimentada: o teste regrava o vencimento a cada passo, que é como a série anda de verdade"
    - "proibição de dependência virando asserção: o teste lê o package.json da própria camada"

key-files:
  created:
    - packages/dominio/src/operations/recorrencia-contas-a-pagar.test.ts
  modified:
    - packages/dominio/src/operations/collaboration.ts
    - packages/dominio/CONTEXT.md

key-decisions:
  - "O arquivo prova o cálculo por `nextOccurrenceRefusal` (a mesma expressão que `spawnNextOccurrence` grava em `dueDate`) e só encena o fechamento real no bloco de D3-05 — isolar o cálculo do roteiro de Status evita que uma regressão de permissão se disfarce de regressão de data"
  - "Nos casos de D3-07 puro a regra do seed é trocada por uma sem `businessDays`: a saturação precisa ser vista sozinha antes de ser vista composta com o recuo de fim de semana"
  - "A saturação absorvente foi PINADA, não corrigida: o caso `a saturação é absorvente` assere a sequência 31 → 28 → 28 → 28 de propósito. Corrigir exigiria guardar o dia âncora da série, que é código novo e está fora deste plano"
  - "Nenhum comentário do arquivo afirma que 2025-02-17 foi Carnaval — a evidência citada em 03-RESEARCH.md está mal atribuída (ver Observações), e a data usada nos casos de feriado é 2026-02-17, terça de Carnaval de verdade"
  - "`operations.test.ts` não foi tocado: o caso simples de RN-CP-06 continua onde estava, e este arquivo o cita em comentário em vez de duplicá-lo"

patterns-established:
  - "Arquivo de teste dedicado a UMA decisão travada, fora do arquivo-retrato do processo: o título do caso nomeia a decisão que foi violada quando ele fica vermelho"
  - "Comentário de código citando o identificador da decisão (D3-06/D3-07) e o arquivo de teste que a prova — a decisão passa a ter dono legível de dentro do editor"

requirements-completed: [PAG-02]

# Metrics
duration: 20min
completed: 2026-09-23
---

# Phase 3 Plan 03: Travar a regra de vencimento de A1 por teste — Summary

As três regras de Recorrência que o usuário travou em D3-05, D3-06 e D3-07 deixaram de ser implementação não confirmada: cada uma tem agora um par de datas exato que a nomeia, e nenhuma linha de lógica nova entrou no domínio para consegui-lo.

## O que mudou

Antes deste plano, a única prova que tocava o vencimento da próxima ocorrência era `operations.test.ts` ("seção 7 + A1/A9"), e ela verificava que a data "não caiu em sábado nem domingo". Isso aceita, sem reclamar, qualquer data de segunda a sexta — inclusive as duas saídas que D3-07 recusa por escrito (`2026-03-01` e `2026-03-03` para uma conta de 31/01). As três regras estavam certas no código e sem rede de segurança.

`packages/dominio/src/operations/recorrencia-contas-a-pagar.test.ts` (284 linhas, 19 casos, 4 `describe`) fecha esse vão:

- **D3-07 — saturação (6 casos).** `2026-01-31 → 2026-02-28` com as asserções negativas explícitas contra `2026-03-01` e `2026-03-03`; `2028-01-31 → 2028-02-29` (bissexto); `2026-03-31 → 2026-04-30`; e a composição das duas regras na ordem certa — `2026-01-31` com `businessDays: "anterior"` dá `2026-02-27`, porque satura primeiro em 28/02 (sábado) e só depois recua. Mais os dois casos de cadeia: `2026-01-31 → 2026-02-28 → 2026-03-28 → 2026-04-28` sem `businessDays`, e `2026-01-31 → 2026-02-27 → 2026-03-27 → 2026-04-27 → 2026-05-27 → 2026-06-26` com a regra real do Financeiro.
- **D3-06 — feriado é dia útil comum (5 casos).** Segunda e terça de Carnaval de 2026 (`2026-02-16`, `2026-02-17`) e Natal numa sexta (`2026-12-25`) vencem no dia. O caso que separa as duas causas: `2026-10-15 → 2026-11-15` cai num domingo (Proclamação da República de 2026) e recua **dois** dias, para sexta 13 — o tamanho do passo é a regra de domingo, não a véspera de um feriado.
- **D3-06 — fim de semana nos dois sentidos (5 casos).** `"anterior"` recuando um dia de sábado (`2026-03-06`) e dois de domingo (`2026-11-13`), `"posterior"` avançando dois (`2026-03-09`), e uma quinta-feira que não se move (`2026-03-05`). Fecha com o guarda executável de "nenhuma dependência de datas nova": o teste lê `packages/dominio/package.json` e exige `Object.keys(dependencies)` igual a `["zod"]`.
- **D3-05/RN-CP-06 — o fechamento real (3 casos).** (a) a regra migra para a ocorrência nova e é apagada da concluída, com `provenance.sourceId` na origem e `dueDate` em `2026-02-27` — a data, não um predicado; (b) reabrir para `lançado omie` e pagar de novo não duplica nem a Tarefa da Lista **nem o Registro `"Próxima ocorrência criada"`, que é a barreira que o teste antigo não tem**; (c) a terceira ocorrência aponta para a segunda, nunca de volta para a origem, e vence em `2026-03-27`.

`collaboration.ts` mudou só em comentário — verificado por diff sem linhas de comentário, que sai limpo. O JSDoc de `addMonths` cita D3-07 e enuncia a saturação absorvente; o de `toBusinessDay` trocou "feriados ficam fora deste protótipo" (uma frase que convida quem lê a "consertar" o que o usuário decidiu) por uma que diz que feriado é dia útil comum **por decisão**, que nenhuma tabela de feriados entra nesta camada, e que a correção, se um dia for necessária, é tabela estática em dado — não algoritmo de feriado móvel aqui dentro. Os dois apontam para o arquivo de teste.

`packages/dominio/CONTEXT.md` ganhou a seção `## Recorrência de Contas a pagar: o que está travado (D3-05/D3-06/D3-07)`: a regra é por Tarefa, o vencimento satura e a série não volta ao dia original, feriado não desloca, a ocorrência nasce uma vez por fechamento — e quem mudar qualquer uma das quatro quebra o arquivo de teste nomeado ali.

## Tasks e commits

| Task | O que entregou | Commit |
|---|---|---|
| 1 | Arquivo novo com os três `describe` de cálculo (16 casos) | `ecfae2a` |
| 2 | `describe` de D3-05/RN-CP-06 pelo fechamento real (3 casos) | `ab6b785` |
| 3 | JSDoc de `addMonths`/`toBusinessDay` + seção de `CONTEXT.md` | `96a3a9c` |

## Verificação

- `npm run test --workspace=@n1/dominio -- recorrencia-contas-a-pagar` — 19 passados, 4 `describe` verdes.
- `npm run check` equivalente, rodado por workspace em chamadas separadas (o gate completo estoura o limite de 600s por causa da suíte remota do `apps/api`): `typecheck` nos três workspaces, `lint` e `verificar:tokens` (392 tokens, 0 falhas) no web, e as três suítes — **dominio 393** (374 antes + 19), **web 107**, **api 380 passados + 12 pulados**. Tudo verde.
- CON-05 preservado: `git diff --quiet packages/dominio/src/operations/operations.test.ts` sai 0 — nenhuma expectativa existente foi reescrita. `npm run test --workspace=@n1/dominio -- -t "RN-CP-06"` continua verde com o caso antigo intacto.
- `git diff --quiet packages/dominio/package.json` sai 0 — nenhum pacote instalado, nenhum `npm install` executado (T-3-SC).
- Diff de `collaboration.ts` exclusivamente de comentário: `git show <base>:…/collaboration.ts | grep -vE '^\s*(\*|/\*|//)'` contra a mesma filtragem do arquivo atual sai 0.
- `git diff --stat <base> -- apps` vazio — este plano é domínio puro; `apps/api` e `apps/web` sem diff na rodada.
- `git diff --stat <base> -- packages/dominio/src` lista exatamente dois arquivos: `collaboration.ts` e `recorrencia-contas-a-pagar.test.ts`.

## Observações para o usuário

Dois achados de pesquisa. **Nenhum dos dois reabre decisão** — os dois estão registrados aqui porque a decisão de agir sobre eles é sua, não deste plano.

**1. A evidência citada em D3-06 está mal atribuída; a decisão continua válida.** `03-RESEARCH.md` e `03-CONTEXT.md` justificam "ignorar feriado" com "4 Tarefas vencendo em 2025-02-17, segunda-feira de Carnaval, sem deslocamento". Verificado contra o export real (`apps/api/exportacoes/clickup/901107637383/`, 2.861 Tarefas, 2.830 com vencimento, janela 2025-01-17 → 2026-10-15): **2025-02-17 é uma segunda-feira comum** — o Carnaval de 2025 foi 3 e 4 de março, porque a Páscoa caiu em 20/04 — e tem **11** Tarefas, não 4. E **nenhuma** das 2.830 Tarefas com vencimento cai em feriado nacional dentro da janela, nem em 2025 nem em 2026. O export, portanto, não prova nem desmente nada sobre feriado: ele mostra que o caso nunca aconteceu. D3-06 vale como decisão sua, não como conclusão do dado. O teste reflete isso: os casos de feriado usam **2026-02-17, terça-feira de Carnaval de verdade**, que é literalmente a consequência que o texto de D3-06 aceita por escrito, e nenhum comentário do arquivo afirma que 2025-02-17 foi Carnaval.

**2. A saturação é absorvente — a série de dia 31 não volta ao dia 31.** D3-07 trava "31/01 vira 28/02", e isso está certo. A consequência que nenhum documento enuncia é que a próxima ocorrência é calculada a partir do vencimento da ocorrência **anterior**, que já saturou: `2026-01-31 → 2026-02-28 → 2026-03-28 → 2026-04-28`. Com `businessDays: "anterior"`, que é a regra real do seed (`seed-financeiro.ts::recorrente()`), o recuo acumula: `2026-01-31 → 2026-02-27 → 2026-03-27 → 2026-04-27 → 2026-05-27 → 2026-06-26`. Uma conta "todo dia 31" vira conta do dia 26 em cinco meses. Isso **não** reabre D3-07 (a saturação de um passo é exatamente o que você travou) e não gerou código novo aqui: o teste pina o comportamento num caso com esse nome, e o JSDoc e o `CONTEXT.md` o enunciam em uma linha. Corrigir exigiria guardar o dia âncora da série — código novo, fora deste plano. Decidir corrigir ou aceitar é seu; não bloqueia a Wave 1.

## Deviations from Plan

None - plan executed exactly as written.

O plano previa `npm run check` como verificação da Task 3. O gate foi executado integralmente, mas **decomposto por workspace em chamadas separadas** (typecheck, lint, tokens, e as três suítes), porque o `npm run check` monolítico leva ~10 minutos por causa da suíte do `apps/api` contra o Supabase remoto e estoura o limite de 600s por chamada de ferramenta. A cobertura é a mesma do script composto; nenhum passo foi pulado.

## Threat Flags

Nenhuma superfície nova. O plano é domínio puro: sem I/O, sem env, sem rota, sem pacote. As três ameaças do registro do plano foram mitigadas como previsto — T-3-07 (pares exatos, incluindo as negativas `2026-03-01`/`2026-03-03`), T-3-08 (`dependencies` do `package.json` asserido como `["zod"]`) e T-3-09 (contagem de Registros `"Próxima ocorrência criada"`, não só de Tarefas). T-3-SC permanece `accept` e vacuamente satisfeita: nenhum `npm install` foi executado.

## Self-Check: PASSED

- `packages/dominio/src/operations/recorrencia-contas-a-pagar.test.ts` — FOUND (284 linhas)
- `packages/dominio/src/operations/collaboration.ts` — FOUND, contém `D3-06`, `D3-07` e `recorrencia-contas-a-pagar.test`
- `packages/dominio/CONTEXT.md` — FOUND, contém `Recorrência de Contas a pagar` e `D3-06`
- commit `ecfae2a` — FOUND
- commit `ab6b785` — FOUND
- commit `96a3a9c` — FOUND
