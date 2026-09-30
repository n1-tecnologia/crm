---
phase: 06-conferencia-do-resumo-e-anexos
reviewed: 2026-09-30T20:18:45Z
depth: standard
diff_base: 994c29f
diff_head: 0df4ffc
files_reviewed: 9
files_reviewed_list:
  - apps/api/src/automacoes/CONTEXT.md
  - apps/api/src/automacoes/invocar-agente.ts
  - apps/api/src/automacoes/ponte-dispensa-com-resposta.test.ts
  - apps/api/src/automacoes/ponte-g3-e-orcamento.test.ts
  - apps/api/src/automacoes/ponte-resposta-sem-efeito-honesta.test.ts
  - packages/dominio/CONTEXT.md
  - packages/dominio/src/operations/dispensa-com-resposta-pendente.test.ts
  - packages/dominio/src/operations/financeiro-textos.ts
  - packages/dominio/src/operations/financeiro.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Fase 6, Plano 21: Relatório de Code Review — 06-REVIEW-4

**Revisado em:** 2026-09-30T20:18:45Z
**Profundidade:** standard, com verificação empírica (rodei a suíte tocada e
uma sonda temporária fora do repositório versionado — removida ao final,
`git status` limpo)
**Escopo:** `git diff 994c29f..0df4ffc -- packages apps` (commits `e176f7f`,
`8186d3a` do plano 06-21)
**Arquivos revisados:** 9
**Status:** issues_found (achado novo, não presente em `06-REVIEW-3.md`)

## Veredito por achado de `06-REVIEW-3.md`

| Id | Situação | Evidência |
|---|---|---|
| **Crítico** (remarcar "Manual" engole resposta pendente) | **Fechado** — caminho direto e caminho de corrida | `financeiro.ts:1303-1310`: `dispensarConferenciaDoResumo` recusa com `recusaDispensaComRespostaPendente` quando `decisaoDasRespostasPendentes(state, task, {aprovacaoPorComentario:true}).sentido !== "nenhum"`, calculado ANTES de `decideProcessApproval`, DENTRO da mesma checagem de "Manual" que já existia — portanto roda dentro da transação, contra o estado da GRAVAÇÃO, não o snapshot do ciclo. `invocar-agente.ts:1511-1512`: a ponte calcula o mesmo sinal (`pendenteNoFio`) com `state`/`task` do snapshot do ciclo e só chama `dispensar()` quando `manual && !pendenteNoFio`. Rodei `dispensa-com-resposta-pendente.test.ts` (5/5) e `ponte-dispensa-com-resposta.test.ts` (3/3, casos f/g/h) — todos verdes. O caso (h) da suíte injeta a resposta humana só DENTRO do `executarOperacao` (depois do sinal já lido pela ponte como `false`) e confirma que só o domínio pega essa corrida (`DISPENSA_ADIADA_RESPOSTA_PENDENTE`, nunca `DISPENSA_RECUSADA_PELO_DOMINIO`), e que o ciclo seguinte lê o ajuste em nome do humano. A `dispensarConferenciaDoResumo` não tem outro chamador fora de `invocar-agente.ts` (`grep` em `apps`/`packages` só acha os dois usos dentro da ponte) — não há rota nem outro caminho que dispense sem passar pela guarda nova. |
| **WR-01** (log mente "respondeu por quê" sem ter respondido) | **Fechado no sentido literal do achado — mas a correção introduz um achado NOVO, ver Aviso abaixo** | `comentar()` devolve `Promise<boolean>` (`grep -n "Promise<boolean>"` confirma a assinatura); `lerRespostas` só limpa o estado e registra `RESPOSTA_SEM_EFEITO` quando `gravou === true` (`invocar-agente.ts:1592-1601`). Rodei `ponte-resposta-sem-efeito-honesta.test.ts` (5/5, casos a-d): confirmado que `comentar()` falhando não produz `RESPOSTA_SEM_EFEITO` nem Comentário novo (a), que a desistência (`SEM_EFEITO_DESISTIDO`) sai um log honesto sem nova gravação na tentativa N+1 (b), que uma resposta nova ganha orçamento próprio e uma decisão real continua sendo lida no mesmo ciclo (d). `grep -c "\.parada = "` no arquivo inteiro: 12 antes, 12 depois do diff — idêntico; nenhuma linha nova de `lerRespostas`/`SEM_EFEITO_DESISTIDO` toca `estado.parada`/`deste.parada`. |
| IN-01 (cursor não grava no fechamento de G3) | **Fechado** | `invocar-agente.ts:1340-1348`: `cursor = task.id` também é gravado quando `portaDoCicloFechada` interrompe o laço, não só no orçamento esgotado. Caso (f) de `ponte-resposta-sem-efeito-honesta.test.ts` prova, por requisição HTTP recebida, que o ciclo 2 recomeça pela conta em que a porta fechou. |
| IN-02 (checagem morta em `semCodigo`) | **Fechado, e confirmei que era mesmo morta** | `invocar-agente.ts:1748-1754`: a checagem `if (avisar && !membroAtivo(s, avisar)) ...` saiu. Confirmei por leitura: `publicarResumoParaConferencia` (`financeiro.ts:1169-1170`) chama `recusaDoAvisarEstrito` e falha ANTES de qualquer outra coisa sempre que `avisarEstrito` (sempre `true` quando `avisar` está definido neste call site, `invocar-agente.ts` linhas do `...(dispensa \|\| avisar ? {avisarEstrito:true}:{})`) e o Membro não está ativo — e `membroAtivo`/`recusaDoAvisarEstrito` usam exatamente a mesma condição (`state.members.some(m.id===id && m.state==="ativo")`). Logo `publicado.ok` já seria `false` antes da linha removida; a remoção não muda comportamento para nenhum chamador (`avisar` só chega aqui com `avisarEstrito` junto, sempre, neste ramo). `grep -c 'membroAtivo(s, avisar)'` = 1 (só a leitura dentro de `comentar`/publicação continua). |
| IN-03 (caso (b) de G3 não prova a marca encerrada) | **Fechado** | `ponte-g3-e-orcamento.test.ts`: `git diff --stat` mostra só 4 linhas adicionadas no caso (b), nenhuma remoção; a asserção nova (`"Lançamento no Omie interrompido"`) roda e passa (`ponte-g3-e-orcamento.test.ts` 6/6 verde). |

