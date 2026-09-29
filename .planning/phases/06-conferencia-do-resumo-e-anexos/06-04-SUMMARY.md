---
phase: 06-conferencia-do-resumo-e-anexos
plan: 04
subsystem: apps/web (tarefa, fila de aprovações, contas-view, jornada)
tags: [conferencia-do-resumo, contas-a-pagar, aprovacoes, jornada, playwright, vitest, testing-library]

# Dependency graph
requires:
  - phase: 06-01
    provides: "conferenciaDoResumo, revisoresDoResumo, publicarResumoParaConferencia, decideProcessApproval (ramo resumo), TEXTOS_DA_CONFERENCIA"
  - phase: 06-03
    provides: "a ponte em dois momentos, os modos ensaio/conferencia/lancar, G2 (escopo por título) e G3 (AVISAR_ID) — o que a jornada espera ver no tópico"
provides:
  - "PainelConferenciaDoResumo: o card da Conferência na conta (pendente/conferida/ajuste pedido/desatualizada/aguardando)"
  - "DialogoConferir / DialogoPedirAjuste: os diálogos da Conferência, usados pelo card e pela fila"
  - "PilulaDaConferencia: o estado ao lado do Status (cabeçalho da conta e linhas de contas-view)"
  - "PainelDeDecisaoDaTarefa: um ponto de decisão por Tarefa (Conferência em conta a pagar, Aprovação no resto)"
  - "conferenciaVisivel, podeConferirOResumo, resumoDaConta (leituras de apresentação)"
  - "Fila /ia/aprovacoes ramifica por origin.processStep: card 'Conferir Resumo de pagamento — <id>'"
  - "Jornada: esperarNoFio, cenários cp-conferida e cp-ajuste, JORNADA_MODO, JORNADA_ESPERA_MS, --so="
