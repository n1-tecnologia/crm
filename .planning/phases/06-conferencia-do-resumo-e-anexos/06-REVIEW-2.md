---
phase: 06-conferencia-do-resumo-e-anexos
reviewed: 2026-09-30T14:54:38Z
depth: standard
diff_base: 8635e01
files_reviewed: 44
files_reviewed_list:
  - packages/dominio/src/operations/ai.ts
  - packages/dominio/src/operations/financeiro-base.ts
  - packages/dominio/src/operations/financeiro-textos.ts
  - packages/dominio/src/operations/financeiro.ts
  - packages/dominio/src/operations/tasks.ts
  - packages/dominio/src/operations/classificador-estrito.test.ts
  - packages/dominio/src/operations/conferencia-desatualizada-recusada.test.ts
  - packages/dominio/src/operations/conferencia-do-resumo.test.ts
  - packages/dominio/src/operations/conferencia-sem-codigo.test.ts
  - packages/dominio/src/operations/falha-do-lancamento-tudo-ou-nada.test.ts
  - packages/dominio/src/operations/falha-supera-conferencia.test.ts
  - packages/dominio/src/operations/publicar-resumo-estrito.test.ts
  - packages/dominio/src/operations/resolver-fio-do-resumo.test.ts
  - packages/dominio/src/operations/respostas-em-lote.test.ts
  - packages/dominio/src/operations/textos-do-lancamento.test.ts
  - apps/api/src/automacoes/invocar-agente.ts
  - apps/api/src/automacoes/anexos-da-conta.ts
  - apps/api/src/index.ts
  - apps/api/src/observabilidade/metricas.ts
  - apps/api/src/persistencia/unidade-de-trabalho.ts
  - apps/api/src/rotas/classificacoes.ts
  - apps/api/src/rotas/operacoes.ts
  - apps/api/src/testes/fixtures-da-ponte.ts
  - apps/api/src/automacoes/anexos-da-conta-limites.test.ts
  - apps/api/src/automacoes/contrato-contas-a-pagar-ponte.test.ts
  - apps/api/src/automacoes/contrato-contas-a-pagar.test.ts
  - apps/api/src/automacoes/invocar-agente.test.ts
  - apps/api/src/automacoes/ponte-ciclo.test.ts
  - apps/api/src/automacoes/ponte-contrato-v12.test.ts
  - apps/api/src/automacoes/ponte-dominio-estrito.test.ts
  - apps/api/src/automacoes/ponte-lancar-fresco.test.ts
  - apps/api/src/automacoes/ponte-portas-e-paradas.test.ts
  - apps/api/src/observabilidade/metricas-aprovacoes.test.ts
  - apps/api/src/persistencia/unidade-de-trabalho-trava.test.ts
  - apps/api/src/persistencia/unidade-de-trabalho.test.ts
  - apps/api/src/rotas/operacoes-conferencia.test.ts
  - apps/api/src/rotas/operacoes-eventos.test.ts
  - apps/web/src/features/tarefa/timeline.tsx
  - apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx
  - apps/web/src/app/(shell)/ia/aprovacoes/page.tsx
  - apps/web/src/features/tarefa/timeline-responder.test.tsx
  - apps/web/src/features/tarefa/painel-conferencia-no-fio.test.tsx
  - apps/web/scripts/jornada-financeiro.mjs
  - contratos/contas-a-pagar-v1/README.md
findings:
  critical: 1
  warning: 5
  info: 6
  total: 12
status: issues_found
---

# Fase 6 (rodada de fechamento 06-11..06-14): Relatório de Code Review

**Revisado em:** 2026-09-30T14:54:38Z
**Profundidade:** standard, com rastreamento pontual entre domínio, ponte e rotas
**Escopo:** `git diff 8635e01..HEAD -- packages apps contratos`, sem `.planning`, docs e `.env*`
**Arquivos revisados:** 44
**Status:** issues_found

## Resumo

Esta rodada fecha a maior parte do 06-REVIEW:

- O classificador ficou estrito.
- A decisão confere a impressão, e o Resumo sem código não é aprovado.
- A ponte relê o estado antes do `/lancar` e monta o corpo a partir da releitura.
- As Conferências não emitem mais evento de Solicitação nem entram na métrica.
- A porta G3 fecha a ponte no começo do ciclo.
- A chave da ponte cobre arquivos e a Integração manual, e as paradas são restauradas do fio.
- `registrarFalhaDoLancamento` passou a ser tudo ou nada.
- A tela ganhou "Responder".

