# automacoes

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

O RELÓGIO do motor de Automações (AUTO-01): quem chama
`runScheduledAutomations` (`packages/dominio/src/operations/automations.ts`)
pelo menos uma vez por (Espaço de Trabalho, Lista, dia civil). Nenhuma regra
de negócio mora aqui — o que uma Automação faz, quando ela dispara e a
idempotência de "isto já rodou" são de `@n1/dominio`. Esta pasta só garante
que a chamada acontece.

| Arquivo | O que faz |
|---|---|
| `scheduler-worker.ts` | `criarSchedulerWorker()` — o poller: lease por `for update skip locked` sobre `plataforma.automacao_agenda`, catch-up do dia perdido, Ator de sistema, e o gate da primeira volta em ensaio. |
| `scheduler-worker.test.ts` | Os 19 casos (item Wave 0 de `03-VALIDATION.md`) — puros (a)-(e) e (s), os demais contra Postgres real. |
| `scheduler-worker-drenagem.test.ts` | 10-REVIEW MEDIUM-05, sem banco (`pool()` falso que falha): a volta que rejeita vai para o log (`Volta do relógio falhou.`) e não derruba o processo; `semear()` que falhou é tentada de novo no mesmo dia. |
| `liberar.cli.ts` | CLI fino de liberação da primeira volta em ensaio — só compõe `liberarLista()`. |
| `invocar-agente.ts` (Plan 03-11; plano pós-auditoria 1.4; Plan 06-03) | `criarPonteDoAgente()` — a ponte HTTP do Agente de lançamento em DOIS momentos (Fase 6): publica o Resumo para conferência (`/resolver`), lê o fio, e só lança (`/lancar`, com o código conferido e os anexos) com a Conferência aprovada; e entrega ao scheduler acima uma `rodarAgenda` que nunca lança. |
| `invocar-agente.test.ts` | Puros e HTTP contra `servidorFalso` — todos sem `DATABASE_URL`; o cabeçalho do arquivo diz onde cada caso de 06-03 é provado. |
| `anexos-da-conta.ts` (Plan 06-03) | `anexosDaConta()` — os arquivos dos Campos Anexo/Boleto/QR Code e da Tarefa como `{ url, nome }` (URL assinada de 5 min, gerada logo antes do `/lancar`, nunca em log). |
| `ponte-ativa.ts` (Plan 06-03) | `registrarPonte()`/`cutucarPonte()` — o registro da ponte no processo, para a rota de operações cutucá-la (D6-12). |
| `contrato-contas-a-pagar-ponte.test.ts` | A ponte em dois momentos contra os exemplos canônicos v1/v1.1 do produtor. |

## Por que não é fila, e por que a tabela existe

A Automação de agenda não cruza limite de processo: `runScheduledAutomations`
é uma função pura chamada dentro da MESMA transação da Unidade de Trabalho
(`executar()`, `../persistencia/unidade-de-trabalho.ts`). O outbox
(`../persistencia/outbox-worker.ts`) existe para o que SAI do processo depois
do commit — por isso `scheduler-worker.ts` copia a FORMA do outbox (lease,
trava de concorrência única, classificação de erro, `sanitizarErro()`) e não
o seu papel de negócio: não há fila nova e não há watermark novo.

`plataforma.automacao_agenda` (03-01, `005-agenda-de-automacoes.sql`) não é
fonte de idempotência — essa continua em `AutomationExecution`/`jaRodou`, no
domínio. A tabela existe para duas coisas que só o banco dá: exclusão mútua
entre instâncias do `apps/api` (a reivindicação é `for update skip locked`) e
auditoria de "o dia foi processado" (uma linha `falhou`, ou `processando` com
`locked_at` vencido, é o sinal de que o processo caiu antes de fechar o dia).

## O vocabulário de `last_error_code`

A coluna se chama `last_error_code` porque é a que 03-01 criou; aqui ela
carrega o "motivo do último evento não rotineiro daquele dia" — uma coluna
`motivo` dedicada seria o refinamento óbvio numa migração futura (as
migrações são numeradas e imutáveis, DEC-10, e `005` já está aplicada).
`CODIGOS_DA_AGENDA` (`scheduler-worker.ts`) é o vocabulário fechado:

| Código | Quem escreve | Significa |
|---|---|---|
| `MARCO_ZERO` | Plan 03-10, ao terminar a importação histórica | Fixa o dia em que a agenda desta Lista começa a contar — nenhum dia anterior nasce. |
| `ENSAIO_PRIMEIRA_VOLTA` | `scheduler-worker.ts` | A primeira volta REAL desta (Espaço, Lista) mediu e não gravou — ver seção abaixo. |
| `LEASE_EXPIRADO` | `scheduler-worker.ts` | Uma linha `processando` tinha `locked_at` mais velho que `leaseMs`: o processo caiu antes de fechar o dia. |
| `RECUSA_DO_DOMINIO` | `scheduler-worker.ts` | `runScheduledAutomations`/`executar()` devolveram `ok: false` sem conflito de revisão (ex.: falta a concessão de `administrar`). |
| `CONFLITO_DE_REVISAO` | `scheduler-worker.ts` | `executar()` devolveu `{ conflito: true }` — transitório, a próxima volta tenta de novo. |
| `ERRO_INESPERADO` | `scheduler-worker.ts` | Exceção não classificada durante o processamento da linha. |
| `SEM_ATOR` | `scheduler-worker.ts` | Nenhum Membro ativo administra esta Lista (`atorDoRelogio` devolveu `undefined`): o relógio não tem quem assine — ver "Quais Listas o relógio visita". |

Quem lê `last_error_code`/`last_error_summary` para qualquer fim — log, CLI,
tela futura — importa `CODIGOS_DA_AGENDA` em vez de repetir os literais.

## A primeira volta em ensaio (Task 2, D3-03)

