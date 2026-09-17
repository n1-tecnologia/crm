---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
verified: 2026-09-17T15:40:00Z
status: human_needed
score: 5/5 critérios de sucesso do ROADMAP verificados por evidência de código (CR-02 fechado por inteiro); Critério 1 segue pendente de verificação humana em navegador (não é gap de código)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "4/5 critérios (1 parcial); gap CR-02 (Critério 2/PERS-04) parcialmente aberto"
  gaps_closed:
    - "efeito 2 de CR-02: ~109 operações fora de ESQUEMAS aceitavam jsonb malformado via ARGUMENTOS_GENERICOS (kind/anchor/filters arbitrários) — fechado: ESQUEMAS agora cobre as 132 operações sob satisfies EsquemasCompletos, sem fallback estrutural"
    - "reviverArgumentos (WR-10) sem limite de profundidade, RangeError subindo como 500 — fechado no Plan 01-12, reconfirmado nesta rodada: try/catch em operacoes.ts, caso (s) com n=10000 → 400"
    - "TypeError → 400 (WR-11) aplicado indiscriminadamente, escondendo bug atrás de 400 — removido por inteiro: um TypeError dentro de operacao(...) agora sobe como 500 (bug), nunca mascarado"
    - "createGoal com kind:42/anchor.lixo e saveView com filters arbitrário, as duas formas literais que o verificador anterior reproduziu contra ARGUMENTOS_GENERICOS — reproduzidas por mim de forma independente contra o código atual: ambas agora 400 (unrecognized_keys / invalid_value), nada persistido"
  gaps_remaining: []
  regressions: []
---

# Fase 1: O CRM N1 ganha persistência e login — Relatório de Verificação (re-verificação após a segunda rodada de fechamento de CR-02)

**Meta da fase:** O CRM N1 deixa de ser protótipo — um Membro real entra com e-mail e senha, cria uma Conta pela tela e ela está no Postgres da plataforma; toda operação do domínio chega ao backend por HTTP e roda na Unidade de Trabalho, sem que o domínio ou os 214 testes mudem.
**Verificado em:** 2026-09-17T15:40:00Z
**Status:** human_needed
**Re-verificação:** Sim — depois dos Plans 01-12..01-16 (segunda rodada de fechamento de CR-02, commits `c6f0d1c..6d3103d`); linha de base em `.planning/phases/01-o-crm-n1-ganha-persist-ncia-e-login/01-VERIFICATION.md` de 2026-09-16T20:16Z (gap único: CR-02 parcialmente aberto)

## Metodologia

Re-verificação goal-backward, focada no único gap da rodada anterior (CR-02, Critério 2 do ROADMAP, PERS-04). Nenhuma alegação de SUMMARY.md, `01-REVIEW.md` ou `STATE.md` foi aceita sem evidência própria.

Evidência coletada por: leitura linha a linha de `apps/api/src/rotas/operacoes.ts` (estado atual — o handler completo, do `reviverArgumentos` protegido até o despacho por `esquemaDeArgumentos(nome).safeParse`, sem `instanceof TypeError`), de `apps/api/src/rotas/esquemas-de-argumentos.ts` (composição `satisfies EsquemasCompletos`, sem `ARGUMENTOS_GENERICOS`), de `apps/api/src/rotas/esquemas/CONTEXT.md` e de `packages/dominio/src/operations/collaboration.ts` (a função `shift()`, para o julgamento de WR-12); leitura de `01-12-PLAN.md`/`SUMMARY.md` até `01-16-PLAN.md`/`SUMMARY.md`, de `01-REVIEW.md` (rodada 2, `2026-09-17T14:03:22Z`) e de `01-11-SUMMARY.md`/`01-10-SUMMARY.md` para contexto da rodada anterior; execução de `npm run check` na raiz (**469 testes verdes: dominio 253, api 163, web 53** — batendo com o que `01-16-SUMMARY.md` e `STATE.md` alegam); execução isolada de `vitest run` em `apps/api` para `operacoes.test.ts` + `esquemas-de-argumentos.test.ts` (**33/33 verdes**, casos (a)–(v) e (a)–(k) listados nominalmente por grep, não por contagem cega); `git diff --stat c6f0d1c^..HEAD` (confirma que o delta desta rodada é só `apps/api/src/rotas/` + documentação — nada em `packages/dominio`, `apps/web` ou `apps/api/src/app.ts`); `git diff --quiet d713253 -- packages/dominio/src/operations/operations.test.ts packages/dominio/src/seed-produto.test.ts packages/dominio/src/contas-a-receber.test.ts` (saída vazia, confirmado).

