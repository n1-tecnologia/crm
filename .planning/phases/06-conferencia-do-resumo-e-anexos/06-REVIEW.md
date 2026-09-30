---
phase: 06-conferencia-do-resumo-e-anexos
reviewed: 2026-09-30T00:38:29Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - packages/dominio/src/types/ai.ts
  - packages/dominio/src/operations/financeiro-textos.ts
  - packages/dominio/src/operations/financeiro.ts
  - packages/dominio/src/operations/ai.ts
  - packages/dominio/src/operations/tasks.ts
  - apps/api/src/automacoes/invocar-agente.ts
  - apps/api/src/automacoes/anexos-da-conta.ts
  - apps/api/src/automacoes/ponte-ativa.ts
  - apps/api/src/index.ts
  - apps/api/src/rotas/operacoes.ts
  - apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx
  - apps/web/src/features/estrutura/tarefa-completa.tsx
  - apps/web/src/app/(shell)/ia/aprovacoes/page.tsx
  - apps/web/src/features/estrutura/financeiro/contas-view.tsx
  - apps/web/scripts/jornada-financeiro.mjs
  - packages/dominio/src/operations/conferencia-do-resumo.test.ts
  - packages/dominio/src/operations/decisao-da-conferencia.test.ts
  - packages/dominio/src/operations/lancamento-registrado.test.ts
  - packages/dominio/src/operations/conferencia-avisar.test.ts
  - packages/dominio/src/operations/conta-importada-e-resumo.test.ts
  - apps/api/src/automacoes/invocar-agente.test.ts
  - apps/api/src/automacoes/anexos-da-conta.test.ts
  - apps/api/src/automacoes/ponte-ativa.test.ts
  - apps/api/src/automacoes/contrato-contas-a-pagar-ponte.test.ts
  - apps/web/src/features/tarefa/painel-conferencia-do-resumo.test.tsx
findings:
  critical: 4
  warning: 12
  info: 5
  total: 21
status: issues_found
---

# Fase 6: Relatório de Code Review

**Revisado em:** 2026-09-30T00:38:29Z
**Profundidade:** standard (com rastreamento pontual entre arquivos onde o dinheiro passa)
**Arquivos revisados:** 25
**Status:** issues_found

## Resumo

Revisei o diff `00040c5..HEAD` da Fase 6: a Conferência do Resumo no domínio,
a ponte em dois momentos, os anexos, a cutucada, a tela e a jornada. As guardas
locais estão bem montadas: `registrarLancamentoNoOmie` exige `conferida` para a
impressão atual, os modos `ensaio`/`conferencia` não chegam ao `/lancar`, e os
logs da ponte seguem a lista fechada, com uma exceção (WR-11).

Os defeitos graves aparecem entre as camadas e no tempo:

1. A ponte decide o `/lancar` com um snapshot hidratado no começo do ciclo e não
   confere de novo antes da chamada (CR-01).
2. O `reaproveitado: true` do Omie é registrado como lançamento da Conferência
   atual sem comparar o título existente com os dados conferidos (CR-02).
3. O classificador do fio aprova respostas que pedem mudança, como
   `"certo, mas o vencimento é dia 15"`, e isso pode levar direto ao `/lancar`
   (CR-03). Confirmei rodando a função.
4. Uma decisão por clique numa Conferência emite `solicitacao.aprovacao-decidida.v1`
   para uma Conta a pagar (CR-04).

Nas guardas G1/G2/G3: o `AGENTE_CONTAS_A_PAGAR_AVISAR_ID` falha aberto. Um id
inválido faz as Menções irem para a Maryane, e o próprio teste trava esse
comportamento (WR-01). A troca da chave da ponte pela `impressaoDeLancamento`
também trouxe uma regressão: contas ficam paradas para sempre (WR-02).

Rodei um único comando, sem banco (`DATABASE_URL=` + `vite-node` sobre
`classificarRespostaDeConferencia`), para confirmar CR-03.

## Achados estruturais (fallow)

Não foram fornecidos achados estruturais para esta revisão.

## Achados narrativos (revisor de IA)

## Problemas críticos