As contas importadas por 03-09/03-10 que ficam em `para pagar` com
vencimento no passado satisfazem `hoje >= disparo` em qualquer dia civil
futuro. Sem gate, a primeira volta do agendador sobre a Lista de Contas a
pagar dispararia A5/A6 (Comentário de cobrança) e A7 (invocação do Agente)
em lote, no dia seguinte à importação — nenhuma das contas importadas
autorizou isso, e não é um comportamento que se desfaz depois.

A primeira volta REAL de cada (Espaço, Lista) — a que `primeiraVoltaPendente`
identifica pela ausência de qualquer linha `concluido` cujo `last_error_code`
não seja `MARCO_ZERO` nem `ENSAIO_PRIMEIRA_VOLTA` — roda em ENSAIO: `rodarAgenda`
é chamada dentro da transação (o cálculo acontece de verdade), as contagens
são capturadas, e o resultado é forçado a `ok: false` para que a Unidade de
Trabalho desfaça tudo (`unidade-de-trabalho.ts`, o mesmo caminho de rollback
de uma recusa legítima do domínio). A linha fecha `concluido` com
`last_error_code = 'ENSAIO_PRIMEIRA_VOLTA'` e as contagens do que TERIA
acontecido — nunca `failures[].title`/`.reason` (T-3-04).

Enquanto existir uma linha de ensaio não liberada para um par, `semear()` não
cria dia novo para ele — a Lista fica parada, visível, esperando gente.
Liberar é ato explícito:

```
npm run automacoes:liberar -w @n1/api -- <workspaceId> <listId>
```

`liberarLista()` só apaga o `last_error_code = 'ENSAIO_PRIMEIRA_VOLTA'` das
linhas daquele par — nunca toca `MARCO_ZERO` e nunca toca outro par. Depois de
liberada, a volta seguinte processa de verdade. `ensaioNaPrimeiraVolta: false`
(opção do worker) desativa o gate inteiro — a porta para uma Lista que nasce
sem backlog e não precisa do ritual.

## Quais Listas o relógio visita (Fase 10)

Até a Fase 9 o relógio só visitava Listas com Automação por vencimento. Desde
10-05 (D-01, 2.1.2 escolha A) ele também gera, sozinho, a próxima ocorrência da
**Recorrência por calendário** — o botão da Lista deixa de ser a única forma
(10-16 o retira, depois de isto estar publicado e ligado em produção).

**As fontes do catálogo** (`catalogoDeListasComAgenda`, `scheduler-worker.ts`).
São CANDIDATAS: SQL barato sobre `plataforma.registros`, sem repetir regra de
negócio; o domínio decide o que de fato roda, dentro do `executar()`.

1. Lista com Automação `ativo`, de escopo Lista, com versão publicada de gatilho `condicaoTemporal`.
2. Lista com Tarefa de `recurrence.triggerMode = porCalendario` (coluna gerada `list_id`, migração 002).

3. Lista com Tarefa na lixeira (`lifecycle = naLixeira`, `candidatosDaLixeira`) — o
   expurgo pela retenção é relógio da Lista (PARD-10). **Decisão do dono no
   checkpoint Q3 (10-15, 2026-10-29): `direto`**, depois de ver a prévia de
   produção (65 Tarefas vencidas, todas em Espaços de teste; 0 no Espaço real e
   0 em Contas a pagar/receber). A Lista que entra SÓ pela lixeira roda a
   primeira volta sem ensaio, e a primeira volta real elimina de vez o que já
   passou da retenção. O registro está em `10-PROVAS.md`, na pasta da fase.

As fontes se unem num só `Map` de pares (Espaço, Lista): uma linha de agenda
por par e dia, venha ele de onde vier.

**Um Espaço por worker, obrigatório** (10-REVIEW MEDIUM-08). `workspaceId` é
exigido por `criarSchedulerWorker` (vazio lança) e `../index.ts` só liga o
agendador com `AUTOMACOES_ESPACO_ID` preenchido (`escopoDoAgendador`): a volta
expurga a lixeira vencida sem ensaio (Q3 = direto), e um worker sem filtro
alcançaria todos os Espaços do banco, os de teste inclusive. A prévia continua
podendo olhar todos (só lê).

**A prévia, só leitura** (`previa.ts`, `npm run automacoes:previa -w @n1/api [-- <workspaceId>]`).
Por (Espaço, Lista) candidata imprime nome da Lista, por onde entra (automação,
recorrência, lixeira), regime (`ensaio`/`direto`), o Membro que assinaria
(`atorDoRelogio`) ou `sem ator`, a contagem de Tarefas vencidas na lixeira
(`tarefasDaLixeiraVencidas`, a mesma regra de `purgeExpiredTasks`) e a de séries
por calendário. Hidrata cada Espaço em transação `read only` que termina em
rollback, não contém DML e nunca imprime título de Tarefa (T-3-04). É o comando
dos checkpoints Q3 e D-04: rodar contra produção ANTES de ligar
`AUTOMACOES_WORKER_ATIVO=true`.

**A ponte compõe os três relógios** (F4). A `rodarAgenda` da ponte do Agente de
lançamento (`invocar-agente.ts`) chama `agendaDoDia` nos dois ramos: para a
Lista dela com as opções da ponte (`cnpjPorEmpresa`, `lancamento`) repassadas a
`runScheduledAutomations`, para todas as outras sem opções. Com
`AGENTE_CONTAS_A_PAGAR_ATIVO=true` a Recorrência por calendário e o expurgo
também rodam pela agenda (antes só rodava a Automação por vencimento).