**Quatro reproduções próprias, independentes do relato de `01-REVIEW.md`/SUMMARYs**, rodadas com `vite-node` contra o código real do repositório (script descartado ao final, nenhum arquivo de produção tocado):

1. `ESQUEMAS.createGoal.safeParse([{ name: "Meta", anchor: { type: "list", id: "lst_ativacao", lixo: { a: [1,2] } }, kind: 42, target: 10 }])` — a forma EXATA que o verificador anterior reproduziu contra `ARGUMENTOS_GENERICOS` (onde dava `success: true`).
2. `ESQUEMAS.saveView.safeParse([{ listId: "lst_x", name: "V", kind: "lista", filters: { qualquer: { coisa: true } }, shared: false }])`.
3. `reviverArgumentos(JSON.parse(...))` com 200.000 níveis de aninhamento (a mesma reprodução WR-10 da rodada anterior).
4. `ESQUEMAS.createChatFolder.safeParse([{ name: 123 }])` e `ESQUEMAS.updateTask.safeParse(["tsk_x", { title: 123 }])` — as duas formas hostis citadas no prompt desta re-verificação.

Adicionalmente, reproduzi por conta própria o achado WR-12 do `01-REVIEW.md` (não aceito por relato): `ESQUEMAS.updateTask.safeParse(["tsk_x", { dueDate: { form: "instant", value: "garbage" } }])` e `ESQUEMAS.setRecurrence.safeParse(["tsk_x", { frequency: "diaria", interval: 1e15, triggerMode: "aoConcluir", copies: {...} }])`, e confirmei em Node puro que `new Date("garbage")` seguido de `.setDate()` e `.toISOString()` lança `RangeError: Invalid time value` (o mesmo mecanismo que `shift()` em `packages/dominio/src/operations/collaboration.ts:339-347` usa) — ver "Julgamento sobre WR-12" abaixo.

Nenhum servidor HTTP foi iniciado por mim; as reproduções chamaram os módulos TypeScript diretamente via `vite-node`, e o `npm run check` completo (que inclui os testes de rota via `app.inject`) foi rodado uma única vez.

## Goal Achievement

### Critérios de Sucesso do ROADMAP

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | Membro real entra em `/entrar`, é resolvido pelo Usuário, cria uma Conta pela tela, e ela persiste no Postgres após recarregar | ⚠️ VERIFICADO PARCIALMENTE (metade automatizada, metade precisa de navegador) — inalterado desde a rodada anterior | Nenhum arquivo desta parte mudou nos Plans 01-12..01-16 (`git diff --stat c6f0d1c^..HEAD` só toca `apps/api/src/rotas/` + docs). O e2e `apps/api/src/e2e/criar-conta.test.ts` continua verde (incluído no `npm run check` desta rodada). A parte "pela tela, no navegador real" continua em Human Verification, sem alteração. |
| 2 | Toda operação dos 16 módulos chega por `POST /operacoes/:nome` e roda na UoW com o Membro da sessão; API pública do store não muda | ✓ VERIFICADO — CR-02 fechado por inteiro | `apps/api/src/rotas/esquemas-de-argumentos.ts`: `export const ESQUEMAS = { ...TAREFAS, ...AUTOMACOES, ...FINANCEIRO, ...NEGOCIOS, ...CONVERSAS, ...CONTATOS, ...IA, ...PASTAS_DE_CHAT, ...CONSTRUTOR_DE_AGENTES, ...CONFIGURACAO, ...COLABORACAO, ...PLANEJAMENTO, ...ESCALA, ...MEMBROS, ...ESTRUTURA } satisfies EsquemasCompletos` (confirmado por leitura própria e por `grep -c "satisfies EsquemasCompletos"` → 1). Reproduzi `Object.keys(ESQUEMAS).sort()` === `Object.keys(OPERACOES).sort()`, **132 === 132**. `grep -rc "ARGUMENTOS_GENERICOS" apps/api/src` → vazio (símbolo não existe mais em lugar nenhum). `apps/api/src/rotas/operacoes.ts`: `grep -c "instanceof TypeError"` → 0; `grep -c "instanceof RangeError"` → 1. Li o handler inteiro: `esquemaDeArgumentos(nome).safeParse(revividos)` roda ANTES de `executar()`/`REGISTRO[nome]!(...)`, para as 132 operações, sem exceção. |
| 3 | Espaço "Gestão" › Financeiro › Listas "Contas a pagar"/"Contas a receber" no banco, com Status/Campos/Tags/Papéis dos SPECs, sem Tarefas fictícias; Lista de Contas a pagar filtra por status, vencimento, Tag `conta *`, Responsável e Pessoa com coluna gerada e índice | ✓ VERIFICADO (inalterado, sem regressão) | Nenhum arquivo desta parte tocado pelos Plans 01-12..01-16 (confirmado por `git diff --stat`). `npm run check` desta rodada roda `bootstrap-gestao.test.ts`/`colunas-geradas.test.ts` dentro dos 163 testes verdes de `apps/api` — sem regressão. |
| 4 | `npm run check` verde nos 3 workspaces; 214 testes do domínio inalterados; hidratado ≡ seed vale contra o Supabase; ClickUp e `automation/` intocados | ✓ VERIFICADO | `npm run check` rodado por mim nesta rodada: **469 testes verdes** (253 domínio + 163 api + 53 web) — batem exatamente com `01-16-SUMMARY.md`/`STATE.md`. `git diff --quiet d713253 -- packages/dominio/src/operations/operations.test.ts packages/dominio/src/seed-produto.test.ts packages/dominio/src/contas-a-receber.test.ts` → exit 0, confirmado por mim. `git diff --quiet -- packages/dominio apps/web apps/api/src/app.ts` restrito a `c6f0d1c^..HEAD` → exit 0 (nenhum arquivo dessas três áreas tocado nesta rodada). `ClickUp`/`automation/` continuam fora deste repositório. |
| 5 | Reconvidar um Usuário removido reativa o mesmo Membro (RN-ET-11), sem criar um segundo | ✓ VERIFICADO (inalterado desde a rodada anterior) | `packages/dominio/src/operations/members.ts` sem diff nesta rodada (só tocado pelo Plan 01-10, já verificado). Continua fora do escopo dos Plans 01-12..01-16, que só tocaram `apps/api/src/rotas/`. |