## Achados estruturais (fallow)

Não foram fornecidos achados estruturais para esta revisão.

## Achados narrativos (revisor de IA)

## Avisos

### WR-01 (novo, não estava em 06-REVIEW-3): a guarda `pendenteNoFio`/`recusaDispensaComRespostaPendente` usa `aprovacaoPorComentario: true` fixo mesmo quando o workspace está com `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO=false` — isso trava a dispensa `sem-conferencia` para sempre depois de um "ok" trivial no fio, mesmo esse "ok" não valendo como decisão pela política real do workspace

**Arquivo:** `packages/dominio/src/operations/financeiro.ts:1303-1310`
(`dispensarConferenciaDoResumo`) e `apps/api/src/automacoes/invocar-agente.ts:1511-1512`
(`pendenteNoFio`), ambos usando `{ aprovacaoPorComentario: true }` fixo
(06-21, deliberado, ver `06-21-SUMMARY.md` "Deferred")

**Problema:** o plano 06-21 fixou `aprovacaoPorComentario: true` na guarda
nova "porque nenhum chamador precisa de outro valor hoje" e "é a leitura mais
permissiva que ainda bloqueia todo ajuste". Isso é verdade para o ramo
`ajuste` (`decisaoDasRespostasPendentes` ignora a opção nesse ramo mesmo,
então não regride nada). Mas para o ramo `aprovacao` ("ok"), a opção NÃO é
ignorada: com a política real do workspace configurada como
`conferenciaPorComentario: false` (D6-02 — "uma resposta de aprovação no fio
NÃO vale como conferência", a variável existe exatamente para isso), um "ok"
trivial no fio **nunca conta como decisão de verdade** — o próprio domínio já
tem um texto dedicado para essa situação (`TEXTOS_DA_CONFERENCIA.okPeloFioDesligado`,
usado por `respostaSemEfeitoNoFio`). Só que a guarda nova de `dispensarConferenciaDoResumo`/`pendenteNoFio`
IGNORA a política real e usa sempre `true` — então esse mesmo "ok" que o
domínio sabe que não decide nada passa a BLOQUEAR a dispensa `sem-conferencia`
(D6-04) da MESMA forma que um ajuste de verdade bloquearia, só que sem jamais
se resolver: `decisaoDasRespostasPendentes` não tem noção de "já respondido"
(não usa `jaRespondida`/`respostaLida`) — o "ok" permanece classificado como
"aprovacao pendente" em TODO ciclo futuro, para sempre, enquanto for o último
comentário do fio. Como o `lote` real (com a política `false`) também nunca
o converte em decisão, a Conferência fica `pendente` indefinidamente: a
dispensa `sem-conferencia`, cujo único propósito é dispensar SEM intervenção
humana, passa a exigir que um humano vá até a UI e clique aprovar/rejeitar —
justamente o que o modo deveria evitar — só porque alguém respondeu "ok" no
fio, sem saber que essa política estava desligada.

Isto é uma REGRESSÃO introduzida pelo próprio 06-21: antes da correção, o
código só olhava `manual` (sem checar o fio), então remarcar "Manual" sempre
dispensava de novo — o que, para um "ok" trivial sob política desligada, era
na verdade o comportamento CORRETO (o "ok" não carrega decisão nenhuma; não
há nada de errado em dispensar por cima dele). A correção nova, ao tratar
QUALQUER "aprovacao" pendente como bloqueio — mesmo sob a política que diz
que aprovação por comentário não vale — trocou "nunca engolir uma resposta
real" (o objetivo certo) por "travar para sempre uma resposta que a própria
política já disse que não vale" (um efeito colateral não coberto por nenhum
teste da rodada).