Confirmei por execução, sem banco:

- Rodei os testes novos do domínio, da api e da web: 191 casos, todos verdes. A api rodou com `DATABASE_URL=`.
- Rodei 40 frases no classificador. Nenhuma frase mista aprova.
- Rodei duas sondas com as fixtures da ponte, descritas abaixo. Os arquivos temporários foram removidos.

Sobra um caminho real para o `/lancar` sem conferência humana (CR-01): a
dispensa D6-04, feita pelo Membro de serviço, continua valendo depois que a
Integração manual é desmarcada. A sonda confirmou: 1 `/lancar`, e a conta foi
para "lançado omie". Os avisos tratam de:

- a janela de dupla emissão durante o `/lancar`, que ficou menor mas continua aberta;
- a dependência cega do `automation/` v1.2 no `reaproveitado`;
- a divergência entre quem pode conferir por clique e quem pode conferir pelo fio;
- um resto de falha aberta de G3 no meio do ciclo;
- o orçamento de gravações, que pode matar de fome as contas do fim da lista e girar sem espera.

A mudança de persistência (`statement_timeout` e `lock_timeout` no `begin`,
55P03 tratado como conflito) é segura para todos os chamadores de `executar()`
que verifiquei. Todos já tratam `conflito`. As ressalvas estão em IN-02 e IN-05.

## Achados estruturais (fallow)

Não foram fornecidos achados estruturais para esta revisão.

## Achados narrativos (revisor de IA)

## Situação dos achados do 06-REVIEW

| Id | Situação | Evidência |
|---|---|---|
| CR-01 | **Parcialmente fechado** | `momentoDoLancamento` (`invocar-agente.ts:1512-1584`) relê o Espaço, chama `motivoParaNaoLancar` (`:629-654`) e monta o corpo a partir de `atual`. Os testes (a)–(j) de `ponte-lancar-fresco.test.ts` passam. Não entrou a marca persistida de "lançamento em curso": a janela durante o `/lancar` continua aberta (WR-01). Há também um caminho novo de lançamento sem conferência humana (CR-01 abaixo). |
| CR-02 | **Fechado no lado da ponte; depende do `automation/`** | O 422 `TITULO_EXISTENTE_DIVERGENTE` é tratado (`motivoDosDetalhes`, `:377-392`, e `falhaPermanente`, sem superar a Conferência). Mas a ponte confia 100% no `reaproveitado` e não compara o `dePara` devolvido (WR-02). |
| CR-03 | **Fechado** | Classificador estrito (`financeiro.ts:899-930`). Os seis contraexemplos e mais 34 frases minhas dão `ajuste`/`ignorar`. Casos como "ok pra itau", "pode pagar para a konq", "ok 🙂", "ok, sem pressa" e "ok\ntroca a conta" dão `ajuste`. |
| CR-04 | **Fechado** | `operacoes.ts:67` (lista de permissão `processStep === "pagamento"`), `classificacoes.ts:108-111` e `:206`. Teste em `operacoes-conferencia.test.ts` (a)/(b). A rota de comentário por serviço (`integracao-solicitacoes.ts:305-322`) só alcança a Lista de Solicitações. |
| WR-01 | **Fechado, com resto** | O ciclo para com `AVISAR_ID_INVALIDO` (`:1173-1180`), `index.ts:138-141` recusa subir com AVISAR_ID sem SO_TITULOS_COM, e `motivoParaNaoLancar` confere de novo. Resto em WR-04. |
| WR-02 | **Fechado** | `chaveDaPonte` (`:974-989`) leva todos os Valores ativos e os `fileId` dos anexos. |
| WR-03 | **Fechado** | Recusa no domínio (`ai.ts:427`). Card e fila escondem "Conferido" (`faltaCodigoDaCategoria`). A ponte responde `recusaSemCodigo` no fio. |
| WR-04 | **Fechado** | `decisaoDasRespostasPendentes` (`financeiro.ts:821-836`): o primeiro ajuste vence. O filtro passou a ser por autoria e por `FORMAS_CANONICAS_DO_FIO`. |
| WR-05 | **Parcialmente fechado** | "Responder" entrou no `Timeline`, e a doca avisa. Mas a promessa "responda ok" continua incondicional e falha em silêncio em dois casos reais (WR-03). |
| WR-06 | **Fechado** | `aprovacoesDaSolicitacao` (`metricas.ts:260-264`). |
| WR-07 | **Fechado, com resto** | O fio é a memória (`ultimaParadaNoFio`, `ultimaMudancaHumana`, `avisoDoModoNoFio`). `comentarioPendente` segue só em memória, e o aviso de reserva `textoDaRecusaPermanente` não é padrão de parada (IN-03). |
| WR-08 | **Fechado** | `ai.ts:426`: `recusaDesatualizada` nas duas decisões, depois da repetição idempotente. |
| WR-09 | **Fechado no lado da ponte** | `contaConfirmada` vai no corpo (`:1580`). `CONTA_DIVERGENTE` supera a Conferência. Ressalva de ordem de implantação em WR-02. |
| WR-10 | **Fechado** | `guardasDoAgente` entrou. A ordem é aviso → Status → desfazer e republicar → Registro (`financeiro.ts:1310-1372`). Conferi que `changeTaskStatus` recusa antes de qualquer mutação. |
| WR-11 | **Fechado** | O ciclo e as recusas do domínio só vão ao log como código fixo (`codigoDaFalhaDoCiclo`, `:1736`, `:1393`, `:1406`, `:1501`, `:1638`). Os logs de ensaio com conta/categoria já existiam e o review anterior os aceitou. |
| WR-12 | **Fechado** | `impressaoEsperada` e `conferenciaRejeitadaId` no domínio (`financeiro.ts:1058-1063`), mais o `adiado` dentro da operação (`:1452-1460`). |
| IN-01 | **Fechado** | `comentariosDeRoteamento` devolve o passo, e a pílula mostra "Conferência do Resumo" (`timeline.tsx:152-160`, `:210-211`). |
| IN-02 | **Fechado** | `resolveTaskComment` só vale para a Conferência vigente e só para resolver (`tasks.ts:1590-1594`). |
| IN-03 | **Fechado** | `trechoDosAnexos` (`financeiro-textos.ts:56-66`). |
| IN-04 | **Fechado** | Seis operações novas no conjunto (`operacoes.ts:124-129`). `createTask` usa o valor. |
| IN-05 | **Fechado em grande parte** | Há um caso por achado, com mutação registrada nos SUMMARY. As lacunas estão em IN-06. |