**Placar:** 5/5 critérios com evidência de código sem ressalva (2, 3, 4, 5 continuam integralmente verificados; o Critério 2/CR-02 agora fecha por inteiro — era o único parcial da rodada anterior). O Critério 1 permanece parcialmente verificado pela MESMA razão de sempre: a parte "pela tela, num navegador real" não é verificável por `app.inject()`/grep — está em Human Verification, não é um gap desta rodada nem de nenhuma anterior.

### Julgamento sobre WR-12 (achado novo do `01-REVIEW.md`, rodada 2 — 2026-09-17T14:03:22Z)

O `01-REVIEW.md` desta rodada (não a rodada que o prompt me pediu para re-verificar contra a rodada anterior, mas a revisão de código que acompanhou os Plans 01-12..01-16) registra um achado novo, WR-12: dois campos cuja **forma** o schema aceita corretamente (`TaskDate.value` é `z.string()`, espelhando o tipo `Instant = string` do domínio; `RecurrenceRule.interval` é `z.number()`), mas cujo **valor** o domínio não valida nos pontos de escrita — `updateTask` grava `dueDate.value: "garbage"` sem checar se é uma data parseável; `setRecurrence` aceita `interval: 1e15` sem teto. Reproduzi os dois de forma independente contra o código atual:

```
ESQUEMAS.updateTask.safeParse(["tsk_x", { dueDate: { form: "instant", value: "garbage" } }])
  → { success: true }
ESQUEMAS.setRecurrence.safeParse(["tsk_x", { frequency: "diaria", interval: 1e15, triggerMode: "aoConcluir", copies: {...} }])
  → { success: true }
```

E confirmei em Node puro (sem depender do relato) que o mecanismo que o `01-REVIEW.md` aponta como consequência é real: `new Date("garbage")` produz `Invalid Date`; chamar `.setDate(...)` nela e depois `.toISOString()` lança `RangeError: Invalid time value` — exatamente o padrão de `shift()` em `packages/dominio/src/operations/collaboration.ts:339-347` (`const d = new Date(date.value); switch (rule.frequency) { case "diaria": d.setDate(d.getDate() + rule.interval); ... } return { form: "instant", value: d.toISOString() };`), chamada por `nextOccurrenceRefusal` (linha 421), chamada por `changeTaskStatus` (`tasks.ts:240`) quando a Tarefa tem recorrência. Ou seja: um `POST /operacoes/updateTask` com `dueDate.value` malformado responde 200 e persiste o valor; uma chamada POSTERIOR e SEPARADA a `changeTaskStatus` na mesma Tarefa (por qualquer Membro) lançaria `RangeError` não capturado, que sobe ao `setErrorHandler` como 500 — desde que a rodada removeu o mapeamento `TypeError → 400` (WR-11), nada na rota intercepta um `RangeError` que não seja o do `reviverArgumentos` (esse `catch` é específico e só envolve o revive, não o corpo de `executar()`).

**Meu julgamento:** este é um achado real, reproduzido por mim de forma independente (não aceito por relato), mas ele cai FORA do que os Plans 01-12..01-16 foram encarregados de fechar, por três razões, na mesma estrutura de julgamento que a rodada anterior aplicou a WR-09:

1. **O contrato que a própria pasta declara exclui exatamente esta classe de validação.** `apps/api/src/rotas/esquemas/CONTEXT.md` (escrito por estes mesmos planos, linhas 5-9): "Validação de TRANSPORTE, nunca regra de negócio: uma regra ('título não pode ficar vazio', **'e-mail precisa ser válido'**, **limites numéricos**) continua exclusivamente no domínio." O projeto classifica validade semântica de um valor (um e-mail bem formado, um número dentro de uma faixa) como "regra", não "forma" — e uma data-string parseável e um `interval` limitado são exatamente dessa classe (o próprio `01-REVIEW.md`, seção WR-12, "Correção", propõe a correção em DUAS camadas, e marca a camada de domínio como "fora deste delta — abrir plano").
2. **A correção correta e completa exige tocar `packages/dominio`**, o que o objetivo da fase proíbe explicitamente ("sem que o domínio... mude"; "os 214 testes do domínio são os mesmos"). Uma correção só de transporte (`z.iso.datetime()` em vez de `z.string()`, um `.max()` em `interval`) fecharia a FORMA de entrada mas deixaria o domínio sem a mesma garantia se chamado por outro caminho — o texto do `CONTEXT.md` da raiz ("as mesmas regras precisam valer nos dois lados") argumenta contra uma correção só do lado do transporte para o que o próprio projeto chama de regra.
3. **O gap que esta rodada foi encarregada de fechar (CR-02, `01-VERIFICATION.md` de 2026-09-16T20:16Z) tinha um `missing[]` literal e específico**, e os quatro itens desse `missing[]` estão fechados e confirmados por mim: (a) `ESQUEMAS ≡ OPERACOES` (132/132, confirmado); (b) teste provando `createGoal`/forma hostil → 400 sem persistir (confirmado, casos (t)/(u)/(v)); (c) `reviverArgumentos` protegido (confirmado, `instanceof RangeError`); (d) teste do aninhamento profundo (confirmado, caso (s)). WR-12 não estava nesse `missing[]` — é um achado novo que só emergiu DEPOIS que a cobertura de forma ficou completa, exigindo um nível de rigor mais profundo (validação de valor, não de forma) que os planos declaradamente não tentaram e que a arquitetura desta pasta declara fora do seu escopo.

Por isso trato WR-12 como um achado de robustez válido para acompanhamento (ver Anti-Patterns, abaixo) — não como reabertura do Critério 2/CR-02. Meu julgamento é o mesmo padrão que a rodada anterior aplicou a WR-09: real, reproduzido, documentado, mas fora do texto literal do gap que esta rodada fechou. Blast radius: uma Tarefa por vez (recuperável com outro `updateTask` de data válida), exige DUAS chamadas HTTP distintas (a corruptora e a que dispara o 500), e o `01-REVIEW.md` já classifica como "aviso", não "crítico". Recomendo abrir um plano de robustez no domínio antes de a Fase 2 expandir o uso de recorrência de Tarefas.

WR-13 (portão `Igual<>` não cobre todos os enums de uniões nomeadas — `whenStillOpen`, `businessDays`, `sortBy`, `measure.target`, `FormQuestion.target.kind`, `CONTAINER_TYPE` contra um literal) e WR-14 (`tarefas.ts`/`automacoes.ts`/`financeiro.ts`, 23 operações, sem `<modulo>.test.ts` próprio) são achados de COBERTURA DE REDE (nenhum bug ativo hoje — o `01-REVIEW.md` prova isso e eu confirmei contando os arquivos: `ls apps/api/src/rotas/esquemas/*.test.ts` tem 12 arquivos para 15 módulos, faltando exatamente `tarefas`, `automacoes`, `financeiro`, batendo com WR-14). Não bloqueiam o Critério 2 (nenhuma chamada legítima falha, nenhuma chamada hostil hoje conhecida passa) — ficam como Warning/Info para acompanhamento.

### Artefatos Obrigatórios (regressão + novos desta rodada)