**O ator, por Lista** (`atorDoRelogio`, domínio — `agenda-do-relogio.ts`).
`runScheduledAutomations` e `runCalendarRecurrences` recusam quem não administra
a Lista, e o Agente do pipeline só administra Contas a pagar e a receber. Em vez
de alargar as concessões dele — o Agente do pipeline é também a credencial de
serviço usada por HTTP externo, e `administrar` em todo Espaço ampliaria o raio
dela (T-10-14) —, o ator é escolhido DENTRO do `executar()`, por Lista, sobre o
estado hidratado: o PREFERIDO (`resolverAtor`: o Agente do pipeline, ou
`AUTOMACOES_ATOR_MEMBER_ID`) se ele administra a Lista; senão o Proprietário do
Espaço de Trabalho; senão o primeiro Membro ativo Proprietário ou Administrador
que a administra. Se o preferido nem resolve (não há Membro do Papel no
Espaço), a volta não cai: segue para o Membro humano. A Atividade "Próxima
ocorrência criada" passa a ser autoria desse Membro humano — **assunção a
confirmar com o dono no checkpoint D-04 do 10-16 (Q1/A1)**; se ele preferir
autoria "Sistema", a mudança é no domínio (variantes com `ActorRef`).

**`SEM_ATOR`.** Nenhum candidato administra a Lista (Espaço privado sem
concessão a ninguém, Proprietário e Administradores suspensos): a linha fecha
`falhou` com `SEM_ATOR`, nada é gravado, e `semear()` do dia seguinte cria só o
dia novo — a linha que já existe não é recriada. Resolver é dar `administrar`
a um Membro humano naquela Lista (ou reativar um Administrador).

Desde o 10-REVIEW (MEDIUM-07) a linha `falhou` não é reivindicada de novo na
mesma volta: `reivindicar()` só a devolve depois de um `intervaloMs` desde o
último `locked_at` (a lease vencida, com `locked_at` nulo, volta já). Um
`SEM_ATOR` tenta no máximo uma vez por volta, até `maxTentativas`, em vez de
gastar as três em sequência. E a Lista sem ator não fica só numa linha da
tabela: `automacoes:previa` (a prévia e o `--agenda`) termina com um alerta
`BLOQUEIO: N Lista(s) sem ator …` com o nome e o id de cada uma — o checkpoint
lê esse alerta como impeditivo.

**O regime, por Lista** (`regimeDaPrimeiraVolta`, domínio — D-02). O ensaio da
primeira volta (seção acima) existe para a Automação por vencimento, cujos
disparos em lote custam dinheiro ou mandam mensagem. A Lista que só tem
recorrência por calendário nasce **direto**: a série anda um passo por dia
processado e nunca gera o passado em lote. A Lista com Automação por vencimento
— inclusive a que tem as duas coisas — mantém o ensaio. A regra repete a de
`runScheduledAutomations` (Automação `ativo`, escopo Lista, última versão
publicada de gatilho `condicaoTemporal`) e mora no domínio, não no SQL nem no
worker. Lacuna aceita: uma Lista que ganha Automação por vencimento DEPOIS de
já ter voltas reais não volta ao ensaio.

**A volta drena** (`maxPorVolta`, padrão 200). `iniciar()` processa linhas em
sequência a cada `intervaloMs` até não haver reivindicável ou até o teto, em
vez de UMA linha por intervalo (F5: com dezenas de Listas a fila nunca esvaziava).
Uma volta em voo por vez (`emVoo`); `parar()` interrompe a drenagem entre duas
linhas — a linha em curso fecha, nenhuma fica presa em `processando`. Cada
linha ainda hidrata o Espaço inteiro: N Listas × dias de atraso é o pior caso e
conta para a Fase 12.

Pontos de extensão de teste (`OpcoesSchedulerWorker`): `escolherAtor` e
`escolherRegime` trocam as duas escolhas acima; em produção ficam ausentes.

## Onde a ponte pluga no agendador

A ponte do Agente (`invocar-agente.ts`) entra no worker por um caminho só: a
opção `rodarAgenda`, cuja assinatura é a do relógio do dia (tipo `RodarAgenda`,
exportado; a ponte a implementa por cima de `agendaDoDia`). Lease, catch-up, contabilidade da linha,
saneamento e o gate da primeira volta continuam intocados. Em `../index.ts`,
o bloco da ponte vem ANTES do bloco do agendador, porque este usa a
`rodarAgenda` daquela.

## Os dois momentos da ponte (Fase 6)

`06-CONTEXT.md` (D6-01..D6-04, D6-11, D6-12) em código. A cada ciclo — o
relógio (`AGENTE_CONTAS_A_PAGAR_INTERVALO_MS`, 15 min) ou uma cutucada —, a
ponte hidrata o Espaço só para LER e olha as contas ativas da Lista em "para
pagar" e "em lançamento omie" (ou só nesta, D6-01). Para cada conta:

1. **Integração manual** (D6-04): `nao-encosta` ⇒ nada (nem Resumo, nem
   `/lancar`, nem Comentário); `sem-conferencia` ⇒ segue, e a Conferência é
   dispensada pelo Membro de serviço (clique, motivo "Conferência dispensada
   (Integração manual)"; o próprio Membro de serviço é o aprovador, para
   ninguém ser chamado a conferir o dispensado). **Desde 06-18 (crm2:CR-01)
   a dispensa é do domínio e é dado:** `dispensarConferenciaDoResumo` confere
   "Manual" no estado da GRAVAÇÃO (nunca no `manual` do snapshot) e marca
   `decisionWaiver = "integracaoManual"`; a dispensa só vale enquanto a conta
   é "Manual". Desmarcada, o domínio vê a Conferência como `desatualizada`, e
   o ciclo seguinte publica um Resumo novo, no mesmo fio, para o Financeiro
   (ou o Membro de G3). Duas corridas, sem parada: "Manual" desmarcado entre
   a leitura do ciclo e a gravação do Resumo ⇒ `RESUMO_ADIADO`; no passo
   `pendente`, a dispensa recusada com `recusaDispensaSemManual` ⇒
   `DISPENSA_ADIADA` (outra recusa continua sendo
   `DISPENSA_RECUSADA_PELO_DOMINIO`, com parada).