## Problemas críticos

### CR-01: a dispensa D6-04 (Membro de serviço) sobrevive a desmarcar "Integração manual" e leva ao `/lancar` sem conferência humana

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:1299`, `:1316-1322`, `:1464-1489`, `:629-654` (`motivoParaNaoLancar`, l. 648); `packages/dominio/src/operations/financeiro-base.ts:125-155` (`impressaoDeLancamento`)

**Problema:** sob `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL=sem-conferencia`,
uma conta Manual recebe o Resumo com o Membro de serviço como aprovador, e a
própria ponte a aprova (`MOTIVO_DA_DISPENSA`). A Integração manual NÃO faz
parte da impressão de lançamento, por desenho. Por isso, quando o Financeiro
desmarca "Manual" (o sinal de "agora quero conferir"), a Conferência
dispensada continua `conferida` para a impressão atual. `motivoParaNaoLancar`
só olha Manual sob `nao-encosta` (l. 648) e não distingue uma aprovação humana
de uma dispensa. Ao entrar em "em lançamento omie", a conta é lançada no Omie
sem que nenhuma pessoa tenha conferido o Resumo.

Sonda (fixtures da ponte, `servidorFalso`, sem banco):
```
apos 1o ciclo: conferida Conferência dispensada (Integração manual) aprovador= mem_thiago
Manual desmarcado: conferida
/lancar chamados: 1 status: st_cp_lancado
```
O mesmo acontece se o dono voltar ao padrão `nao-encosta` depois de um período
em `sem-conferencia`: a dispensa antiga continua valendo para uma conta que já
não é Manual.

Há também uma corrida. A decisão de dispensar usa o `manual` do SNAPSHOT
(l. 1299), dentro da operação de `momentoDoResumo` (l. 1466) e no ramo
`pendente` (l. 1321), e não o estado fresco `s`. Se Manual for desmarcado
entre a hidratação e a gravação, a impressão não muda, então não há `adiado`,
e a dispensa sai do mesmo jeito.

**Correção:** uma dispensa só vale enquanto a conta for Manual e o modo for
`sem-conferencia`. Faça a verificação no ponto de decisão e na releitura antes
do `/lancar`:
```ts
// motivoParaNaoLancar, depois de SEM_CONFERENCIA_APROVADA:
const dispensada = conferencia.decisionReason === MOTIVO_DA_DISPENSA && conferencia.decisionSource === "click"
  && conferencia.decidedByMemberId === conferencia.approverMemberId; // melhor: um campo explícito na origem