| Artefato | Plano | Status | Detalhe |
|---|---|---|---|
| `apps/api/src/rotas/esquemas/fragmentos.ts` | 12 | ✓ VERIFICADO — tipos `ArgumentosDe`, `Esquemas`, `EsquemasCompletos`, `Igual`, `Confere`, `opcional()`, 9 fragmentos | 95 linhas (`git diff --stat`) |
| `apps/api/src/rotas/esquemas/{tarefas,automacoes,financeiro,negocios,conversas,contatos,ia,pastas-de-chat,construtor-de-agentes,configuracao,colaboracao,planejamento,escala,membros,estrutura}.ts` | 12-15 | ✓ VERIFICADO — 15 arquivos, um por módulo do domínio, todos `satisfies Esquemas`; confirmado por `ls` (16 `.ts` não-teste = 15 módulos + `fragmentos.ts`) | — |
| `apps/api/src/rotas/esquemas/*.test.ts` (12 de 15) | 13-15 | ⚠️ PARCIAL — faltam `tarefas.test.ts`, `automacoes.test.ts`, `financeiro.test.ts` (WR-14, achado de cobertura, não de bug) | Confirmado por `ls`: 12 arquivos `.test.ts` presentes |
| `apps/api/src/rotas/esquemas-de-argumentos.ts` | 12, 16 | ✓ VERIFICADO — `ESQUEMAS` = spread dos 15 módulos `satisfies EsquemasCompletos`; `ARGUMENTOS_GENERICOS`/`valorJson`/`PROFUNDIDADE_MAXIMA` removidos (`grep` → 0 ocorrências) | 226 linhas alteradas (`git diff --stat`) |
| `apps/api/src/rotas/esquemas-de-argumentos.test.ts` | 16 | ✓ VERIFICADO — 11 casos (a)-(k), (h)/(i)/(j) reapontados, (k) novo; rodado por mim, 11/11 verdes (dentro dos 33 combinados com `operacoes.test.ts`) | — |
| `apps/api/src/rotas/operacoes.ts` | 12, 16 | ✓ VERIFICADO — `try/catch` só em volta de `reviverArgumentos` (`instanceof RangeError`); sem `instanceof TypeError`; despacho por `esquemaDeArgumentos(nome).safeParse` para as 132 | Lido por inteiro, linhas 100-190 reproduzidas acima |
| `apps/api/src/rotas/operacoes.test.ts` | 12, 16 | ✓ VERIFICADO — 22 casos (a)-(v); (q) reapontado, (s)/(t)/(u)/(v) novos, todos confirmados por `grep -n` e por execução isolada | 22/22 dentro dos 33 testes verdes rodados por mim |
| `apps/api/src/rotas/CONTEXT.md`, `apps/api/src/rotas/esquemas/CONTEXT.md` | 12, 16 | ✓ VERIFICADO — lista os 15 arquivos como presentes, sem "a chegar"; regra 7 (`EsquemasCompletos`) presente | Lido por inteiro |
| Os demais artefatos das rodadas 01-01..01-11 | — | ✓ VERIFICADO (regressão) — `git diff --stat c6f0d1c^..HEAD` confirma que só `apps/api/src/rotas/` e documentação mudaram nesta rodada; `npm run check` verde confirma ausência de regressão funcional | — |

### Verificação de Key Links (Wiring) — foco na rodada

| De | Para | Via | Status |
|---|---|---|---|
| `apps/api/src/rotas/esquemas-de-argumentos.ts` | `apps/api/src/rotas/esquemas/*.ts` | spread dos 15 objetos por módulo; `satisfies EsquemasCompletos` (sem `?`) | ✓ WIRED — confirmado por leitura e por `Object.keys(ESQUEMAS).sort() === Object.keys(OPERACOES).sort()` (132/132) reproduzido por mim |
| `apps/api/src/rotas/operacoes.ts` | `apps/api/src/rotas/esquemas-de-argumentos.ts` | `esquemaDeArgumentos(nome).safeParse(revividos)` antes de `executar()`/`SERVICOS[nome]` | ✓ WIRED — lido por inteiro; nenhuma operação despacha sem passar pelo `safeParse` |
| `apps/api/src/rotas/operacoes.ts` | `packages/dominio/src/operations/registro.ts` | `try { revividos = reviverArgumentos(...) } catch (RangeError) → 400` | ✓ WIRED — reproduzido por mim (`RangeError` lançado com n=200000; capturado no código lido) |
| `apps/api/src/rotas/operacoes.ts` | `apps/api/src/app.ts` (`setErrorHandler`) | `TypeError`/qualquer exceção dentro de `operacao(...)` sobe SEM mapeamento — 500 | ✓ WIRED — confirmado por leitura (`grep -c "instanceof TypeError"` → 0); é o destino correto documentado como intencional (WR-11) |

### Reprodução Independente (não aceita por relato)