2. **Faltando dado** (`erpMissingFields`): em "em lançamento omie", o pedido de
   sempre, uma vez; em "para pagar", silêncio (a conta está sendo preenchida).
3. **`conferenciaDoResumo`** do domínio diz onde a conta está.
4. **`pendente`** ⇒ as respostas dos revisores no fio são lidas EM LOTE pelo
   domínio (`decisaoDasRespostasPendentes`, 06-12, crm:WR-04): todas as
   pendentes contam, o primeiro ajuste vence a aprovação do mesmo lote, e a
   resposta que decide vira `decideProcessApproval(..., { source: "comment"
   })` em nome de quem a escreveu: aprovação ⇒ aprovada; ajuste ⇒ rejeitada
   com o texto; pergunta ou "vou verificar" ⇒ nada. Nada é relido enquanto não
   chega resposta nova. Com `CONFERENCIA_POR_COMENTARIO=false`, só o clique
   aprova — o fio continua pedindo ajuste (D6-02). Um "ok" que o domínio recusa
   por falta de código (`recusaSemCodigo`) recebe essa resposta no fio (log:
   `RESPOSTA_RECUSADA_PELO_DOMINIO`, nunca o texto da recusa). Numa conta
   Manual com `sem-conferencia`, a pendente COM código é dispensada; a SEM
   código segue o fio, como qualquer conta. **Quem confere pelo fio é quem
   confere pelo clique (06-18, crm2:WR-03):** o domínio lê só as respostas de
   quem `podeDecidirAConferencia` (alcança a conta e é o aprovador designado
   ou Administrador/Proprietário ativo) — o aprovador de G3 sem papel de
   Administrador confere respondendo "ok". E nenhum "ok" some em silêncio:
   `respostaSemEfeitoNoFio` devolve o "ok" de quem não confere
   (`okDeQuemNaoConfere(<aprovador>)`) e o "ok" de quem confere com a decisão
   por comentário desligada (`okPeloFioDesligado`), e a ponte responde no fio
   (log `RESPOSTA_SEM_EFEITO`). O fio é a memória: o domínio descarta a
   resposta já dada, e nada vai a `EstadoDaConta` — nem depois de um
   reinício a resposta sai duas vezes. Com `CONFERENCIA_POR_COMENTARIO=false`
   a publicação leva `aprovacaoPorComentario: false`: o Resumo pede a
   conferência pelo botão, e a Conferência guarda `aprovacaoPeloFio: false`,
   que o card e a doca da tela leem. **06-21 (crm2:WR-05 residual, 06-REVIEW-3
   WR-01):** `comentar()` devolve `Promise<boolean>` — verdadeiro só quando o
   Comentário foi DE FATO gravado —, e `RESPOSTA_SEM_EFEITO` só sai quando
   esse booleano é verdadeiro; falhando, nada é registrado (nem o log, nem a
   "resposta já dada"), e o ciclo seguinte tenta de novo. Depois de
   `TENTATIVAS_TRANSITORIAS` falhas SEGUIDAS para a MESMA resposta (pelo id do
   Comentário), a ponte desiste de responder A ELA (log `SEM_EFEITO_DESISTIDO`,
   nunca "respondeu por quê") — mas só dela: `estado.parada` nunca é tocado, e
   uma resposta nova ou uma decisão de verdade no mesmo fio continuam sendo
   lidas e processadas normalmente.
5. **`sem-resumo` | `desatualizada` | `ajuste-pedido`** ⇒ Momento 1: UM
   `/resolver` (com `pedidoDeRevisao` e, se o pedido citar um `d.dd.dd`,
   `codigoCategoriaConfirmado`) e UM `publicarResumoParaConferencia` (`motivo:
   "dados-mudaram"` quando desatualizada). Em `ensaio`, só o log. O Resumo só
   sai sobre o snapshot certo (06-12, crm:WR-12): dentro da gravação, se a
   impressão da conta mudou desde a leitura do ciclo — ou, num ajuste, a
   vigente não é mais a mesma Conferência `rejeitada` —, nada é publicado, a
   conta não é parada e o ciclo seguinte refaz o `/resolver`
   (`RESUMO_ADIADO`); a publicação leva `impressaoEsperada` e, no ajuste,
   `conferenciaRejeitadaId`, as guardas do domínio. Um Resumo sem código de
   Categoria (`lancamentoSemCodigo`, crm:WR-03) recebe, na mesma gravação, a
   resposta `TEXTOS_DA_CONFERENCIA.recusaSemCodigo` no fio, com Menção; numa
   conta Manual (`sem-conferencia`) ele sai como Conferência normal do
   Financeiro — a dispensa só vale para o Resumo com código.