### CR-01: `/lancar` é chamado a partir de um snapshot velho, sem reconferir a Conferência nem o Status contra o banco

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:701`, `:731`, `:953-972`
**Problema:** `processarContas` hidrata o estado uma vez (l. 701) e percorre
todas as contas em série. Entre a hidratação e o `/lancar` de uma conta pode
haver vários `/resolver` (10 s cada), outros `/lancar` (60 s cada), gravações e
a geração de URLs assinadas (l. 969). A decisão de lançar (`conf.estado === "conferida"`,
`entrouPorMovimento`, `manual`, `emLancamento`) é tomada só sobre esse snapshot.
A reconferência acontece DEPOIS do `/lancar`, dentro de `registrarLancamentoNoOmie`
(l. 990-994), quando o título já existe no Omie. Cenários concretos em modo `lancar`:
- O Financeiro corrige o Valor ou o Vencimento enquanto o ciclo está em voo. A
  Conferência fica `desatualizada` no banco, mas o `/lancar` sai com os dados
  antigos. Depois o registro recusa (`Sem Conferência aprovada para os dados
  atuais`) e a conta fica "Confira e mova à mão", com o título no Omie.
- O Financeiro registra o lançamento à mão pelo diálogo "Lançado no Omie", ou
  move a conta para fora de "em lançamento omie", durante o ciclo. A ponte lança
  mesmo assim. Com o lançamento humano feito no Omie com outro
  `codigo_lancamento_integracao`, o resultado são **dois títulos**.
- Alguém marca "Integração manual = Manual" durante o ciclo. A guarda de D6-04
  (l. 798) leu o snapshot e a ponte lança.

Isso viola o invariante do cabeçalho do arquivo: "Sem Conferência aprovada,
nenhuma requisição a `/lancar`" só vale para o estado de minutos atrás. A
cutucada (D6-12) não resolve: com um ciclo em voo, ela só agenda o próximo.
**Correção:** reler o estado da conta imediatamente antes do `/lancar` e abortar
se qualquer condição mudou. O melhor é gravar uma marca de "lançamento em curso"
numa Unidade de Trabalho, para que o diálogo manual e as mudanças de Status a
vejam:
```ts
// em momentoDoLancamento, logo antes de chamar(CAMINHO_LANCAR, …)
const fresco = await hidratarEstado();
const atual = fresco.tasks.find((t) => t.id === task.id);
const confAtual = atual ? conferenciaDoResumo(fresco, atual) : undefined;
if (
  !atual || atual.lifecycle !== "ativo" || atual.statusId !== CP.status.emLancamento ||
  !confAtual || confAtual.estado !== "conferida" || confAtual.conferencia?.id !== conferida.id ||
  confAtual.impressaoAtual !== conferida.origin.impressao ||
  valorDoCampo(atual, CP.fields.integracaoManual) === "Manual" || !entrouPorMovimento(fresco, atual)
) {
  estadoPorConta.delete(task.id); // reavalia no próximo ciclo, sem chamar o Omie
  return;
}
// e montar corpoLancarDe(atual, …) a partir de `atual`, não de `task`
```

### CR-02: `reaproveitado: true` vira "✅ Lançado no Omie" da Conferência atual sem verificar que o título existente corresponde aos dados conferidos

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:978-994`, `:559-560`; `packages/dominio/src/operations/financeiro.ts:1196-1272`
**Problema:** a chave de idempotência é fixa por Tarefa (`tria:contas-a-pagar:<taskId>`).
Do lado do `automation/`, `consultarPorCodigoDeIntegracao` devolve
`reaproveitado: true` antes de olhar veredito, valor ou fornecedor
(`contas-a-pagar-lancamento.ts`, passo 4, `anexos: []`). A plataforma registra
esse título como lançamento da Conferência vigente, imprimindo a tripla
CONFERIDA, sem nenhuma comparação. Sequência realista:
1. O `/lancar` cria o título com Valor X.
2. O registro falha (CR-01, conflito ×3, ou `TEXTO_SAIU_ANTES_DO_REGISTRO`).
3. Alguém corrige o Valor para Y. A ponte republica o Resumo e o Financeiro confere Y.
4. O novo `/lancar` devolve o título antigo com X, e a conta vai para "lançado
   omie" com "✅ Lançado no Omie — título … (título já existia)".