affects: [06-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Um controlador, dois cards: a Conferência decide por useDecisaoDeAprovacao (source click), o mesmo da Aprovação da Solicitação"
    - "Estado da Conferência sempre por conferenciaDoResumo; a tela só decide SE há o que mostrar"
    - "Cenários da jornada que precisam da ponte ligada só rodam pedidos pelo nome (soQuandoPedido)"

key-files:
  created:
    - apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx
    - apps/web/src/features/tarefa/painel-conferencia-do-resumo.test.tsx
  modified:
    - apps/web/src/features/estrutura/tarefa-completa.tsx
    - apps/web/src/app/(shell)/ia/aprovacoes/page.tsx
    - apps/web/src/features/estrutura/financeiro/contas-view.tsx
    - apps/web/scripts/jornada-financeiro.mjs

key-decisions:
  - "Os botões do card aparecem para quem alcança a conta (memberSeesTask) E pode decidir pela regra de decideProcessApproval: o aprovador designado (o Financeiro, ou o Membro que a ponte indicou por AVISAR_ID) ou um revisor de nível Administrador/Proprietário. mem_rafael (Administrador fora da Lista) não os vê."
  - "Na fila, uma Conferência só aparece a quem alcança a conta (o estado hidratado é o Espaço inteiro e a conta mora numa Lista privada)."
  - "A pílula e o card 'aguardando' só aparecem numa conta completa (erpMissingFields vazio) em 'para pagar'/'em lançamento omie'; Integração manual e contas já em 'lançado omie' ou depois não têm pílula."
  - "A jornada confere pelo CARD, não por 'ok' no fio: o tópico da tela não tem o gesto 'Responder' e a ponte só lê respostas."
  - "cp-conferida e cp-ajuste só rodam quando pedidos pelo nome; os quatro cenários antigos pedem a API sem a ponte."

requirements-completed: []
requirements-advanced: [RES-02, RES-06]

# Metrics
duration: ~25min
completed: 2026-09-29
---

# Phase 6 Plan 04: A Conferência na tela e na jornada — Summary

**O Financeiro confere o Resumo com um clique na conta ou na fila de Aprovações, pelo mesmo controlador da Aprovação da Solicitação. O estado da conferência aparece como pílula ao lado do Status, sem abrir o fio. A jornada ganhou `cp-conferida` e `cp-ajuste`, que esperam o Resumo da ponte no tópico e conferem ou pedem ajuste pelo card.**

## Performance

- **Duração:** ~25 min
- **Fim:** 2026-09-29T23:37Z
- **Tasks:** 2/2
- **Arquivos:** 2 criados, 4 modificados

## Realizações

- **Card na conta (`painel-conferencia-do-resumo.tsx`):**
  - O título leva o estado: "Conferência do Resumo · Pendente/Conferido/Ajuste pedido/Desatualizado/Aguardando".
  - Mostra a tripla conta · categoria · código de `origin.lancamento`, e nunca a reparseia do texto (D6-10). Mostra também fornecedor, valor e vencimento, lidos dos Campos, e o link "Ver o Resumo no tópico" (`#comentario-<resumoCommentId>`).
  - Tem os botões "Conferido, pode lançar" e "Pedir ajuste"; o ajuste exige motivo.
  - Os textos de (c) seguem o plano. O card só existe quando o estado dá o que mostrar; não aparece em conta Manual.
  - O veredito `revisar`/`ausente` ganha um aviso para conferir o código. É o que o plano chamava de "similaridade quando existe"; ver Desvios.
- **Um ponto de decisão por Tarefa:** `PainelDeDecisaoDaTarefa` mostra o card da Conferência numa conta de `CP.listId` e `PainelAprovacao` no resto. Em `tarefa-completa.tsx` ele substitui a chamada direta; o popup "Conta" usa `TarefaCompleta` e recebe o card também.
- **Fila `/ia/aprovacoes`:** `renderProcessCard` ramifica por `origin.processStep === "resumo"` e mostra o card "Conferir Resumo de pagamento — CP-…".
  - Os botões são "Conferir" e "Pedir ajuste", com os mesmos diálogos do card e o mesmo `useDecisaoDeAprovacao`.
  - Uma Conferência que não é mais a vigente pendente mostra "Os dados mudaram…" e fica sem botões.
  - A Aprovação de Solicitação continua como era.
- **Pílula:** "Aguardando Resumo", "Resumo para conferir", "Resumo conferido", "Ajuste pedido" e "Resumo desatualizado". Aparece no cabeçalho da conta, ao lado do StatusPicker, e em `contas-view`, tanto na tabela quanto na lista estreita.
- **Jornada:**
  - `esperarNoFio(regex, timeoutMs, { aPartirDe })` recarrega a cada 3 s até `JORNADA_ESPERA_MS` (padrão 90 s).
  - Helpers novos: `conferirPeloCard`, `pedirAjustePeloCard`, `cardDaConferencia`, `statusDeveSer`.
  - `JORNADA_MODO` aceita só os literais `conferencia` ou `lancar`; qualquer outro valor encerra com código 2.
  - `--so=` na linha de comando se soma a `JORNADA_SO`.
  - Os cenários `cp-conferida` e `cp-ajuste` estão documentados no cabeçalho, com as variáveis da API que o 06-06 precisa: `MODO`, `SO_TITULOS_COM="TESTE AUTOMATIZADO"` e `AVISAR_ID`.

## Commits

1. **Task 1** — `0f41d82` feat(06-04): o card Conferência do Resumo na conta e na fila; a pílula
2. **Task 2** — `869dc20` feat(06-04): a jornada confere o Resumo como uma pessoa — cp-conferida e cp-ajuste

O teste da Task 1 foi escrito junto com a implementação e entrou no mesmo commit, como em 06-01 e 06-03. A prova de que ele morde está nas mutações abaixo.

## Testes e verificações

| Verificação | Resultado |
|---|---|
| `painel-conferencia-do-resumo.test.tsx` (novo) | **22/22** — (a) 4, (b) 2, (c) 6, (d) 2, (e) 5, (f) 3 |
| `apps/web` inteiro (`npx vitest run`) | **238/238** (216 + 22) — nenhum teste existente editado |
| `npx tsc --noEmit` (web) / `npm run typecheck -w @n1/web` | verde |
| `npx eslint` nas pastas tocadas | 0 problemas |
| `npm run lint -w @n1/web` | 0 erros, 4 avisos pré-existentes (fora deste plano) |
| `npm run verificar:tokens -w @n1/web` | 0 falhas (437 tokens, 311 arquivos) |
| `node --check` + `npx eslint scripts/jornada-financeiro.mjs` | verdes |
| `grep -c 'state.approvals' painel-conferencia-do-resumo.tsx` | 0 |
| `grep -c 'useDecisaoDeAprovacao' painel-conferencia-do-resumo.tsx` | 3 |
| `grep -c 'processStep' (shell)/ia/aprovacoes/page.tsx` | 6 |
| `grep -c 'cp-conferida\|cp-ajuste' jornada-financeiro.mjs` | 11 |
| `git diff --name-only 524bdbc HEAD` | os 6 arquivos do plano (sem `package.json`, ver Desvios) |

`packages/dominio` e `apps/api` não foram tocados; as suítes deles não foram rodadas de novo.

**A jornada NÃO foi executada.** A execução real é o checkpoint do 06-06 e precisa da API em modo `conferencia`.

## Mutações (desligar a regra faz o teste falhar)

| # | Mutação | Resultado |
|---|---|---|
| M1 | `podeConferirOResumo` sem `memberSeesTask` | 1 falha (b: Administrador fora da Lista) |
| M2 | `PainelDeDecisaoDaTarefa` sempre com `PainelAprovacao` | 1 falha (d) |
| M3 | fila sem o filtro de alcance da Conferência | 1 falha (e: mem_rafael) |
| M4 | pílula sem o filtro de Status | 1 falha (f: lançado omie) |
| M5 | `conferenciaVisivel` sem exigir conta completa | 1 falha (c: sem card) |
| M6 | fila sem o ramo `processStep === "resumo"` | 2 falhas (e) |

Todas foram restauradas a partir de cópia (`cmp` confirmado) e a suíte ficou verde depois.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correção] Botões só para quem alcança a conta e pode decidir**
- **Found during:** Task 1
- **Issue:** `revisoresDoResumo` inclui todo Administrador, mas no seed `mem_rafael` não alcança a Lista, e a resposta canônica no fio seria recusada por `addTaskComment`. Há ainda um segundo caso: com G3 o aprovador passa a ser o usuário de teste, que não é revisor, e ele precisa decidir por clique.
- **Fix:** `podeConferirOResumo` = `memberSeesTask` E (aprovador designado OU revisor de nível Administrador/Proprietário). É o espelho de `mayDecideApproval`, que não é exportado. Na fila, a Conferência de uma conta que o Membro não alcança não aparece.
- **Commit:** `0f41d82`