| Achado | Comando/Script | Resultado | Confirma |
|---|---|---|---|
| `createGoal` com `kind:42`/`anchor.lixo` — a forma hostil do gap anterior | `ESQUEMAS.createGoal.safeParse([...])` via `vite-node` | `success: false`; `unrecognized_keys` em `anchor.lixo`, `invalid_value` em `kind` | CR-02 fechado para este vetor |
| `saveView` com `filters` arbitrário | `ESQUEMAS.saveView.safeParse([...])` via `vite-node` | `success: false`; `unrecognized_keys` em `filters.qualquer` | CR-02 fechado para este vetor |
| `createChatFolder` com `name: 123` | `ESQUEMAS.createChatFolder.safeParse([{ name: 123 }])` | `success: false`; `invalid_type` em `0.name` | Confirma (q) reapontado |
| `updateTask` com `title: 123` | `ESQUEMAS.updateTask.safeParse(["tsk_x", { title: 123 }])` | `success: false`; `invalid_type` em `1.title` | Confirma cobertura de `tarefas.ts` |
| Aninhamento profundo (WR-10) | `reviverArgumentos(JSON.parse(...))` com 200.000 níveis, via `vite-node` | `RangeError: Maximum call stack size exceeded` — lançado, e o código lido mostra `try/catch` na rota que o intercepta | WR-10 continua fechado |
| Completude `ESQUEMAS` ≡ `OPERACOES` | `Object.keys(ESQUEMAS).sort()` vs `Object.keys(OPERACOES).sort()` via `vite-node` | `{ esquemasCount: 132, operacoesCount: 132, equal: true }` | `missing[0]` do gap anterior fechado |
| WR-12 (novo, não aceito por relato) | `ESQUEMAS.updateTask.safeParse(["tsk_x",{dueDate:{form:"instant",value:"garbage"}}])`; `ESQUEMAS.setRecurrence.safeParse([...{interval:1e15}...])`; `new Date("garbage").setDate(...).toISOString()` em Node puro | Ambos os `safeParse` → `success: true`; `toISOString()` → `RangeError: Invalid time value` | Achado real, julgado fora do escopo desta rodada (ver "Julgamento sobre WR-12") |

### Behavioral Spot-Checks

| Comportamento | Comando | Resultado | Status |
|---|---|---|---|
| `npm run check` completo (typecheck+lint+tokens+test, 3 workspaces) | `npm run check` | 469/469 testes verdes (253 dominio + 163 api + 53 web) | ✓ PASS |
| Suíte `apps/api` das rotas, casos por nome | `npx vitest run --root apps/api src/rotas/operacoes.test.ts src/rotas/esquemas-de-argumentos.test.ts` | 33/33 verdes (22 de `operacoes.test.ts`, (a)-(v); 11 de `esquemas-de-argumentos.test.ts`, (a)-(k)) | ✓ PASS |
| `ESQUEMAS` barra `kind`/`anchor` malformados de `createGoal` | script `vite-node` próprio | `safeParse(...).success === false` (era `true` na rodada anterior) | ✓ PASS — gap fechado |
| `ESQUEMAS` barra `filters` arbitrário de `saveView` | script `vite-node` próprio | `safeParse(...).success === false` | ✓ PASS — gap fechado |
| `reviverArgumentos` não estoura sem tratamento (WR-10) | script `vite-node` próprio, `n=200000`; leitura do `try/catch` em `operacoes.ts` | `RangeError` lançado E capturado pelo código lido | ✓ PASS |
| Os 3 arquivos de teste originais do domínio sem diff desde `d713253` | `git diff --quiet d713253 -- operations.test.ts seed-produto.test.ts contas-a-receber.test.ts` | exit 0 | ✓ PASS |
| `ESQUEMAS` ACEITA a forma legítima de `updateTask` com `dueDate` malformado (WR-12) | script `vite-node` próprio | `safeParse(...).success === true` (o schema valida FORMA, não valor semântico — por desenho documentado em `esquemas/CONTEXT.md`) | ℹ️ INFO — achado real, fora do escopo desta rodada (ver julgamento) |

Nenhum servidor HTTP (`npm run dev`, `apps/api`/`apps/web`) foi iniciado por mim nesta verificação; as reproduções chamaram os módulos TypeScript diretamente via `vite-node`, e o `npm run check` (que inclui os testes de rota via `app.inject` contra o Supabase real) rodou uma única vez.

### Requirements Coverage