Confirmei por execução (sonda temporária, removida depois — `git status`
limpo ao final, seguindo o mesmo padrão de `06-REVIEW-3.md`): conta Manual
sob `{ integracaoManual: "sem-conferencia", conferenciaPorComentario: false
}`, dispensada automaticamente (c1); "Manual" desmarcado (Resumo novo, c2,
sem decisão); a Maryane responde "ok" no fio (sem decidir nada, pela política
real); "Manual" remarcado; rodei mais 5 ciclos completos:
```
decision apos 5 ciclos: undefined
```
Nos ciclos após o primeiro (que grava `RESPOSTA_SEM_EFEITO` ao responder
"o fio está desligado"), NENHUM log novo sai — a conta fica presa em
silêncio total, sem aviso, sem `parada`, sem erro, só reprocessando
`lerRespostas` que não faz nada a cada ciclo, para sempre:
```
registros nos 4 ciclos seguintes: ["RESPOSTA_SEM_EFEITO"]
```
(só o primeiro ciclo logou algo; os 3 seguintes, nada.)

Nenhum teste da rodada 06-21 cobre a combinação `integracaoManual:
"sem-conferencia"` + `conferenciaPorComentario: false` — todos os testes
novos de Task 1 (`ponte-dispensa-com-resposta.test.ts`) e o cenário do
Crítico (f)/(g)/(h) usam a política padrão (`conferenciaPorComentario: true`
implícito), onde o "ok" REALMENTE decide e portanto o bloqueio é correto
(bate com o teste (g)). A combinação com a política desligada nunca foi
exercitada.

**Por que não é Crítico:** o efeito é "trava de mais" (exige clique humano
onde deveria ser automático), não "libera de menos" (nunca faz a ponte
dispensar por cima de uma decisão real) — é a direção segura do erro, sem
risco de lançamento sem conferência humana de verdade. Mas é um regressão
real, silenciosa (sem log, sem `parada` visível), que derruba a garantia do
D6-04 `sem-conferencia` (zero intervenção humana) exatamente para quem
desligou `conferenciaPorComentario` — uma combinação de configuração
suportada e documentada (`OpcoesDeDecisao`/`lerOpcoesDeDecisao`), não
hipotética.

