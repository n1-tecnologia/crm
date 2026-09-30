---
phase: 06-conferencia-do-resumo-e-anexos
reviewed: 2026-09-30T20:15:00Z
depth: standard
diff_base: db6702c
diff_head: 3bac177
files_reviewed: 5
files_reviewed_list:
  - apps/api/src/automacoes/invocar-agente.ts
  - apps/api/src/automacoes/ponte-dispensa-respeita-comentario.test.ts
  - packages/dominio/CONTEXT.md
  - packages/dominio/src/operations/dispensa-respeita-comentario.test.ts
  - packages/dominio/src/operations/financeiro.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Fase 6, Plano 22: Relatório de Code Review — 06-REVIEW-5

**Revisado em:** 2026-09-30T20:15:00Z
**Profundidade:** standard, com verificação empírica (rodei as 6 suítes tocadas
pelo plano — 3 do domínio, 3 da ponte — e confirmei o diff completo linha a
linha; nenhum comando escreveu no repositório, `.env` não foi lido, nenhum
servidor subiu)
**Escopo:** `git diff db6702c..3bac177 -- packages apps` (commit `1c265d8`,
plano 06-22)
**Arquivos revisados:** 5
**Status:** clean — nenhum achado novo, a regressão do 06-REVIEW-4 está
fechada e nenhum achado anterior reabriu

## Resumo

Este é o quinto round de revisão da fase. O diff é exatamente o que o plano
06-22 prometeu: um parâmetro opcional novo em `dispensarConferenciaDoResumo`
(`opcoes?.aprovacaoPorComentario`, padrão `true`) e três call sites em
`invocar-agente.ts` trocando `{ aprovacaoPorComentario: true }` fixo por
`{ aprovacaoPorComentario: decisoes.conferenciaPorComentario }` — a política
real do espaço de trabalho. Fui atrás dos seis pontos pedidos:

**1) Cenário de starvation do 06-REVIEW-4, contra o código entregue —
fechado de verdade.** Reproduzi a leitura (não rodei a sonda de novo, ela já
virou teste permanente): `ponte-dispensa-respeita-comentario.test.ts` caso
(h) é literal a sonda do 06-REVIEW-4 — 5 ciclos depois de remarcar "Manual"
com um "ok" trivial no fio sob `conferenciaPorComentario: false`, e afirma
`c2.decision` nunca fica `undefined` em nenhum dos 5 ciclos (antes, a sonda
real do 06-REVIEW-4 mostrou `undefined` para sempre). O `06-22-SUMMARY.md`
documenta a prova por mutação (reverteu o parâmetro, confirmou por
`sha256sum` e por execução que os casos (a), (e), (g), (h) voltam a falhar
exatamente como a sonda mostrou, depois restaurou). Rodei a suíte eu mesma —
`ponte-dispensa-respeita-comentario.test.ts` + as duas suítes protegidas
(`ponte-dispensa-com-resposta.test.ts`, `ponte-dispensa-e-fio.test.ts`): 3
arquivos, 15/15 verdes, sem edição nos dois últimos (`git diff --stat`
confirma: só os 5 arquivos do plano aparecem no diff, nenhum desses dois).
Isso não é "test-shaped" — o caso (h) é a reprodução mecânica da sequência
completa que 06-REVIEW-4 percorreu manualmente, com a mesma asserção
(`.not.toBeUndefined()` a cada ciclo) que a sonda original checava por log.

**2) O ramo `ajuste` ainda bloqueia incondicionalmente — o Crítico original
de 06-REVIEW-3 continua fechado.** Li `decisaoDasRespostasPendentes`
(`financeiro.ts`, função não tocada por este diff): o loop
`if (sentido === "ajuste") return { sentido: "ajuste", ... }` retorna assim
que encontra um ajuste, ANTES de qualquer checagem de
`opcoes.aprovacaoPorComentario` — essa opção só é lida depois do loop, só
para o ramo `aprovacao` (`if (aprovacao && opcoes.aprovacaoPorComentario)`).
Logo nenhum valor de `aprovacaoPorComentario` (fixo ou vindo da política
real) muda o comportamento do ramo `ajuste`: ele bloqueia sempre. O caso (b)
do domínio e o caso (f) da ponte (ambos deste plano) testam exatamente essa
garantia sob a política DESLIGADA — o pior caso para o achado reabrir — e os
dois passam. O Crítico de 06-REVIEW-3 (remarcar "Manual" engole resposta
pendente) segue fechado.