6. **`conferida`, em "em lançamento omie", entrou por movimento** ⇒ Momento 2,
   só em `lancar`. **A releitura (06-12, crm:CR-01):** imediatamente antes de
   cada `/lancar`, a ponte relê o Espaço (`hidratarEstado`, a segunda leitura
   do ciclo) e pergunta de novo, sobre o estado de AGORA, tudo o que o laço
   perguntou (`motivoParaNaoLancar`): a conta existe na Lista
   (`CONTA_SUMIU`), está ativa (`INATIVA`), está em "em lançamento omie"
   (`SAIU_DE_EM_LANCAMENTO`), entrou por movimento
   (`NAO_ENTROU_POR_MOVIMENTO`), está no escopo (`FORA_DO_ESCOPO`), não é
   Manual sob `nao-encosta` (`MANUAL`), não tem lançamento humano registrado
   (`LANCAMENTO_HUMANO`), não é uma dispensa D6-04 numa conta que deixou de
   ser Manual (`DISPENSA_SEM_MANUAL`, em qualquer modo — 06-18, crm2:CR-01),
   e a Conferência vigente é `conferida`
   (`SEM_CONFERENCIA_APROVADA`) e é a mesma que o ciclo leu
   (`CONFERENCIA_TROCADA`). Qualquer código ⇒ zero `/lancar`, nenhum
   Comentário, a conta é esquecida e reavaliada no ciclo seguinte, e o log leva
   só o código; releitura que falha ⇒ falha transitória `RELEITURA_FALHOU`
   (sem a mensagem). O corpo sai do estado relido: `/lancar` (prazo 60 s,
   `Idempotency-Key` `tria:contas-a-pagar:<taskId>`) com
   `codigoCategoriaConfirmado` = o código da Conferência, **`contaConfirmada`
   = a conta que ela guardou** (contrato v1.2, crm:WR-09), `dataDeEmissao` e
   `anexos` = `anexosDaConta()` — no máximo `LIMITE_DE_ANEXOS` (20) por
   lançamento, na ordem Campos Anexo, Boleto, QR Code e anexos da Tarefa, sem
   URL acima de 2048 caracteres; o que passa do teto vira a contagem
   `anexosAcimaDoLimite` no log e, depois do registro, um Comentário no fio
   (`textoDosAnexosAcimaDoLimite`). Sucesso ⇒ `registrarLancamentoNoOmie`
   ("lançado omie") com os anexos da resposta casados pelo `nome` com os
   enviados (`ok`, `jaExistia`, e `erro` só da lista fechada `CodigoDoAnexo`;
   `url` e texto livre descartados) e `anexosPedidos` = o número enviado; se o
   domínio recusar o registro depois de o título existir, o aviso cita o id
   do título e termina em `Confira e mova à mão.`. Falha permanente ⇒
   `registrarFalhaDoLancamento` (volta a "para pagar", D6-03); os dois 422 da
   v1.2 levam os textos do domínio: `TITULO_EXISTENTE_DIVERGENTE` ⇒
   `tituloDivergente(payableId, campos)` e a Conferência FICA (corrige-se ou
   exclui-se o título no Omie e move-se a conta de novo, crm:CR-02);
   `CONTA_DIVERGENTE` ⇒ `contaDivergente(conferida, resolvida)` e a
   Conferência é SUPERADA (`superarConferencia`), para que o ciclo seguinte
   publique um Resumo novo com a conta corrente de agora; `details` que não
   servem ⇒ o motivo de sempre. `details` nunca vai ao log. Transitória ⇒
   contagem, e na terceira um aviso. Um Resumo conferido sem código de
   Categoria (`lancamentoSemCodigo` do domínio — só uma Conferência aprovada
   antes de 06-11) não vai ao Omie, e o aviso diz como sair: alterar a
   Categoria para sair um Resumo novo. Contrato: `06-GAPS-OUTLINE.md` § v1.2.
   **O reaproveitado conferido (06-18, crm2:WR-02):** com `reaproveitado:
   true`, antes do registro, `conferenciaDoReaproveitado` confere o `dePara`
   que o `automation/` v1.2 LEU DO TÍTULO contra a Conferência relida
   (`buildResumoDePagamento` sobre a conta relida: conta corrente e código).
   Diferente ⇒ falha permanente `TITULO_EXISTENTE_DIVERGENTE` com
   `tituloDivergente(payableId, campos)` (a Conferência fica); sem `dePara`
   (um `automation/` v1.1) ⇒ falha permanente `REAPROVEITADO_SEM_DE_PARA`
   (`motivoDoReaproveitadoSemDePara`). Nos dois, nada vira lançamento, a
   conta volta para "para pagar", e o log leva só `code` e `payableId`.
   **Ordem de implantação:** o `automation/` v1.2 sobe ANTES desta ponte
   (`apps/api/README.md` §5b) — com um v1.1, o `/lancar` com
   `contaConfirmada` volta 400 `SCHEMA_INVALIDO` em toda conta.
7. **`conferida` em "para pagar"** ⇒ nada: espera o humano mover.

| `AGENTE_CONTAS_A_PAGAR_MODO` (D6-11) | O que a ponte faz |
|---|---|
| ausente, vazio, ou qualquer valor que não seja um dos literais abaixo | `"ensaio"` (padrão): só `/resolver` e o log do que publicaria/lançaria — nenhum Comentário, nenhuma decisão, nenhum Status. |
| `"conferencia"` (literal, exato) | Resumos, leitura do fio, revisões e dispensas — e **zero** requisições a `/lancar`: com a conta conferida em "em lançamento omie", comenta uma vez `Resumo conferido. Neste ambiente o lançamento no Omie está desligado (modo conferência)…`. |
| `"lancar"` (literal, exato) | Tudo, inclusive o `/lancar` — só com Conferência aprovada para os dados atuais. |

Os modos que gravam exigem `PLATAFORMA_LANCAMENTO_TOKEN` e
`AGENTE_CONTAS_A_PAGAR_URL`; sem eles, nenhuma requisição.

| Variável | Valores (padrão primeiro) | Decisão |
|---|---|---|
| `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE` | `para-pagar` \| `em-lancamento-omie` | D6-01 |
| `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO` | `true` \| `false` | D6-02 |
| `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL` | `nao-encosta` \| `sem-conferencia` | D6-04 |
| `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM` | vazio \| um texto | G2 (só teste) |
| `AGENTE_CONTAS_A_PAGAR_AVISAR_ID` | vazio \| id de Membro | G3 (só teste) |

Valor desconhecido nas três primeiras ⇒ o padrão, com aviso que nomeia a
variável. A linha de partida do log diz `modo=…`, `resumoAPartirDe=…`,
`escopo=todas` ou `escopo=titulos-com:"…"`, e `avisar=financeiro|membro-indicado`.