| Requisito | Plano(s) | Descrição (REQUIREMENTS.md) | Status | Evidência |
|---|---|---|---|---|
| PERS-01 | 09 (regressão) | Repositórios + Unidade de Trabalho | ✓ SATISFIED | Inalterado nesta rodada |
| PERS-02 | 09 (regressão) | `/entrar` autentica por Supabase Auth, Membro resolvido pelo Usuário | ✓ SATISFIED | Inalterado nesta rodada |
| PERS-04 | 01-04, 09, 11-16 | Rotas HTTP por operação, UoW, Membro da sessão | ✓ SATISFIED, SEM RESSALVA — a ressalva da rodada anterior (CR-02) se dissolve | `ESQUEMAS` ≡ `OPERACOES` (132/132), sem fallback; `TypeError→400` removido; confirmado por reprodução própria. `REQUIREMENTS.md` já marca `[x]` com a mesma justificativa. WR-12 documentado como achado de robustez fora do escopo (ver julgamento) — não bloqueia o requisito |
| PERS-05 | 03, 07 | `store.ts` troca `run()` local por `POST` | ✓ SATISFIED | Inalterado nesta rodada |
| PERS-06 | 05 | Bootstrap do Espaço "Gestão" sem fixtures | ✓ SATISFIED | Inalterado nesta rodada |
| PERS-07 | 06 | Colunas geradas e índices | ✓ SATISFIED | Inalterado nesta rodada |
| PERS-08 | 09 (documental) | Onde `apps/api` roda | Bloqueado por decisão D11 — inalterado, não é código desta fase (tratamento idêntico ao da verificação anterior) | `apps/api/README.md` §5; `REQUIREMENTS.md` linha 33 |
| PERS-09 | 08, 10 | RN-ET-11 — reconvite reativa o mesmo Membro | ✓ SATISFIED | Inalterado nesta rodada (Plans 01-12..01-16 não tocaram `packages/dominio`) |

**Nenhum requisito órfão:** os 8 IDs de `ROADMAP.md`/prompt (PERS-01, 02, 04, 05, 06, 07, 08, 09) aparecem todos em `REQUIREMENTS.md` mapeados para a Fase 1, e todos em pelo menos um `requirements:` de PLAN.md desta fase.

### Anti-Patterns Found

Origem: leitura própria do código + `01-REVIEW.md` (rodada 2, `2026-09-17T14:03:22Z`, 0 críticos / 3 avisos / 5 informações), com confirmação direta por mim nos achados relevantes a esta rodada.

| Arquivo | Achado | Severidade | Impacto no critério/must-have | Confirmado por mim? |
|---|---|---|---|---|
| `packages/dominio/src/operations/collaboration.ts:339-347`, `tasks.ts:1037-1043` (via schema em `apps/api/src/rotas/esquemas/fragmentos.ts`/`colaboracao.ts`) | WR-12 — schema aceita `TaskDate.value`/`RecurrenceRule.interval` com forma certa e valor sem sentido; o domínio persiste e uma chamada POSTERIOR a `changeTaskStatus` lança `RangeError` não capturado → 500 | ⚠️ Warning — real, reproduzido por mim, julgado fora do escopo desta rodada (ver "Julgamento sobre WR-12") | Não bloqueia Critério 2/PERS-04 desta fase (contrato da pasta exclui validação de valor por desenho; correção completa exige tocar o domínio, proibido nesta fase) | Sim — reprodução própria (`safeParse` → `true`; `toISOString()` → `RangeError` em Node puro) |
| `apps/api/src/rotas/esquemas/colaboracao.ts`, `escala.ts`, `fragmentos.ts` (`CONTAINER_TYPE`) | WR-13 — `Igual<>`/`Confere<>` não cobre `whenStillOpen`, `businessDays`, `sortBy.by/.direction`, `measure.target`, `FormQuestion.target.kind`; `CONTAINER_TYPE` conferido contra literal, não contra o domínio | ⚠️ Warning — nenhum bug ativo hoje (os 6 enums batem, conferido um a um pelo REVIEW); rede de segunda linha incompleta | Não bloqueia — os call sites reais do `apps/web` não exercitam a assimetria hoje | Não relido linha a linha por mim — aceito o achado do REVIEW, coerente com minha leitura de `fragmentos.ts` |
| `apps/api/src/rotas/esquemas/` | WR-14 — `tarefas.ts`, `automacoes.ts`, `financeiro.ts` (23 operações) sem `<modulo>.test.ts` próprio | ⚠️ Warning — lacuna de rede de testes, não de comportamento | Não bloqueia — confirmei por `ls` que faltam exatamente esses 3 arquivos entre os 15 módulos | Sim — `ls apps/api/src/rotas/esquemas/*.test.ts` confirma 12 de 15 |
| Diversos (IN-12 a IN-16 do `01-REVIEW.md`) | Assimetrias menores de portão, comentários desatualizados, testes com asserção fraca | ℹ️ Info | Nenhum corresponde a um `must_haves` de nenhum plano nem a um Critério de Sucesso do ROADMAP | Não relidos individualmente por mim — ver `01-REVIEW.md` para o texto completo |
| WR-01, WR-03..WR-09, IN-01, IN-03..IN-09 (rodada 1, não tocados por esta rodada) | Achados residuais da rodada anterior, arquivos não modificados neste delta | ⚠️/ℹ️ Warning/Info | Fora de escopo desta rodada — nenhum arquivo que eles tocam mudou (`git diff --stat c6f0d1c^..HEAD` confirma) | Não relidos — classificação da rodada anterior mantida |