**2. [Interpretação] "similaridade quando existe"**
- A Conferência não guarda a similaridade: `origin.lancamento` tem só `conta`, `categoria`, `codigo` e `veredito`. No lugar dela o card mostra um aviso quando o veredito é `revisar` (categoria por semelhança) ou `ausente` (sem correspondência). Levar a similaridade para `origin.lancamento` seria mudança de domínio, fora dos arquivos deste plano.

**3. [Interpretação] Cenários da jornada só quando pedidos**
- Com `JORNADA_SO` vazio, a jornada roda os quatro cenários antigos, que pedem a API SEM a ponte. `cp-conferida` e `cp-ajuste` precisam dela ligada; por isso têm `soQuandoPedido: true` e só rodam pedidos pelo nome. O comportamento de quem já rodava a jornada não muda.

**4. [Interpretação] "responder ok no fio" → o card**
- `timeline.tsx` não tem o gesto "Responder" e a ponte só lê respostas. Pelo próprio plano, o caminho é o botão "Conferido, pode lançar" do card (D6-02), e isso está registrado no cabeçalho do script. A decisão por "ok" no fio fica provada pelos testes da ponte (06-03, `invocar-agente.test.ts`), não pela jornada.

**5. [Detalhe] `apps/web/package.json` não mudou**
- `npm run jornada:financeiro -w @n1/web -- --so=cp-conferida` já passa `--so=` para o `node`, e o script agora o lê. Não houve nada a acrescentar no `package.json`.