const manualAgora = valorDoCampo(atual, CP.fields.integracaoManual) === "Manual";
if (dispensada && !(manualAgora && criterio.integracaoManual === "sem-conferencia")) return "DISPENSA_SEM_MANUAL";
```
Nesse caso, supere a Conferência dispensada (como em `superarConferencia`),
para que saia um Resumo humano. Dentro das operações, troque `manual` por
`valorDoCampo(fresca, CP.fields.integracaoManual) === "Manual"`. O mais
robusto é marcar a dispensa no DADO (por exemplo, `origin.dispensa: true` ou
`decisionSource: "dispensa"`) em vez de comparar o texto do motivo. Um teste
por caminho: desmarcar Manual depois da dispensa, e desmarcar Manual entre a
leitura e a gravação.

## Avisos

### WR-01: a janela de dupla emissão durante o `/lancar` continua aberta (resto de CR-01 anterior)

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:1537-1584`, `:1606-1619`

**Problema:** a releitura reduziu a janela de minutos para o tempo de assinar
até 20 URLs somado ao `/lancar` (até 60 s). O que o review anterior pediu, uma
marca persistida de "lançamento em curso", não entrou. Um humano que registra
"Lançado no Omie" pelo diálogo, ou lança à mão no Omie, nesse intervalo
continua produzindo dois títulos. A ponte só percebe depois
(`saiuAntes` → `TEXTO_SAIU_ANTES_DO_REGISTRO`), quando o segundo título já existe.

**Correção:** antes do `/lancar`, grave numa Unidade de Trabalho uma marca na
conta, por exemplo um Registro "Lançamento em curso" com a chave de
idempotência e um prazo. Com ela:
- `registrarLancamentoManual` (o diálogo) recusa, ou pede confirmação;
- a tela mostra "o Agente está lançando esta conta";
- a marca é removida no registro ou na falha.

No mínimo, a tela deve avisar enquanto a marca existir.