Nenhum marcador de débito (`TBD`/`FIXME`/`XXX`) sem referência de issue encontrado nos 43 arquivos alterados por esta rodada (`c6f0d1c^..6d3103d`).

### Human Verification Required

Ver frontmatter — carregados **sem alteração** da verificação anterior: nenhum plano desta rodada (01-12..01-16) tocou `apps/web` ou o fluxo de navegador (confirmado por `git diff --stat c6f0d1c^..HEAD`).

1. **Login → criar Conta a pagar pela tela → F5 → persistência.**
   **Teste:** Logar como `maryane@n1.teste` (senha de desenvolvimento) em `http://localhost:3001/entrar`, abrir Gestão › Financeiro › Contas a pagar, criar uma Conta a pagar pela tela, recarregar a página (F5).
   **Esperado:** A Lista abre vazia de Tarefas fictícias; a Conta criada aparece e CONTINUA lá depois do F5 — Critério 1 do ROADMAP, a parte "pela tela" que só um navegador prova.
   **Por que humano:** Persistência através de recarga de página é um efeito perceptual que `app.inject()` não reproduz (o e2e `criar-conta.test.ts` já prova o equivalente por inject, e passou).

2. **Recusa de `changeTaskStatus` sem spinner/sem requisição de rede.**
   **Teste:** Na mesma sessão, tentar mover a Conta recém-criada para "pago" (RN-CP-04, a Maryane não é Aprovadora).
   **Esperado:** A recusa aparece na hora, sem spinner e sem requisição na aba Rede do DevTools (D-05); a criação da Conta aparece como `POST /operacoes/createTask` com resposta 200.
   **Por que humano:** Percepção de latência/presença de requisição de rede não é assertável por `app.inject()`.

3. **`tiago@n1.teste` (removido) vendo "Sem acesso".**
   **Teste:** Sair e entrar como `tiago@n1.teste` (removido no seed, não existe no Espaço "Gestão" bootstrapado).
   **Esperado:** "Sem acesso" — o Membro não existe no Espaço bootstrapado.
   **Por que humano:** Fluxo de cookie/sessão no navegador real; o hook de autenticação já prova 403 por `app.inject()`, mas a tela de "Sem acesso" em si não foi inspecionada.

## Gaps Summary

Nenhum gap de código remanescente. A rodada de fechamento (Plans 01-12..01-16) fechou CR-02 por inteiro: as 132 operações de `OPERACOES` têm schema próprio sob `satisfies EsquemasCompletos`, sem fallback estrutural; `reviverArgumentos` está protegido contra aninhamento hostil (WR-10); o mapeamento `TypeError → 400` foi removido por inteiro (WR-11), então um `TypeError` remanescente sobe como 500 (bug), não fica escondido atrás de um 400. Reproduzi de forma independente as duas formas hostis que o verificador anterior usou contra o fallback antigo (`createGoal` com `kind:42`/`anchor.lixo`, `saveView` com `filters` arbitrário) — ambas agora 400, nada persistido — e as duas formas hostis citadas no prompt desta re-verificação (`createChatFolder` com `name:123`, `updateTask` com `title:123`) — ambas também 400.

Um achado novo do `01-REVIEW.md` (WR-12) é real e foi confirmado por mim de forma independente: dois campos com forma correta mas valor sem sentido (`TaskDate.value: "garbage"`, `RecurrenceRule.interval: 1e15`) passam pelo schema e, se depois uma Tarefa com esses valores tiver sua conclusão disparada via `changeTaskStatus`, o domínio lança `RangeError` não capturado → 500. Julguei este achado como fora do escopo do que esta rodada foi encarregada de fechar — o contrato que a própria pasta `esquemas/` declara (`CONTEXT.md`) exclui explicitamente validação de valor semântico ("regra", não "forma"), e a correção completa exige tocar `packages/dominio`, proibido pelo objetivo desta fase. Documentei o raciocínio completo em "Julgamento sobre WR-12" acima, no mesmo padrão que a rodada anterior aplicou a WR-09. Recomendo um plano de robustez no domínio antes da Fase 2 ampliar o uso de recorrência de Tarefas.

O único item pendente do ROADMAP é o Critério 1 (parte "pela tela, num navegador real") — inalterado desde a primeira verificação da fase, não é um gap desta rodada, é verificação humana ainda não realizada. Por isso o status desta re-verificação é `human_needed`, não `passed`: automaticamente, por código, a fase está pronta; falta o olho humano nos três itens listados acima.

---

_Verificado em: 2026-09-17T15:40:00Z_
_Verificador: Claude (gsd-verifier)_