**6. [Detalhe] Pílula e card "aguardando" só em conta completa**
- O plano lista "Aguardando Resumo" para `sem-resumo`. Aqui ele só aparece quando a conta está completa e em "para pagar"/"em lançamento omie". Numa conta incompleta o que falta é dado, não Resumo, e a pílula mentiria.

---

**Total:** 6 desvios (1 correção de regra, 3 interpretações, 2 detalhes). Nenhum toca `packages/dominio` ou `apps/api`.

## Decisão pendente → resolvida pelo orquestrador (`a39d6d2`)

A sugestão abaixo foi aplicada: `movidaDepoisDaImportacao` foi para
`@n1/dominio/operations/financeiro` (o G1 é regra, e regra mora no domínio);
`invocar-agente.ts` a importa e reexporta o nome (testes da ponte intactos,
142/142 com os dois arquivos de contrato), e `conferenciaVisivel` a exige
para `sem-resumo`. Testes novos: `conta-importada-e-resumo.test.ts`
(domínio, 3) e `painel-conferencia-importada.test.ts` (web, 2); mutação — sem
a guarda, o caso da importada parada falha. Suítes: domínio 831/831, web
240/240; `tsc` nos três workspaces. Fica de fora, por ser escolha de
ambiente que a tela não enxerga: com
`AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE=em-lancamento-omie`, a espera em
"para pagar" continua dizendo "Aguardando Resumo" (o padrão é `para-pagar`).

- **Pílula "Aguardando Resumo" no legado importado de `ws_n1`:** pelo G1 (06-03), a ponte nunca varre uma conta importada que não foi movida depois da importação. A tela não sabe disso, porque `movidaDepoisDaImportacao` mora em `apps/api/src/automacoes/invocar-agente.ts` e a web não importa a api. Resultado: as contas importadas completas em "para pagar" mostram "Aguardando Resumo" e "Aguardando o Resumo do Agente." sem que o Agente vá publicar. Também com `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE=em-lancamento-omie` o texto em "para pagar" fica impreciso. **Sugestão:** levar `movidaDepoisDaImportacao` para `@n1/dominio` (é pura) e usá-la em `conferenciaVisivel`. É uma mudança de duas camadas; fica para o orquestrador ou para o dono antes do 06-06 mostrar a Lista real.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum além do plano. A fila deixou de mostrar Conferências de contas que o Membro não alcança, o que reduz a superfície.

## Next Phase Readiness

- **06-06:** subir a API com `AGENTE_CONTAS_A_PAGAR_MODO=conferencia`, `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM="TESTE AUTOMATIZADO"` e `AGENTE_CONTAS_A_PAGAR_AVISAR_ID=<Membro do usuário da jornada>`. Depois rodar `JORNADA_EMAIL=… JORNADA_SENHA=… npm run jornada:financeiro -w @n1/web -- --so=cp-conferida,cp-ajuste`.
- O usuário da jornada precisa alcançar a Lista de Contas a pagar. Com AVISAR_ID ele é o aprovador e vê os botões mesmo sem ser Administrador.
- Não editar código com a jornada rodando (HMR).

## Self-Check: PASSED

- FOUND: apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx
- FOUND: apps/web/src/features/tarefa/painel-conferencia-do-resumo.test.tsx
- FOUND: 0f41d82, 869dc20

---
*Phase: 06-conferencia-do-resumo-e-anexos*
*Completed: 2026-09-29*
