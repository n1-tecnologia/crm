---
phase: 06-conferencia-do-resumo-e-anexos
reviewed: 2026-09-30T18:00:00Z
depth: standard
diff_base: 288cbf5
files_reviewed: 11
files_reviewed_list:
  - apps/api/src/automacoes/CONTEXT.md
  - apps/api/src/automacoes/invocar-agente.test.ts
  - apps/api/src/automacoes/invocar-agente.ts
  - apps/api/src/automacoes/ponte-ciclo.test.ts
  - apps/api/src/automacoes/ponte-g3-e-orcamento.test.ts
  - apps/api/src/automacoes/ponte-lancar-fresco.test.ts
  - apps/api/src/automacoes/ponte-reaproveitado-conferido.test.ts
  - apps/api/src/persistencia/CONTEXT.md
  - apps/web/scripts/jornada-financeiro.mjs
  - apps/web/src/features/tarefa/lancamento-no-omie-dialog.tsx
  - apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx
findings:
  critical: 1
  warning: 1
  info: 3
  total: 5
status: issues_found
---

# Fase 6 (rodada 06-18/06-19): Relatório de Code Review — 06-REVIEW-3

**Revisado em:** 2026-09-30T18:00:00Z
**Profundidade:** standard, com rastreamento pontual entre a ponte e o domínio
(domínio não mudou neste intervalo — ver nota de escopo)
**Escopo:** `git diff 288cbf5..996d337 -- packages apps contratos`, sem
`.planning`, docs e `.env*`
**Arquivos revisados:** 11
**Status:** issues_found

## Nota de escopo