**A cutucada (D6-12).** Depois de `setTaskFieldValue`, `updateTask`,
`changeTaskStatus`, `addTaskComment`, `setTaskTags`, `resolveTaskComment`,
`decideProcessApproval` ou `alterarStatusEmLote` — e, desde 06-13 (crm:IN-04),
`createTask`, `moveTask`, `trashTask`, `restoreTask`, `attachFile` e
`removeAttachment` (os anexos entraram na chave, crm:WR-02) — com sucesso
numa Tarefa do par da ponte, `rotas/operacoes.ts` chama `cutucarPonte()` —
DEPOIS do commit, nunca dentro da transação, e sem lançar. Em `createTask` o
par vem da Tarefa criada (o valor da operação), não da entrada. A ponte roda um ciclo em até 2 s; N
cutucadas nesse intervalo viram um ciclo, e uma cutucada durante um ciclo em
voo vira exatamente um ciclo a mais, logo depois dele. `parar()` cancela a
cutucada pendente.

**A parada por chave.** A regra "uma vez só" de 1.4 continua. Uma recusa
comentada para a conta até a chave dela mudar.

A chave é `chaveDaPonte` e junta:
- `impressaoDeLancamento` do domínio (D6-10);
- o Status;
- o Registro da última mudança de Status;
- a Conferência vigente e a sua decisão;
- desde 06-13 (crm:WR-02), TODOS os Valores de Campo ativos, como pares
  [definição, valor] ordenados;
- os `fileId` dos anexos da Tarefa.

A impressão sozinha não bastava. Ela deixa de fora os Campos de arquivo e a
Integração manual, mas `erpMissingFields` também pede o que as exigências de
saída do Status pedem (Boleto, QR Code), e a Integração manual decide a parada
`manual`. Com a chave larga, subir o arquivo que faltava ou desmarcar Manual
destrava a conta sem reiniciar o processo. Um Comentário não muda a chave.

**A parada sobrevive ao reinício: o fio é a memória (06-13, crm:WR-07).**
`estadoPorConta` mora no processo, e antes cada reinício (deploy, crash)
repetia os Comentários com Menção.

Agora, na PRIMEIRA vez que o processo vê a conta, a ponte procura o aviso de
parada mais recente do Agente. Esse aviso é:
- um Comentário do Agente, não apagado;
- cujo texto casa com um dos `PADROES_DAS_PARADAS`, padrões ancorados
  montados a partir das próprias funções de texto.

Os padrões cobrem os textos que `parar()` publica e o `falhaSemVolta` do
domínio. Se esse aviso é posterior a `ultimaMudancaHumana`, a parada é
restaurada, sem requisição e sem Comentário, com um log `PARADA_RESTAURADA`.
`ultimaMudancaHumana` é o mais recente entre:
- os Registros de Atividade da Tarefa feitos por um Membro que não é o de
  serviço;
- a criação da Conferência vigente;
- a decisão dela, quando não foi o Membro de serviço quem decidiu.

No mesmo milissegundo, a sequência do id desempata.

O aviso de reserva `textoDaRecusaPermanente` (quando o domínio recusa o
registro da falha) também restaura a parada: ele tem exatamente a forma de
`falhaSemVolta` sem recusa, e o padrão dela o cobre — um padrão a mais faria
o texto casar com dois. O caso (n) de `ponte-reaproveitado-conferido.test.ts`
trava a igualdade das duas formas e o reinício sem `/lancar` novo (06-18,
crm2:IN-03).

`TEXTOS_DA_CONFERENCIA.falha` fica FORA dos padrões de propósito. Nesse caso a
conta voltou para "para pagar", e não há parada a restaurar: depois de
`CONTA_DIVERGENTE`, o Resumo novo tem de sair mesmo depois de um reinício.

Com o processo vivo, a chave decide como sempre. Uma parada restaurada também
cai quando a chave muda.

**O aviso do modo `conferencia`** sai uma vez por ENTRADA em "em lançamento
omie". A regra: se o fio da Conferência já tem esse aviso do Agente, publicado
depois do mais recente entre o último "Status alterado" e a decisão da
Conferência, ele não sai de novo. Não sai depois de um reinício, nem quando um
Campo fora da impressão muda a chave. Sair e voltar faz um Registro novo, e o
aviso volta.

**As guardas para ambiente de teste (desvios G1–G3 de 06-03, dirigidos pelo
orquestrador).** A prova de 06-06 roda esta ponte em `conferencia` contra
`ws_n1`, onde estão as contas reais importadas do ClickUp (03-09/03-10) e a
Maryane real:

- **G1 — o legado importado nunca é varrido.** Conta com `provenance.kind ===
  "import"` só entra na ponte depois de um movimento de Status feito AQUI,
  posterior a `provenance.at` (a régua de `entrouPorMovimento`,
  `movidaDepoisDaImportacao` — no domínio, `@n1/dominio/operations/financeiro`,
  porque a tela usa a mesma para não mostrar "Aguardando Resumo" numa conta
  que a ponte nunca varrerá). Sem isso, zero `/resolver` e zero Comentários
  (em qualquer modo); o ciclo só registra a CONTAGEM, quando ela muda. A
  única exceção é a de sempre: em `lancar`, a importada que está em "em
  lançamento omie" recebe, uma vez, o pedido de conferir no Omie
  (`TEXTO_NASCEU_EM_LANCAMENTO`).
- **G2 — `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM`.** Definida, os DOIS momentos
  (e a leitura do fio) só olham contas cujo título contém o texto —
  comparação exata, maiúsculas contam (ex.: `TESTE AUTOMATIZADO`). Vazia
  (produção): todas.