**Correção:** a guarda de `dispensarConferenciaDoResumo` (e o `pendenteNoFio`
espelhado na ponte) deveria usar a política REAL do chamador para o ramo
`aprovacao`, não `true` fixo — ou, mais simples e sem expor parâmetro novo na
assinatura pública (mantendo a decisão de design do 06-21 de não adicionar
parâmetro): trocar a chamada por duas checagens separadas — sempre bloquear
se houver `ajuste` pendente (como hoje, correto e sem relação com a
política), e só bloquear por `aprovacao` pendente quando a política do
chamador realmente trata aprovação por comentário como decisão. Como
`dispensarConferenciaDoResumo` não recebe a política do workspace hoje (é
D6-02, uma decisão só da ponte, nunca persistida no domínio), a forma mais
direta é a ponte decidir: calcular `pendenteNoFio` com
`{ aprovacaoPorComentario: decisoes.conferenciaPorComentario }` (a política
real) em vez de `true` fixo — isso já fecha o caso (g) do Crítico original
(que testa com a política padrão `true`) e evita a starvation sob política
`false`. Se a defesa em dois níveis quer manter o domínio como última
palavra contra a corrida, ele pode continuar usando `true` fixo internamente
(mais permissivo, como já está) SEM quebrar nada — desde que a ponte não
tente mais a dispensa quando sabe, pela política real, que não há nada
pendente, e trate a recusa do domínio nesse caso como adiada (já é o
tratamento de `DISPENSA_ADIADA_RESPOSTA_PENDENTE`, então mesmo se o domínio
recusar por um "ok" sob política falsa, o pior caso vira "adia mais um
ciclo", não mais "trava para sempre") — mas isso só ajuda se ALGO eventualmente
consumir esse "ok" como decidido ou descartado; hoje nada o faz. Um teste
cobrindo exatamente a sonda acima (sem-conferência + comentário desligado +
"ok" no fio) deveria ser acrescentado antes de fechar este achado.

## Info

### IN-01: `files_modified` do `06-21-PLAN.md` lista `apps/api/src/automacoes/invocar-agente.test.ts`, mas o arquivo não foi tocado

**Arquivo:** `.planning/phases/06-conferencia-do-resumo-e-anexos/06-21-PLAN.md`
(frontmatter `files_modified`) vs. `git diff --stat 994c29f..0df4ffc --
apps/api/src/automacoes/invocar-agente.test.ts` (vazio)

**Problema:** o plano listava `invocar-agente.test.ts` como arquivo a
modificar, e o acceptance criteria da Task 1 fala em "`invocar-agente.test.ts`
existente continua 100% verde, sem nenhuma asserção removida (`git diff
--stat` do arquivo mostra só adições de casos, nunca remoção de `expect`)" —
mas o arquivo não aparece no diff nenhuma vez: os casos novos do Crítico (f)-(i)
foram todos para o arquivo novo `ponte-dispensa-com-resposta.test.ts`, não
para `invocar-agente.test.ts`. O resultado final (100% verde, sem remoção)
continua tecnicamente verdadeiro só porque o arquivo ficou intocado — não é
um defeito de comportamento, só um resíduo de planejamento (a lista de
arquivos do plano não bateu com a execução real, e o `06-21-SUMMARY.md`
também não menciona esse arquivo na lista "Files Created/Modified", então a
mudança de rota foi consistente, só não documentada como desvio).
**Correção:** nenhuma ação necessária no código; se o `06-21-PLAN.md` for
revisado no futuro, ajustar `files_modified` para refletir que os casos do
Crítico foram para o arquivo novo, não para `invocar-agente.test.ts`.

---

_Revisado em: 2026-09-30T20:18:45Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