### WR-02: no `reaproveitado`, a ponte não confere nada, e falha aberta contra um `automation/` v1.1

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:1590-1611`, `:1577-1582`

**Problema:** a correção de CR-02 mora inteira no `automation/` (06-08:
comparar o título existente e devolver 422). A ponte trata
`reaproveitado: true` como sucesso e ignora o `dePara` LIDO DO TÍTULO, que o
contrato v1.2 passou a devolver justamente para isso (README, "v1.2 — o que é
conferido"). Com o `automation/` de produção ainda em v1.1, a ponte não tem
como saber a versão, e o cenário exato de CR-02 continua aberto: título velho
registrado como lançamento da Conferência nova. Há também o problema inverso
de implantação: o produtor é `.strict()`. Um `automation/` v1.1 recusa
`contaConfirmada` com 400 `SCHEMA_INVALIDO`, e cada conta vira falha
permanente e volta para "para pagar" com Menção.

**Correção:** com `reaproveitado: true`, exija `corpo.dePara` e compare
`dePara.codigo`/`dePara.conta` com `confAtual.origin.lancamento`. Se o
`dePara` estiver ausente ou divergir, não registre: pare com um aviso que cite
o título. Documente no `apps/api/README.md` a ordem de implantação: o
`automation/` v1.2 sobe ANTES desta ponte.

### WR-03: "responda ok no fio" falha em silêncio para quem a tela manda responder

**Arquivo:** `apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx:403`; `packages/dominio/src/operations/financeiro-textos.ts:68`; `packages/dominio/src/operations/financeiro.ts:786-794`; `apps/api/src/automacoes/invocar-agente.ts:1375-1377`, `:1390-1393`

**Problema:** o card, a doca e o próprio Resumo prometem que um "ok" no fio
confere. Três casos fazem a promessa falhar sem retorno nenhum. É o mesmo
efeito silencioso da lacuna original:

1. **Aprovador de G3 (`AVISAR_ID`) sem papel de Administrador.** Ele é o
   `approverMemberId`, e `podeConferirOResumo` lhe mostra os botões e o texto
   "responda ok". Mas `respostasDeConferenciaPendentes` só aceita
   `revisoresDoResumo` (Financeiro e Administradores), então a resposta dele
   nunca é lida.
2. **Maryane sob G3.** A resposta dela é lida (ela é revisora), mas
   `decideProcessApproval` recusa: ela não é a aprovadora nem Administradora.
   A ponte grava só `RESPOSTA_RECUSADA_PELO_DOMINIO` no log e marca a resposta
   como lida. Confirmei na sonda: a Conferência continua `pendente`.
3. **`AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO=false`.** O "ok" vira
   `nenhum` e `respostaLida` (l. 1375-1377). O texto do Resumo
   (`PEDIDO_DE_CONFERENCIA`) e o do card continuam pedindo "ok".

**Correção:** o conjunto de quem decide pelo fio tem de ser igual ao de quem
decide pelo clique. Filtre as respostas por
`mayDecideApproval(approverMemberId)` (aprovador ou Administrador), não por
`revisoresDoResumo`, ou inclua o aprovador designado nos revisores daquela
Conferência. Quando a resposta for recusada ou ignorada por configuração, a
ponte deve responder no fio uma vez ("Esta resposta não confere: use o botão
do card") em vez de só registrar no log. Com a decisão por comentário
desligada, o texto do Resumo e o do card não podem sugerir "ok": passe a
opção ao domínio/texto, ou exponha a configuração no `/estado`.

### WR-04: G3 ainda falha aberto no meio do ciclo

**Arquivo:** `packages/dominio/src/operations/financeiro.ts:334-337` (`avisadoDaConferencia`); `apps/api/src/automacoes/invocar-agente.ts:1249-1258`, `:1475`, `:1481`, `:1657-1662`

**Problema:** a verificação de `AVISAR_ID` roda uma vez, sobre o snapshot do
começo do ciclo (l. 1173). Se o Membro de teste for desativado depois disso,
as gravações seguintes do mesmo ciclo passam por `avisadoDaConferencia`, que
cai em silêncio na regra de sempre:
- `publicarResumoParaConferencia` faz a Maryane aprovadora e a menciona;
- `registrarFalhaDoLancamento` e a resposta `recusaSemCodigo` mencionam a Maryane.

Esse é exatamente o fail-open que WR-01 fechou no nível do ciclo. Já
`comentar` passa o id de `avisar` direto, sem conferir se o Membro está ativo:
um Membro inativo recebe a Menção. O `/lancar` está protegido
(`motivoParaNaoLancar`), mas as Menções e o aprovador, não.

**Correção:** dê à porta de teste uma forma estrita no domínio, por exemplo
`opcoes.avisarEstrito: true`: com `avisarId` inativo, a operação recusa sem
efeito em vez de cair na Maryane. Em `comentar`, recuse quando
`!membroAtivo(s, avisar)` dentro da operação.

### WR-05: o orçamento de gravações mata de fome as contas do fim da lista e gira sem espera

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:1198-1211`, `:1285-1288`, `:1259-1263`