- **G3 — `AGENTE_CONTAS_A_PAGAR_AVISAR_ID`.** Definida e Membro ATIVO no
  ciclo: toda Menção da ponte vai a esse Membro no lugar do Financeiro — o
  Resumo (e o aprovador da Conferência, `OpcoesDaConferencia.avisarId`), o
  aviso de falha (`registrarFalhaDoLancamento`, opção `avisarId`) e os
  Comentários da própria ponte. **A porta fecha (06-13, crm:WR-01):**
  definida mas não Membro ativo, a ponte NÃO AGE no ciclo (nenhuma
  requisição, nenhuma gravação, em qualquer modo) e avisa a cada ciclo com
  `AVISAR_ID_INVALIDO`, sem o id; a releitura antes do `/lancar` pergunta de
  novo (`motivoParaNaoLancar` ⇒ `AVISAR_ID_INVALIDO`). Antes, falhava aberto e
  mencionava o Financeiro real. E `AVISAR_ID` sem `SO_TITULOS_COM` nem deixa
  a API subir (`recusaDasPortasDeTeste`, em `index.ts`): sozinha, a ponte
  publicaria Resumos em todas as contas reais com um Membro de teste como
  aprovador.
  `revisoresDoResumo` NÃO muda: o Financeiro e os Administradores continuam
  revisores; com o aprovador trocado, decide por comentário quem for revisor
  E puder decidir (`mayDecideApproval`: o aprovador indicado ou um
  Administrador/Proprietário).

Produção deixa G2 e G3 vazias.

**A porta G3 estrita no meio do ciclo (06-19, crm2:WR-04).** A porta do
começo do ciclo olha o snapshot; o Membro de teste pode ser desativado
depois. Por isso a ponte passa `avisarEstrito: true` a
`publicarResumoParaConferencia` e a `registrarFalhaDoLancamento` sempre que há
`avisarId` (na dispensa, o `avisarId` é o próprio Membro de serviço), e todo
Comentário da ponte — `comentar` e a resposta `recusaSemCodigo` da
publicação — confere `membroAtivo(s, avisar)` DENTRO da operação. A recusa
(`TEXTOS_DA_CONFERENCIA.recusaAvisarInativo`) nunca cai na Maryane nem
menciona um Membro inativo: a ponte registra `AVISAR_ID_INVALIDO` (uma vez,
sem o id) e o laço para antes da próxima conta. No `comentar`, o texto fica
em `comentarioPendente` (sai quando a porta for arrumada, sem contar
tentativa); na publicação, nada é parado — o ciclo seguinte decide pela porta
do começo.

## O lançamento em curso (06-19, crm2:WR-01)

Antes de cada `/lancar`, depois do corpo e dos anexos assinados, a ponte
grava numa Unidade de Trabalho a marca "Lançamento no Omie em curso"
(`marcarLancamentoEmCurso`, do Agente em nome do Membro de serviço). A mesma
gravação confere de novo, sobre o estado DA GRAVAÇÃO: a impressão de
lançamento é a do corpo (senão `IMPRESSAO_MUDOU` — conferida primeiro, porque
depois de `motivoParaNaoLancar` a mudança já sairia como
`SEM_CONFERENCIA_APROVADA`) e `motivoParaNaoLancar` não tem nada a opor.
Qualquer diferença ⇒ `SEM_EFEITO`, log `info` "Lançamento adiado: a conta
mudou antes da marca." com o código, ZERO `/lancar`. Conflito ⇒ transitória;
outra recusa ⇒ parada com `MARCA_RECUSADA_PELO_DOMINIO`.

Enquanto a marca vale, o domínio recusa a qualquer OUTRO Membro mudar o
Status da conta e registrar o lançamento à mão (`RECUSA_LANCAMENTO_EM_CURSO`,
em `changeTaskStatus` e `addTaskComment`), e a tela diz que o Agente está
lançando. A marca sai:
- no registro ("Lançado no Omie") e na falha permanente registrada
  ("Lançamento no Omie falhou") — Registros do domínio;
- em "Lançamento no Omie interrompido" (`encerrarLancamentoEmCurso`, o `code`
  no `detail`): falha transitória do `/lancar` (o `code` da resposta),
  `payableId` ausente ou `mock-` (`LANCAMENTO_NAO_CONFIRMADO`), saída antes do
  registro (`SAIU_ANTES_DO_REGISTRO`), registro recusado
  (`REGISTRO_RECUSADO_PELO_DOMINIO`), o conflito do registro que vira parada
  (`CONFLITO_DE_REVISAO`) e a falha permanente cujo registro foi recusado (o
  `code` da falha). Se o encerramento falhar, só o log
  (`MARCA_NAO_ENCERRADA`);
- no prazo (`PRAZO_DO_LANCAMENTO_EM_CURSO_MS`, 5 min), se a ponte morrer.

No conflito do registro que ainda vai ser repetido, e num erro de BANCO
depois do 200, a marca FICA: o título existe, e a repetição com a mesma chave
(que renova a marca) o registra. Em `ensaio` e `conferencia` nenhuma marca é
gravada. O residual fora da plataforma (alguém lançando direto no Omie
durante o `/lancar`) não passa por regra nenhuma do CRM: a tela avisa, e o
`automation/` compara o título existente no próximo `/lancar`.

**`SEM_EFEITO` (crm2:IN-02).** Os ramos que decidem, dentro da gravação, não
mudar nada — o Resumo adiado, a saída antes do registro e a marca adiada —
devolvem a recusa sentinela `SEM_EFEITO` (`"PONTE_SEM_EFEITO"`). A Unidade de
Trabalho desfaz sem o `update … revisao`: a tela não reidrata e ninguém
disputa a trava por uma gravação vazia. Os logs (`RESUMO_ADIADO`) e o
Comentário (`TEXTO_SAIU_ANTES_DO_REGISTRO`) são os de antes.

## O orçamento justo (06-19, crm2:WR-05)