**3) Os 3 call sites passam a política real de forma consistente, nenhum
esquecido ou revertido a um literal.** `grep -n
"aprovacaoPorComentario"` em `invocar-agente.ts` mostra 6 ocorrências de
`decisoes.conferenciaPorComentario` (3 pré-existentes — `respostaSemEfeitoNoFio`
linha 1571, a leitura de lote linha 1611, `publicarResumoParaConferencia`
linha 1740 — e as 3 novas deste plano: `pendenteNoFio` linha 1515,
`dispensar()` linha 1651, `momentoDoResumo` linha 1770) e ZERO ocorrências de
`aprovacaoPorComentario: true` fixo em `financeiro.ts` ou
`invocar-agente.ts` (`grep -c` = 0 nos dois). `decisoes` é declarado uma
única vez (`invocar-agente.ts:1113`, `const decisoes: OpcoesDeDecisao = {
...DECISOES_PADRAO, ...opcoes.decisoes }`) no escopo de `criarPonteDoAgente`
e capturado por closure nas três funções internas que o usam — não há
sombra (`shadowing`) nem redeclaração em nenhum escopo interno. Os 3 call
sites de `dispensarConferenciaDoResumo`/`decisaoDasRespostasPendentes`
tocados pelo diff leem a mesma variável.

**4) O padrão `true` do 4º parâmetro preserva todo chamador
pré-existente.** `grep -rn "dispensarConferenciaDoResumo("` em
`apps`/`packages` (fora de teste) só acha 2 call sites de produção — os dois
dentro de `invocar-agente.ts`, ambos deste plano, ambos passando a opção
explicitamente — e a própria definição. Não há terceiro chamador de
produção escondido. Os 4 arquivos de teste protegidos pelo plano
(`dispensa-com-resposta-pendente.test.ts`, `dispensa-so-enquanto-manual.test.ts`,
`ponte-dispensa-com-resposta.test.ts`, `ponte-dispensa-e-fio.test.ts`)
continuam chamando a função com 3 argumentos (sem o 4º) — `git diff --stat`
confirma zero edição nos quatro. `DECISOES_PADRAO.conferenciaPorComentario =
true` (`invocar-agente.ts:174`) e `OpcoesDeDecisao.conferenciaPorComentario`
é `boolean` obrigatório (não opcional, `invocar-agente.ts:167`) — então
`decisoes.conferenciaPorComentario` é sempre `true` para qualquer chamador
de `criarPonteDoAgente` que não passe `opcoes.decisoes` (o caso comum), o que
faz os 3 novos call sites da ponte produzirem exatamente `{
aprovacaoPorComentario: true }`, idêntico ao valor fixo de antes — nenhuma
mudança de comportamento para quem não usa a env var
`AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO=false`. Rodei as 3 suítes
do domínio (`dispensa-respeita-comentario.test.ts`,
`dispensa-com-resposta-pendente.test.ts`, `dispensa-so-enquanto-manual.test.ts`):
17/17 verdes.

**5) Nenhum log novo, nenhum valor sensível.** O diff não acrescenta nenhuma
chamada a `registrar(...)` nova — só um parâmetro de função, uma constante
derivada (`aprovacaoPorComentario`), três argumentos de chamada trocados e
comentários atualizados. As linhas de log já existentes que ficam ao redor
dos call sites tocados (`DISPENSA_ADIADA`, `DISPENSA_ADIADA_RESPOSTA_PENDENTE`)
são anteriores a este plano e não mudaram; continuam usando `code`, nunca
`r.error` bruto, na linha com o comentário T-3-04 já existente. Nada a
reportar aqui.

**6) Sem scope creep.** `git diff --stat` mostra só os 5 arquivos do plano:
12 linhas em `invocar-agente.ts` (exatamente os 3 call sites + comentários),
20 em `financeiro.ts` (assinatura + guarda + comentário), 23 em `CONTEXT.md`
(documentação), e os 2 arquivos de teste inteiramente novos. Inspecionei o
contexto ao redor de cada call site tocado (a função `dispensar()` completa,
linhas 1640-1670, e `momentoDoResumo` nas vizinhanças da dispensa, linhas
1725-1770) — o código de 06-21 Task 2 (`comentar()`, cursor, a checagem
`semCodigo`/`avisarEstrito`) está fisicamente perto de algumas dessas linhas
mas nenhuma delas foi tocada pelo diff; o `grep`/leitura confirma que as
únicas mudanças de texto são as 3 linhas de call site nomeadas pelo plano
mais os comentários que as documentam.

## Achados estruturais (fallow)

Não foram fornecidos achados estruturais para esta revisão.

## Achados narrativos (revisor de IA)

Nenhum achado novo. Os seis pontos de verificação pedidos foram todos
confirmados como corretos; nenhuma regressão, nenhum call site esquecido,
nenhum vazamento de log, nenhum scope creep.

---

_Revisado em: 2026-09-30T20:15:00Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