**Problema:** o laço percorre as contas sempre na mesma ordem (`state.tasks`).
Uma conta parada com `comentarioPendente` tenta de novo o Comentário a cada
ciclo, e cada tentativa custa uma gravação. Se o Comentário falhar sempre (por
exemplo, Agente pausado: `addTaskComment` recusa "O Agente autor precisa
existir e estar ativo"; ou Convidado sem concessão), 20 contas assim esgotam
o orçamento em todos os ciclos. As consequências:
- as contas depois delas nunca são processadas;
- `cutucar()` vira `repetir` e dispara o próximo ciclo IMEDIATAMENTE, sem o
  atraso da cutucada;
- cada ciclo hidrata o Espaço inteiro e abre 20 transações;
- o resultado é um laço quente contra o banco, que era exatamente o problema
  que 06-13 queria resolver.

**Correção:**
- não conte, no orçamento, a repetição de `comentarioPendente`, ou limite-a
  (uma tentativa a cada N ciclos, ou desistir depois de 3 e registrar o código);
- comece o laço de onde o ciclo anterior parou (cursor rotativo), para não
  haver fome;
- quando o orçamento esgotar, agende a continuação com `atrasoDaCutucadaMs`
  (ou recuo), não com `repetir` imediato.

## Info

### IN-01: depois de `CONTA_DIVERGENTE`, o Resumo novo abre um fio NOVO, com o texto de primeira chamada

**Arquivo:** `packages/dominio/src/operations/financeiro-base.ts:94-102`; `packages/dominio/src/operations/financeiro.ts:1083`, `:1348-1362`

**Problema:** `superarConferencia` cancela a Conferência vigente. Com a nova
regra de `conferenciaVigente` (se a mais recente está cancelada, não há
vigente), `publicarResumoParaConferencia` fica com `anterior` indefinido e
publica um Comentário RAIZ novo, com o sufixo `chamada` em vez de
`dadosMudaram`. O fio antigo continua resolvido e com a pílula "Conferência do
Resumo", e a conta passa a ter dois fios de Resumo. Isso contradiz o
contrato do tipo ("o raiz do fio do Resumo — o primeiro Resumo publicado na
conta").
**Correção:** ao publicar, procure o fio pela Conferência mais recente da
conta, mesmo cancelada. Use o sufixo `dadosMudaram`, ou um texto próprio de
"conta corrente mudou".

### IN-02: `executar()` sobe a revisão em operações que não fazem nada

**Arquivo:** `apps/api/src/persistencia/unidade-de-trabalho.ts:143-172`; `apps/api/src/automacoes/invocar-agente.ts:1460`, `:1609`

**Problema:** os ramos `adiado` e `saiuAntes` devolvem `ok(undefined)` sem
mutar nada. Mesmo assim, `executar` faz o `update ... revisao + 1` e grava uma
diferença vazia. Cada adiamento força a tela a reidratar e disputa a trava com
ela, justamente o que 06-13 quis reduzir.
**Correção:** devolva uma recusa sentinela (`fail("ADIADO")`), que faz
`rollback` sem subir a revisão, e trate-a na ponte. Outra opção é `executar`
pular o `update` quando a diferença for vazia.

### IN-03: o aviso de reserva `textoDaRecusaPermanente` não é padrão de parada

**Arquivo:** `apps/api/src/automacoes/invocar-agente.ts:863-876`, `:1665-1668`

**Problema:** quando `registrarFalhaDoLancamento` é recusado, a ponte comenta
`textoDaRecusaPermanente`. Depois de um reinício, esse texto não restaura a
parada: a ponte chama o `/lancar` de novo e publica outro Comentário com Menção.
**Correção:** inclua `textoDaRecusaPermanente(CURINGA_TEXTO, CURINGA_CODIGO)`
em `PADROES_DAS_PARADAS` e no caso (k) do teste.

### IN-04: código morto na jornada

**Arquivo:** `apps/web/scripts/jornada-financeiro.mjs:330-331`

**Problema:** `pedirAjustePeloCard` ficou sem uso e está silenciado com
`eslint-disable`.
**Correção:** remova a função, ou crie o cenário `cp-ajuste-pelo-card` que a use.

### IN-05: os prazos novos do `begin` valem para todos os chamadores

**Arquivo:** `apps/api/src/persistencia/unidade-de-trabalho.ts:100-113`, `:150-167`

**Problema:** revisei os chamadores de `executar()`: rotas, ponte, agendador,
importadores (`importar-contas-a-pagar`, `importar-contas-a-receber`,
`financeiro/importar`), bootstrap e formulários públicos. Todos já tratam
`conflito`, então transformar 55P03 em conflito é seguro. Ficam duas
consequências:
1. `statement_timeout` = 0,8·Q é mais estrito que antes para o `gravar` em
   lote dos importadores e para `aoConfirmar`. Uma instrução entre 0,8·Q e Q,
   que antes passava, agora falha com 57014.
2. O `lock_timeout` vale para QUALQUER instrução da transação. Um 55P03 fora
   do `update` da revisão sobe como exceção (500), não como 409. Exemplos:
   `consumirSessao ... for update`, ou a hidratação durante uma DDL.

**Correção:** documente em `persistencia/CONTEXT.md` que importação longa roda
com `DATABASE_QUERY_TIMEOUT_MS=0`. Se quiser, trate 55P03 em
`formularios-publicos` como 409.

### IN-06: lacunas de teste

**Arquivo:** `apps/api/src/automacoes/ponte-lancar-fresco.test.ts`; `apps/api/src/automacoes/ponte-portas-e-paradas.test.ts`

**Problema:** nenhum teste cobre:
- a dispensa depois de desmarcar Manual (CR-01);
- o "ok" do aprovador de G3, ou da Maryane sob G3 (WR-03);
- o Membro de G3 desativado no meio do ciclo, antes de uma publicação (WR-04);
- o orçamento com Comentários pendentes que falham sempre (WR-05).

Os títulos dos testes novos correspondem ao que afirmam. Rodei 191 casos,
todos verdes.
**Correção:** acrescente um caso por achado acima, com a mutação que o
derruba.

---

_Revisado em: 2026-09-30T14:54:38Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