- **Cursor rotativo.** Esgotado o orçamento (`maximoDeGravacoesPorCiclo`), a
  ponte guarda a conta que não foi processada; o ciclo seguinte começa por
  ela (a lista rodada, nunca pulando), e o laço que chega ao fim zera o
  cursor. A contagem G1 continua só no ciclo que termina o laço.
- **Continuação com espera.** O orçamento esgotado agenda o próximo ciclo
  pelo MESMO temporizador da cutucada (`atrasoDaCutucadaMs`, que `parar()`
  cancela), quando o ciclo em voo termina — nunca um `repetir` imediato (o
  laço quente contra o banco). O log `ORCAMENTO_DO_CICLO_ESGOTADO` fica.
- **Desistência do Comentário pendente.** Cada falha do Comentário do Agente
  que não é da porta G3 soma uma tentativa na conta (a chave nova zera); em
  `TENTATIVAS_TRANSITORIAS`, o pendente sai e a ponte registra `info`
  "Desisti de gravar o Comentário do Agente nesta conta." com
  `COMENTARIO_PENDENTE_DESISTIDO`. A parada continua; a chave nova a reabre.

## A ponte do Agente (`invocar-agente.ts`) — o que vem de 03-11 e 1.4

O registro histórico de antes da Fase 6. Onde divergir de "Os dois momentos
da ponte (Fase 6)" — sobretudo em (1): a ponte não lança mais ao entrar em
"em lançamento omie" sem Conferência, e o Resumo sai ANTES, pelo domínio —,
vale a seção de cima.

**(1) O gatilho é o Status, não o calendário** (plano pós-auditoria,
`docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md`, 1.4 e
1.5). A cada ciclo (`AGENTE_CONTAS_A_PAGAR_INTERVALO_MS`, padrão 15 min), a
ponte hidrata o Espaço só para LER e olha as contas ativas da Lista
configurada em "em lançamento omie". Para cada uma: confere o que o Omie
exige (`erpMissingFields`, a mesma regra da saída de "para pagar"), chama
`/resolver` (prazo 10 s) e `/lancar` (prazo 60 s, `Idempotency-Key`
determinística) e, com o lançamento confirmado, publica o Resumo e move a
conta para "lançado omie" numa Unidade de Trabalho só. Nenhuma chamada nasce
para conta em "para pagar": o antigo `aquecer()`, que chamava `/resolver`
para todas elas a cada ciclo por causa da A7, saiu junto com a A7.

**(2) Só o que entrou por movimento.** `entrouPorMovimento` exige que o
último Registro "Status alterado" da conta seja a entrada em "em lançamento
omie" feita na plataforma. A importação do ClickUp também escreve esses
Registros (a trilha do `status_history`), mas sempre com instante anterior
ao da importação (`provenance.at`) — é assim que a conta que NASCEU no Status
é reconhecida. Ela pode já ter sido lançada no Omie pelo processo antigo,
com outro código de integração; a ponte não a lança e pede, uma vez, que
alguém confira e a mova para "para pagar" e de volta. Conta com "Integração
manual" = Manual não é do Agente: nenhuma chamada, nenhum Comentário.

**(3) Uma vez só.** A ponte guarda em memória, por conta, a impressão digital
do que decide o lançamento (Campos, vencimento, Tags, Status e o id do
Registro da entrada). Depois de uma recusa comentada — dado faltando, erro
permanente do `automation/` (`Não consegui lançar no Omie: <details.motivo>
(<code>).`), categoria sem confiança, lançamento não confirmado, ou a
terceira falha transitória seguida (`O Omie não respondeu depois de 3
tentativas…`) — a conta não é mais processada até a impressão mudar: alguém
corrigir um Campo, ou a conta sair e voltar (a volta é um Registro novo).
Conta que sai do Status é esquecida. O `details.motivo` vai para o
Comentário, nunca para o log (T-3-04). A recusa menciona o Financeiro
(`avisadoDoLancamento`), não o Membro de serviço que assina.

**(4) Os modos.** Eram dois (D3-03); desde 06-03 são três — a tabela está
em "Os dois momentos da ponte (Fase 6)", acima. Um valor definido e
desconhecido (erro de digitação, `"true"`, `"Conferencia"`) cai em
`"ensaio"` COM aviso, nomeando só a variável — nunca o seu conteúdo.

**(5) `rodarAgenda` nunca lança.** Para o par configurado, passa ao motor
`lancamento: { rehearsal: false, tarefasLancadas: [], dePara: <vazio, origem
omie> }`: uma A7 legada que ainda esteja ativa falha "Lançamento não
confirmado" antes de invocar o Agente — nunca com o de-para do protótipo
(T-3-39) —, e as outras Automações por data (A5/A6) rodam normalmente, com
o CNPJ da Empresa injetado. Qualquer outro par (mesmo Espaço, outra Lista)
delega direto a `runScheduledAutomations`, sem opções.

**(6) PAG-04, a metade CNPJ, mora aqui.** `CNPJ_POR_EMPRESA` foi apagada de
`packages/dominio` (03-11, Task 1); o token `{{cnpjEmpresa}}` de A5 passa a
ler `AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA` (`lerCnpjPorEmpresa()`, que
derruba o mapa INTEIRO ao primeiro valor fora do formato de CNPJ — meia
tabela é pior que nenhuma). Sem a variável, ou com a Empresa da Tarefa
ausente do mapa, o texto de A5 diz `da Empresa <nome>` — nunca um número
inventado.

**(7) Quem assina.** O Membro de serviço do Papel "Agente do pipeline"
(`resolverMembroAgenteDoPipeline`, só Membro ativo), criado por
`npm run solicitacoes:configurar -w @n1/api -- --apply` (plano pós-auditoria,
2.2). `AUTOMACOES_ATOR_MEMBER_ID` ainda sobrescreve, para teste manual.