`packages/dominio/` não aparece no `git diff 288cbf5..996d337`: o domínio de
06-18 (dispensa só enquanto Manual, `podeDecidirAConferencia`,
`respostaSemEfeitoNoFio`, `conferenciaDoReaproveitado`) e o de 06-19
(`marcarLancamentoEmCurso`, `encerrarLancamentoEmCurso`, `avisarEstrito`) já
estavam mergeados ANTES de `288cbf5` (confirmado por
`git merge-base --is-ancestor`). O que este diff cobre é a Task 3 de 06-19
(G3 estrito no meio do ciclo, orçamento justo, jornada `cp-dispensa-manual`,
docs) mais a Task 2 de 06-19 (a marca "Lançamento no Omie em curso" ligada em
`invocar-agente.ts`) — a implementação da marca entrou como filho direto de
`288cbf5` (`9cdcf60`). Por isso os dois achados abaixo tocam principalmente
`invocar-agente.ts`, e um deles (Crítico) está numa linha que **não foi
tocada neste diff** (herdada de 06-18): reporto porque a prioridade 2 do
pedido de revisão pede exatamente essa verificação ("qualquer caminho
restante onde a dispensa sobrevive... ou onde ela pode ser reaplicada sobre
dado obsoleto"), e o caminho abaixo não foi exercitado pela prova ao vivo de
`06-PROVAS.md`.

Toda alegação abaixo com "confirmei por execução" foi comprovada por uma
sonda (arquivo de teste temporário dentro de `apps/api/src/automacoes/`,
rodado com `DATABASE_URL=` vazio e removido depois — `git status` limpo ao
final; nenhum arquivo de teste do repositório foi alterado).

## Situação dos achados de `06-REVIEW-2.md`

| Id (crm2) | Situação | Evidência |
|---|---|---|
| CR-01 | **Fechado para o caminho provado ao vivo; achado NOVO abaixo para um caminho que não foi provado** | A prova real (`06-PROVAS.md`, "crm2:CR-01 no real") mostra: dispensa → desmarcar Manual → Resumo novo no MESMO fio → zero `/lancar` até o "ok" humano. Isso está correto e bate com o código (`invocar-agente.ts:1537-1560`, `manualAgora` do estado da gravação). Mas existe um SEGUNDO caminho, nunca testado (nem pela suíte, nem pela jornada, nem pela prova ao vivo): remarcar "Manual" depois que um Resumo novo (não dispensado) já foi publicado para um humano E esse humano já escreveu uma resposta no fio (um ajuste, por exemplo) que a ponte ainda não leu. Nesse caminho a ponte DISPENSA por cima da resposta humana em vez de lê-la — ver o Crítico novo abaixo. |
| WR-01 | **Fechado, residual aceito** | A marca "Lançamento no Omie em curso" (`invocar-agente.ts:1780-1806`) fecha a janela dentro da plataforma: `changeTaskStatus` e `addTaskComment` recusam outro Membro (`lancamento-no-omie-dialog.tsx` leva o mesmo aviso ao clique, `RECUSA_LANCAMENTO_EM_CURSO`), e a marca sai em todo desfecho que rastreei (registro, falha permanente registrada, falha transitória, `payableId` não confirmado, saída antes do registro, registro recusado, e no conflito que vira parada) ou no prazo de 5 min (`PRAZO_DO_LANCAMENTO_EM_CURSO_MS`, 30× o timeout do `/lancar`). O residual "alguém lança direto no Omie, fora da plataforma" é aceito e documentado (`06-19-SUMMARY.md`, Deferred) — fora do alcance do CRM por desenho. |
| WR-02 | **Fechado (código inalterado nesta rodada)** | `conferenciaDoReaproveitado`/`motivoDoReaproveitadoSemDePara` (06-18) não aparecem no diff 288cbf5..996d337: confirmado que essa região do arquivo não mudou. |
| WR-03 | **Fechado para os três casos do achado original; um resíduo novo, ver Aviso abaixo** | `podeDecidirAConferencia` e `respostaSemEfeitoNoFio` (06-18) seguem intocados por este diff. O resíduo que encontrei não é "ok que não confere" — é "a explicação da ponte a essa resposta pode nunca sair de verdade e o log mente que saiu" (Aviso 1). |
| WR-04 | **Fechado** | `avisarEstrito`, `portaFechada()` e a conferência de `membroAtivo` DENTRO de cada gravação que avisa (`invocar-agente.ts:1325-1420`, `:1665`, `:1748-1751`, `:1930-1935`) — confirmado lendo o código e rodando `ponte-g3-e-orcamento.test.ts` (6/6 verdes). Teste (a) mostra que a conta seguinte não ganha Resumo, ninguém cai na Maryane, e o ciclo seguinte para no começo. |
| WR-05 | **Fechado para o caso geral (fome e laço quente); um caminho específico não desiste de verdade — ver Aviso abaixo** | Cursor rotativo + `continuar`/`atrasoDaCutucadaMs` resolvem a fome e o giro sem espera (`ponte-g3-e-orcamento.test.ts` (d)/(e), rodei e confirmei 6/6 verdes). A desistência (`tentativasDoComentario`, `COMENTARIO_PENDENTE_DESISTIDO`) funciona para o caso testado (dado faltando com o Agente pausado, teste (f)). Mas o mesmo mecanismo não cobre a chamada a `comentar()` de dentro de `lerRespostas` (a explicação da "resposta sem efeito no fio") — comprovado por sonda, ver Aviso 1. |
| IN-01 | **Fechado (código de 06-18, inalterado nesta rodada)** | `conferenciaMaisRecente` + sufixo `superada` em `financeiro.ts`/`financeiro-textos.ts`, confirmados por grep; fora do diff desta rodada. |
| IN-02 | **Fechado** | `SEM_EFEITO`/`semEfeito()`/`foiSemEfeito()` substituem `ok(undefined)` nos três ramos que não mudam nada (Resumo adiado, saída antes do registro, marca adiada) — `invocar-agente.ts:1068-1086`, `:1651`, `:1826`, `:1798-1801`. |
| IN-03 | **Fechado (confirmado antes de 06-18, ver `06-18-SUMMARY.md`)** | `PADROES_DAS_PARADAS` documenta explicitamente (`invocar-agente.ts:922-931`) por que `textoDaRecusaPermanente` casa com o padrão de `falhaSemVolta` sem recusa — de propósito, para não haver dois padrões para o mesmo texto. |
| IN-04 | **Fechado** | `pedirAjustePeloCard` e o `eslint-disable` saíram de `jornada-financeiro.mjs` (diff confirmado, função removida). |
| IN-05 | **Parcialmente fechado, como já registrado** | `persistencia/CONTEXT.md` ganhou o parágrafo dos prazos; a parte opcional (`55P03` como 409 em `formularios-publicos`) segue deferida, como o `06-19-SUMMARY.md` já assume. |
| IN-06 | **Fechado** | As quatro lacunas (CR-01 desmarcar Manual, "ok" de G3/Maryane, Membro de G3 desativado no meio do ciclo, orçamento com Comentário que falha sempre) têm caso e mutação correspondente, listados em `06-19-SUMMARY.md` ("crm2:IN-06 — as quatro lacunas de teste do review"). Rodei `ponte-g3-e-orcamento.test.ts`, `invocar-agente.test.ts`, `ponte-ciclo.test.ts`, `ponte-lancar-fresco.test.ts`, `ponte-reaproveitado-conferido.test.ts`: 6 + 165 = 171 casos, todos verdes. |

## Achados estruturais (fallow)

Não foram fornecidos achados estruturais para esta revisão.

## Achados narrativos (revisor de IA)

## Crítico

### CR-01: remarcar "Manual" engole uma resposta humana pendente no fio e a ponte dispensa por cima dela (resíduo de crm2:CR-01, caminho não exercitado pela prova ao vivo)

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:1471-1472` (o ramo que
escolhe entre `dispensar` e `lerRespostas`), `:1572-1584` (`dispensar`,
06-18); `packages/dominio/src/operations/financeiro.ts`
(`dispensarConferenciaDoResumo`, inalterado nesta rodada)

**Problema:** a escolha entre dispensar automaticamente e ler as respostas do
fio é feita SÓ pelo valor atual de "Integração manual" (`manual`, lido uma
vez por conta no topo do laço) — nunca pelo fato de já existir, no MESMO
fio, uma resposta humana ainda não processada para a conferência pendente. A
sequência abaixo, que a suíte e a jornada `cp-dispensa-manual` nunca cobrem
(a jornada só testa "ok", nunca "ajuste", e nunca remarca Manual de volta),
faz a ponte descartar uma decisão humana já escrita:

1. Conta Manual, modo `sem-conferencia`: dispensa automática (conferência
   `c1`, `decisionReason` = "Conferência dispensada (Integração manual)").
2. "Manual" é desmarcado → `c1` fica `desatualizada`; um Resumo novo (`c2`) é
   publicado para um humano (Maryane), respondendo no MESMO fio — o
   comportamento correto de crm2:CR-01, já provado ao vivo.
3. O humano responde no fio **pedindo ajuste** ("ajuste: usa a conta
   1.02.02"), mas a ponte ainda não rodou o ciclo que leria essa resposta.
4. Antes desse ciclo, "Manual" é marcado de novo (um engano, um campo em
   lote, qualquer gesto que não seja "confirmar a decisão").
5. No ciclo seguinte, a ponte olha `manual` (agora `true`) e entra no ramo
   `dispensar(conf.conferencia)` em vez de `lerRespostas(conf.conferencia)`
   — a MESMA conferência `c2`, que já tinha a resposta de ajuste escrita, é
   dispensada pelo Membro de serviço. O ajuste nunca é lido, nunca recebe
   resposta, e a conferência vira `aprovada` com
   `decisionReason: "Conferência dispensada (Integração manual)"` e
   `decidedByMemberId` do Membro de serviço — como se nenhum humano tivesse
   se manifestado.

Confirmado por sonda (fixtures da ponte, `servidorFalso`, sem banco,
`decisoes.integracaoManual: "sem-conferencia"`):
```
decision depois do recheck: aprovada
decisionReason: Conferência dispensada (Integração manual)
decidedBy: mem_thiago         (o Membro de serviço, não o humano)
mesma conferencia (c2) ou nova? true
```
A mesma conferência que tinha a resposta de ajuste pendente foi dispensada. Se
o modo for `lancar` (não só `conferencia`), nada mais impede o `/lancar`:
`motivoParaNaoLancar` considera a dispensa válida sempre que "Manual" está
marcado no momento da checagem — e aqui está. Isto é, com o campo
"Integração manual" marcado/desmarcado/marcado de novo no momento errado, a
ponte pode lançar uma conta cujo único registro humano no fio foi um PEDIDO
DE AJUSTE, nunca uma aprovação — o mesmo efeito final que o crm2:CR-01
original descrevia (lançamento sem conferência humana de verdade), só que por
uma porta diferente da que 06-18 fechou.

Este código não foi tocado por 06-18 nem por 06-19 (confirmado: a linha
`invocar-agente.ts:1471` não aparece no diff `288cbf5..996d337`, e já
existia assim antes de 06-18 entrar — a condição olha só `manual`, nunca o
estado do fio). A prova ao vivo de `06-PROVAS.md` não cobre este caminho:
ela nunca remarca "Manual" depois de desmarcado, e o humano só responde
"ok", nunca "ajuste".

**Correção:** antes de decidir entre `dispensar` e `lerRespostas`, pergunte
ao domínio se há uma resposta do fio ainda não processada para a conferência
pendente (o mesmo sinal que `decisaoDasRespostasPendentes`/
`respostaSemEfeitoNoFio` já calculam) e, se houver, processe-a SEMPRE antes
de considerar a dispensa — mesmo que "Manual" tenha voltado a valer nesse
meio-tempo:
```ts
if (manual && !lancamentoSemCodigo(conf.conferencia.origin.lancamento)) {
  const pendenteNoFio = decisaoDasRespostasPendentes(state, task, {...}).sentido !== "nenhum";
  if (pendenteNoFio) await lerRespostas(conf.conferencia);
  else await dispensar(conf.conferencia);
} else await lerRespostas(conf.conferencia);
```
Mais robusto ainda: mova a guarda para dentro de `dispensarConferenciaDoResumo`
(domínio) — uma conferência com uma resposta do fio mais nova que a sua
publicação nunca deveria ser dispensável, independente de quem chama. Um
teste por caminho: ajuste pendente + remarcar Manual; "ok" pendente +
remarcar Manual (esse caso é inofensivo no resultado final, mas atribui a
decisão ao Membro de serviço em vez de ao humano que respondeu — um problema
de auditoria à parte).

## Avisos

### WR-01: a desistência do Comentário (crm2:WR-05) não cobre a resposta "sem efeito no fio" — a ponte tenta para sempre e o log afirma ter respondido quando não respondeu

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:1525-1533`
(`lerRespostas`, inalterado nesta rodada), `:1380-1418` (`comentar`, com
`tentativasDoComentario` — NOVO nesta rodada)

**Problema:** `lerRespostas` chama `comentar(semEfeito.texto, ...)` e, na
sequência, sempre apaga `deste.comentarioPendente` e sempre registra
`"Resposta no fio sem efeito: a ponte respondeu por quê."`
(`RESPOSTA_SEM_EFEITO`) — mesmo quando `comentar()` FALHOU. Como
`comentar()`, ao falhar, grava `deste.comentarioPendente = texto` com o
MESMO texto que acabou de tentar, a linha
`if (deste.comentarioPendente === semEfeito.texto) delete deste.comentarioPendente;`
apaga imediatamente o que `comentar()` acabou de guardar para a
retentativa. O mecanismo novo de 06-19 (`tentativasDoComentario`,
`COMENTARIO_PENDENTE_DESISTIDO` depois de `TENTATIVAS_TRANSITORIAS`) nunca
chega a interromper nada aqui, porque `lerRespostas` deriva `semEfeito`
de novo do estado do fio em TODO ciclo — a "desistência" só apaga um campo
que já seria apagado de qualquer forma.

Confirmado por sonda (G3 com a Maryane respondendo "ok" sob
`avisarId: WALTER` — o caso exato de crm2:WR-03 — com o Agente pausado logo
em seguida, 6 ciclos):
```
comentarios novos: 0
RESPOSTA_SEM_EFEITO (claims it answered): 6
falhas reais de comentario: 6
COMENTARIO_PENDENTE_DESISTIDO ao longo de 6 ciclos: 4
TENTATIVAS_TRANSITORIAS = 3
```
Ou seja: em 6 ciclos, ZERO comentários foram de fato gravados, mas o log
"respondeu por quê" saiu 6 vezes (uma mentira a cada vez), e
`COMENTARIO_PENDENTE_DESISTIDO` — que deveria significar "parei de tentar" —
saiu 4 vezes (nos ciclos 3 a 6), sem nunca parar de tentar. Cada tentativa
consome 1 gravação por ciclo, para sempre, para esta conta — o orçamento
segue sendo gasto exatamente como o WR-05 original descrevia, só que para
este tipo específico de Comentário.

**Correção:** `lerRespostas` não deve limpar `comentarioPendente` nem
registrar "respondeu por quê" quando `comentar()` falhou — só faça isso
quando o Comentário foi de fato gravado (`comentar` já devolve esse sinal
implicitamente ao apagar `comentarioPendente` no `if (r.ok)`; exponha um
booleano de retorno em vez de `Promise<void>`, e condicione as duas linhas a
ele). Depois de `TENTATIVAS_TRANSITORIAS`, pare de tentar responder no fio
até a chave mudar (o mesmo padrão do Comentário de "dado faltando"), e
avise isso no log verdadeiro, não em "respondeu por quê".

## Info

### IN-01: o cursor da fila não é atualizado quando a porta G3 fecha no meio do ciclo

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:1327` (`if (portaDoCicloFechada) return false;`) vs. `:1952` (`cursor = undefined;`, só ao fim do laço)

**Problema:** o cursor rotativo (crm2:WR-05) só é definido quando o
ORÇAMENTO esgota (`cursor = task.id` antes do `return false` do orçamento) ou
zerado quando o laço termina inteiro. Quando é a PORTA G3 que interrompe o
laço (`portaDoCicloFechada`), nenhum dos dois acontece: o `cursor` guarda o
que quer que já valesse de um ciclo anterior. O ciclo seguinte recomeça de
uma posição desatualizada, reprocessando (de forma idempotente, sem gravação
nova na maioria dos casos) as contas entre o cursor antigo e o ponto onde a
porta fechou, antes de alcançar as que ficaram para trás. Não é fome (o
laço ainda alcança todas as contas em algum ciclo), só um descompasso com o
contrato descrito no `CONTEXT.md` ("o ciclo seguinte começa por esta
conta").
**Correção:** no fechamento da porta (`portaFechada()` ou no ponto do
`return false` de `portaDoCicloFechada`), grave `cursor = task.id` também,
do mesmo jeito que o orçamento esgotado faz.

### IN-02: checagem de G3 morta em `momentoDoResumo` (semCodigo)

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:1665-1666`

**Problema:** dentro do ramo `semCodigo`, depois de `publicado.ok` já ter
sido confirmado, há `if (avisar && !membroAtivo(s, avisar)) return fail(...)`.
Mas `publicarResumoParaConferencia` (linha acima) já foi chamada com
`avisarEstrito: true` sempre que `avisar` está definido — se `avisar` fosse
inativo, `publicado.ok` já seria `false` e o código nunca chegaria a esta
linha (é a mesma `s`, síncrono, sem mudança de estado entre as duas
chamadas). A checagem é sempre falsa na prática: código morto, não um bug,
mas confunde quem lê achando que há um caminho onde a publicação passa com
`avisar` inativo.
**Correção:** remova a checagem redundante, ou comente por que ela é uma
defesa dupla intencional (se for essa a intenção).

### IN-03: `ponte-g3-e-orcamento.test.ts` (b) não confere se a marca é mesmo encerrada quando a falha do lançamento é recusada pela porta G3

**Arquivo:** `apps/api/src/automacoes/ponte-g3-e-orcamento.test.ts:129-154`

**Problema:** o caso (b) confirma que nenhuma Menção cai na Maryane e que
"Lançamento no Omie falhou" não é gravado quando `mem_walter` é desativado
durante o `/lancar`. Mas `falhaPermanente` também chama
`encerrarLancamentoEmCurso` nesse mesmo ramo (`invocar-agente.ts:1939-1941`,
crm2:WR-01 x WR-04) — e nenhuma asserção confere que o Registro "Lançamento
no Omie interrompido" de fato saiu. Pela leitura do código isso deveria
funcionar (`encerrarLancamentoEmCurso` não depende de `avisar`), mas não há
teste travando essa combinação específica (G3 fechado + marca em curso).
**Correção:** acrescente `expect(estado.activity.some((a) => a.objectId === das.id && a.action === "Lançamento no Omie interrompido")).toBe(true)` ao caso (b).

---

_Revisado em: 2026-09-30T18:00:00Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