O `TEXTO_SAIU_ANTES_DO_REGISTRO` ainda promete "eu registro sem lançar de
novo", mesmo que os dados mudem. O Omie fica com valor, vencimento ou categoria
errados, e a plataforma afirma o contrário.
**Correção:** na primeira confirmação do Omie, gravar na conta (ou na
Conferência) a impressão que foi lançada: `impressaoLancada`, com o `payableId`.
Ao receber `reaproveitado: true`, só registrar se a impressão conferida atual
for igual à lançada. Senão, parar com um aviso ("o título {id} já existe no
Omie com outros dados; exclua-o ou ajuste-o no Omie antes de lançar de novo").
Outra opção é o `automation/` devolver valor/vencimento/categoria do título
existente para a ponte comparar com o corpo.

### CR-03: o classificador do fio aprova respostas que pedem mudança, e a aprovação pode levar direto ao `/lancar`

**Arquivo:** `packages/dominio/src/operations/financeiro.ts:947-979`; `apps/api/src/automacoes/invocar-agente.ts:859-880`
**Problema:** o passo (3) aprova quando QUALQUER cláusula contém uma palavra de
aprovação. Não importa o resto da mensagem. Resultados verificados (rodando a
função exportada):
```
"O valor está certo, mas o vencimento é dia 15" => aprovacao
"sim, mas o fornecedor é outro"                  => aprovacao
"ok, só falta o boleto"                          => aprovacao
"certo o valor mas a conta é Itaú"               => aprovacao
"👍 mas a categoria é comercial"                 => aprovacao
"pode lançar dia 20"                             => aprovacao
```
D6-02 diz que "qualquer outra resposta de um revisor é pedido de ajuste". Todas
essas são pedidos de ajuste. `lerRespostas` converte a resposta em
`decideProcessApproval(aprovada, source: "comment")` em nome do revisor. Se a
conta já está em "em lançamento omie" (Resumo republicado porque os dados
mudaram lá, ou `RESUMO_A_PARTIR_DE=em-lancamento-omie`), o ciclo seguinte chama
o `/lancar` sem nenhum outro gesto humano. Os testes (`conferencia-do-resumo.test.ts:400-416`)
só cobrem frases curtas e inequívocas. Falta o caso misto.
**Correção:** só aprovar quando a mensagem inteira for uma aprovação. Todas as
palavras normalizadas devem estar num conjunto de aprovação mais conectivos
curtos ("pode", "lancar", "seguir", "obrigado", "tudo"), com um teto de
palavras (ex.: ≤ 4). Qualquer palavra fora dele vira `ajuste`, como o próprio
Fluxo 6 define:
```ts
const PERMITIDAS = new Set([...PALAVRAS_DE_APROVACAO, ...COMPLEMENTOS_DE_PODE, "pode", "tudo", "obrigado", "obrigada", "pra", "para"]);
const soAprovacao = palavras.length > 0 && palavras.length <= 4 && palavras.every((p) => PERMITIDAS.has(p));
if (soAprovacao || (palavras.length === 0 && /^[\s👍✅]+$/u.test(texto))) return "aprovacao";
return "ajuste";
```
Acrescentar os seis casos acima como `→ ajuste` em `conferencia-do-resumo.test.ts`.

### CR-04: decidir uma Conferência por clique emite `solicitacao.aprovacao-decidida.v1` para uma Conta a pagar

**Arquivo:** `apps/api/src/rotas/operacoes.ts:58-75` (alcançado pela Fase 6 via `:282-306`)
**Problema:** `eventosDeSaidaDaOperacao` emite o evento de Solicitação para
QUALQUER `ApprovalRequest` com `origin.kind === "processTask"`. A Fase 6 criou
um segundo ramo desse tipo (`processStep: "resumo"`) e não filtrou o evento.
Cada clique em "Conferido, pode lançar" ou "Pedir ajuste" (card, fila ou
jornada) grava no outbox um `solicitacao.aprovacao-decidida.v1` com o `taskId`
da Conta a pagar e `decision: "aprovada" | "rejeitada"`. O outbox entrega isso
em `/webhooks/plataforma/aprovacao-decidida`, que vai a
`handlePlatformApprovalDecision`. Esse handler tenta pôr a tarefa em
"aprovado"/"não aprovado" e, na rejeição, publica o aviso de reprovação da
Solicitação (S6). Hoje só a busca `GET /payment-requests/:taskId`, que devolve
404 fora da Lista de Solicitações, impede o efeito. O resultado é um recibo em
erro ou dead-letter por clique e um contrato de evento violado. Se essa guarda
do outro repositório mudar, a Conta a pagar recebe S5/S6.
**Correção:**
```ts
if (nome === "decideProcessApproval") {
  const aprovacao = entrada.valor as ApprovalRequest;
  if (entrada.eraReplay || aprovacao.origin.kind !== "processTask") return [];
  if (aprovacao.origin.processStep !== "pagamento") return []; // Conferência do Resumo não é Solicitação
  …
}
```
Acrescentar em `operacoes-eventos.test.ts` o caso "decisão de Conferência não
emite evento".

## Avisos

### WR-01: `AGENTE_CONTAS_A_PAGAR_AVISAR_ID` falha aberto, e G3 não exige G2

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:686-698`, `:753`; `packages/dominio/src/operations/financeiro.ts:358-361`; `apps/api/src/index.ts:136-148`
**Problema:** se o id estiver digitado errado, apontar para um Membro removido
ou for desativado depois, `avisarDoCiclo` devolve `undefined` e toda Menção
volta para o Financeiro real. O teste `invocar-agente.test.ts:1353-1365`
confirma que ela vai para `MARYANE`. O aviso sai uma vez por processo, só em
log. É exatamente a porta de ambiente de teste que deveria impedir que Menções
cheguem a uma pessoa real. Além disso, nada impede subir a ponte com
`AVISAR_ID` e sem `SO_TITULOS_COM`. Nesse caso a ponte publica Resumos em TODAS
as contas reais completas e faz o Membro de teste aprovador delas (o Financeiro
real, se não for Administrador, perde os botões).
**Correção:** quando `avisarId` está configurado e não é Membro ativo, NÃO
escrever nada no ciclo (retornar antes do laço, com `warn`). Em `index.ts`,
recusar subir com `AVISAR_ID` definido e `SO_TITULOS_COM` vazio, ou exigir os
dois juntos. Inverter a expectativa do teste 1353.

### WR-02: regressão na chave da ponte: Campos fora da impressão prendem a conta para sempre

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:731-737`, `:798-811`
**Problema:** antes, a chave era `JSON.stringify([task.fieldValues, dueDate, tagIds, statusId, …])`,
que cobria todos os Campos (versão `00040c5`, l. 251-253). Agora ela usa
`impressaoDeLancamento`, que por desenho exclui os Campos de arquivo (Anexo,
Boleto, QR Code) e "Integração manual". Consequências:
- Uma conta em "em lançamento omie" que falha em `erpMissingFields` por uma
  exigência de saída do Status (Boleto/QR Code, via `unmetRequirements`,
  `financeiro.ts:239-241`) recebe "Preencha e eu tento de novo". Depois do
  upload, a chave não muda, e a conta fica parada até o processo reiniciar.
- Uma conta que teve "Integração manual = Manual" (`parada = "manual"`) e depois
  foi desmarcada nunca recebe Resumo até o processo reiniciar.
**Correção:** a chave da ponte não precisa ser a impressão de lançamento.
Acrescentar a ela os Valores dos Campos de arquivo, o Campo de Integração
manual e a contagem de `task.attachments`, ou voltar a usar `task.fieldValues`
inteiro junto com a impressão.

### WR-03: "Responda no fio com o código e confira de novo" é um beco sem saída; um Resumo `ausente` pode ser conferido

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:556-557`, `:964-966`; `packages/dominio/src/operations/ai.ts:401-449`; `apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx:314-318`, `:344-362`
**Problema:** `TEXTO_SEM_CODIGO_CONFERIDO` pede uma resposta no fio. Só que a
Conferência já está `aprovada`, e `respostasDeConferenciaPendentes` devolve `[]`
quando há decisão. A resposta nunca é lida. A chave também não muda (WR-02), e
a conta fica parada até algum dado da impressão mudar. A causa: o domínio e a
tela deixam conferir um Resumo com `veredito: "ausente"` (código de
preenchimento `9.99.99`). O próprio card diz "peça o ajuste" e mostra o botão
"Conferido, pode lançar".
**Correção:** recusar no domínio a aprovação de uma Conferência com
`veredito === "ausente"` (ou código fora de `d.dd.dd`) com "Peça ajuste com o
código da Categoria". Na tela, esconder "Conferido" nesse caso. Trocar o texto
da ponte para orientar a pedir ajuste.

### WR-04: só a ÚLTIMA resposta do fio é lida; pedidos de ajuste anteriores se perdem, e "✅"/"⚠️" humanos são descartados

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:860-866`; `packages/dominio/src/operations/financeiro.ts:893-910`
**Problema:** `respostasDeConferenciaPendentes(...).at(-1)` descarta as
respostas anteriores. Dois casos:
- "mude a categoria para comercial" seguido de "pode ver?" (ignorado): o
  `respostaLida` marca a pergunta, e o ajuste nunca é processado.
- "troque o vencimento" de um revisor e "ok" de outro no mesmo intervalo de
  ciclo: o ajuste pedido some sem registro.

Além disso, o filtro de `PREFIXOS_DO_PROCESSO` descarta qualquer resposta
HUMANA que comece com ✅/⚠️/🔁/📋. Ex.: "⚠️ o valor está errado" é um pedido de
ajuste ignorado em silêncio, e "✅" sozinho é aprovação no classificador mas
nunca chega a ele.
**Correção:** percorrer as respostas pendentes em ordem, e a primeira `ajuste`
decide (ajuste tem precedência sobre aprovação no mesmo lote). Para excluir as
mensagens do processo, usar a autoria e a forma canônica exata
(`/^✅ Resumo conferido por /`, `/^🔁 Ajuste pedido por /`) em vez do prefixo
de emoji.

### WR-05: o Resumo pede "responda ok", mas a tela não tem gesto de resposta em fio; "ok" como Comentário raiz é ignorado em silêncio

**Arquivo:** `packages/dominio/src/operations/financeiro-textos.ts:41-46`; `packages/dominio/src/operations/financeiro.ts:903`; `apps/web/src/features/tarefa/timeline.tsx` (sem "Responder"); `apps/web/scripts/jornada-financeiro.mjs:45-48`
**Problema:** a própria jornada registra que "o tópico da tela não tem o gesto
'Responder'". O Financeiro que segue a instrução do Resumo escreve "ok" como
Comentário raiz. A ponte só lê respostas com `parentCommentId === threadCommentId`,
e nada acontece, sem nenhum retorno. D6-02 fica inalcançável pela
interface.
**Correção:** acrescentar "Responder" no fio do Resumo, ou tratar um Comentário
raiz de revisor publicado depois do Resumo vigente como resposta ao fio. Até
lá, mudar o texto da chamada para apontar o botão do card.

### WR-06: as Conferências poluem a métrica D-10 (fallback por comentário da Solicitação)

**Arquivo:** `apps/api/src/observabilidade/metricas.ts:243-245` (alcançado pela Fase 6)
**Problema:** a métrica filtra `origin.kind === "processTask"` e agora conta
Conferências do Resumo, inclusive as "dispensas" do Membro de serviço
(`source: "click"`). A razão "por comentário / total" que decide desligar o
fallback da Solicitação passa a medir outro processo.
**Correção:** `.filter((a) => a.origin.kind === "processTask" && a.origin.processStep === "pagamento")`.
Revisar também os outros consumidores de `processTask` que assumem Solicitação
(ver IN-01).

### WR-07: os avisos de "uma vez por chave/impressão" moram em memória; cada reinício repete os Comentários com Menção

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:651-653`, `:784-787`, `:846-851`, `:903-908`
**Problema:** `estadoPorConta` é um `Map` do processo. Depois de um reinício
(deploy, `vite-node --watch`, crash), a ponte comenta de novo, mencionando o
Financeiro:
- `TEXTOS_DA_CONFERENCIA.modoConferencia` (a especificação diz "uma vez por
  impressão") em toda conta conferida em "em lançamento omie";
- `textoDaRecusaDoResumo`, que com D6-01 passou a valer também para contas em
  "para pagar";
- `TEXTO_NASCEU_EM_LANCAMENTO` em toda conta importada em "em lançamento omie".
**Correção:** antes de comentar, verificar no fio se o mesmo texto já foi
publicado pelo Agente para a impressão ou Conferência atual. Outra opção é
persistir a parada, por exemplo como Registro de Atividade com a chave.

### WR-08: `decideProcessApproval` confere uma Conferência desatualizada: publica "✅ Resumo conferido" e resolve o fio

**Arquivo:** `packages/dominio/src/operations/ai.ts:401-449`
**Problema:** o ramo `resumo` não verifica que a Conferência é a vigente para a
impressão atual. Um clique a partir de uma tela velha, da fila ou da API numa
Conferência pendente cujos dados já mudaram grava a aprovação, publica
"✅ Resumo conferido por X" e resolve o fio. A tela diz "Os dados mudaram".
O dinheiro não se move (o estado continua `desatualizada`), mas o histórico
passa a afirmar uma conferência de dados que não são os da conta.
**Correção:** no ramo `resumo`, recusar com "Os dados da conta mudaram depois
deste Resumo; aguarde o Resumo novo" quando
`impressaoDeLancamento(state, task) !== origin.impressao`. Para evitar o ciclo
de importação, calcular a impressão numa função pura em `financeiro-textos.ts`,
ou receber a verificação por parâmetro.

### WR-09: a conta corrente conferida não é enviada nem imposta no `/lancar`

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:971`
**Problema:** D6-10 diz que a tripla conta · categoria · código é DADO da
Conferência. O corpo do `/lancar` só leva `codigoCategoriaConfirmado`. A conta
corrente é resolvida de novo pelo `automation/` a partir de `tagDaConta` no
momento do lançamento. Se o de-para de contas mudar entre o Resumo e o
lançamento, o Omie recebe uma conta que o Financeiro não conferiu. O
"✅ Lançado no Omie — … · {conta}" ainda imprime a conta conferida.
**Correção:** enviar a conta conferida (campo aditivo v1.1 ou v1.2) e fazer o
`automation/` recusar se ela divergir da resolvida. Outra opção é incluir no
Resumo o código da conta e comparar com o `dePara` devolvido pelo `/lancar`.

### WR-10: `registrarFalhaDoLancamento` não é tudo-ou-nada

**Arquivo:** `packages/dominio/src/operations/financeiro.ts:1290-1333`
**Problema:** a função move o Status (com Registro) ANTES de tentar o
Comentário. Se `addTaskComment` falhar, ela devolve `fail` com o Status e o
Registro já alterados. A Unidade de Trabalho faz rollback no `apps/api`, mas o
contrato do domínio ("recusa sem efeito") fica violado para qualquer outro
chamador. A função também não aplica `guardasDoAgente` (alcance do ator e
concessão do Agente), ao contrário das irmãs.
**Correção:** montar o Comentário primeiro, ou guardar `antes` e desfazer como
`registrarLancamentoNoOmie` faz. Trocar as guardas manuais por `guardasDoAgente`.

### WR-11: "Falha no ciclo" registra a mensagem crua da exceção, fora da lista fechada de T-3-04

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:1058`; também `:882`, `:891`, `:947`, `:1017`
**Problema:** `erro.message.slice(0, 200)` vai direto ao log. Pode vir de
`hidratar`, de `pg` (mensagens com valores de coluna), de `resolverAtor` ou de
uma exceção do domínio. Os `r.error.slice(0, 200)` das outras linhas carregam
mensagens do domínio que citam `displayName` ("já foi aprovada por Maryane…").
O resto do arquivo usa `sanitizarErro`.
**Correção:** `const e = sanitizarErro(erro, "CICLO"); registrar("warn", "…", { workspaceId, listId, code: e.code, summary: e.summary })`,
e registrar só um código fixo para as recusas do domínio.

### WR-12: `momentoDoResumo` publica sobre o estado fresco com um de-para resolvido para o snapshot

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:896-950`; `packages/dominio/src/operations/financeiro.ts:1070-1093`
**Problema:** o `/resolver` recebe a Categoria do snapshot. A publicação roda
em `s` (fresco) e grava `impressao` e tripla do estado fresco. Se a Categoria
mudou no intervalo, a Conferência nasce com a impressão nova e uma tripla
`ausente` ou sem relação com a nova Categoria. Com `pedidoDeRevisao`, a
idempotência de `publicarResumoParaConferencia` é desligada: se o estado
fresco já não está `ajuste-pedido` (outra ponte viva, ver a nota de `index.ts`
sobre duas pontes), o Resumo revisado sai em dobro e cancela o que acabou de
nascer.
**Correção:** dentro da operação, recusar sem efeito quando
`impressaoDeLancamento(s, taskFresca) !== impressaoDoSnapshot`, ou quando
`pedido` existe e a Conferência vigente fresca não é a mesma `rejeitada` do
snapshot.

## Info

### IN-01: o raiz do fio do Resumo recebe a pílula "Pedido de aprovação"

**Arquivo:** `apps/web/src/features/tarefa/timeline.tsx:143-150`, `:190`
**Problema:** `comentariosDeRoteamento` inclui qualquer `processTask`, então o
`📋 RESUMO DE PAGAMENTO` aparece rotulado como pedido de aprovação da Solicitação.
**Correção:** filtrar `processStep === "pagamento"` ou rotular "Conferência do Resumo".

### IN-02: a exceção de `resolveTaskComment` vale para aprovadores de Conferências antigas ou canceladas, e também reabre

**Arquivo:** `packages/dominio/src/operations/tasks.ts:1583-1588`
**Problema:** basta ter sido aprovador de qualquer Conferência daquele fio, mesmo
`cancelada`. Isso inclui o Membro de teste de `AVISAR_ID` de uma rodada antiga.
**Correção:** limitar à Conferência vigente, ou a quem está em `revisoresDoResumo`.

### IN-03: "sem anexos (título já existia)" engana no `reaproveitado`

**Arquivo:** `packages/dominio/src/operations/financeiro-textos.ts:52-58`
**Problema:** o `automation/` devolve `anexos: []` no reaproveitamento. O texto
diz "sem anexos", mesmo que os anexos tenham subido (ou falhado) no primeiro envio.
**Correção:** com `reaproveitado`, omitir a parte de anexos ou dizer "anexos do primeiro envio".

### IN-04: a cutucada não cobre `moveTask`, `restoreTask`, `trashTask` e `createTask`

**Arquivo:** `apps/api/src/rotas/operacoes.ts:107-116`
**Problema:** uma conta criada completa, restaurada ou movida para a Lista espera
o relógio (15 min). Isso não é incorreto, mas é inconsistente com D6-12.
**Correção:** acrescentar as operações ao conjunto.

### IN-05: os testes não cobrem as rotas de falha acima

**Arquivo:** `apps/api/src/automacoes/invocar-agente.test.ts:1353-1365`; `packages/dominio/src/operations/conferencia-do-resumo.test.ts:400-416`; `apps/api/src/rotas/operacoes-eventos.test.ts`
**Problema:** o teste de G3 trava o fail-open (WR-01). Nenhum teste muda o
estado entre a hidratação e o `/lancar` (CR-01). Nenhum testa
`reaproveitado` com dados divergentes (CR-02), respostas mistas no
classificador (CR-03) ou evento de saída para Conferência (CR-04). Os títulos
dos testes existentes correspondem ao que eles afirmam.
**Correção:** acrescentar um caso por achado crítico. Para CR-01, um
`hidratarEstado` injetado que devolve um estado diferente na segunda chamada.

---

_Revisado em: 2026-09-30T00:38:29Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
