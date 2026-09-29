# Plano — o Resumo de pagamento conferido pelo Financeiro ANTES do lançamento (Fluxos 5, 6 e 7 na plataforma)

Data: 2026-09-29. Pedido do dono: "não está gerando a mensagem para o
financeiro aprovar... ela revisa o comentário dentro da task, respondendo se
tiver tudo ok; aí sim lança no Omie, com os anexos". Fonte: a documentação
`Documentação - Projeto Financeiro Pagamentos.v2.docx` (§2.1 e §3, Fluxos
1–7 do módulo TRIA), as specs `docs/07-processos/{solicitacao-de-pagamento,
contas-a-pagar}.md`, o código do `financeiro-tria/automation` (mapa completo
lido em 2026-09-29) e o da plataforma. Nada aqui foi implementado ainda.

## 0. Em uma página

**O que a plataforma faz hoje** (`apps/api/src/automacoes/invocar-agente.ts`):
a conta entra em "em lançamento omie" → a ponte chama `/resolver` e
`/lancar` → o Omie recebe o título → **só depois** o Agente publica o
"📋 RESUMO DE PAGAMENTO", já marcado como resolvido por ele mesmo → a conta
vai para "lançado omie". Ninguém confere nada antes; ninguém responde no
tópico; os anexos **não** vão para o Omie (o `/lancar` aceita `anexos`, a
ponte não os manda).

**O que o processo de referência faz** (documentação v2, Fluxos 5–7):
depois da aprovação, o robô publica o RESUMO no comentário, atribuído ao
Financeiro, "para conferência final da equipe financeira" (Fluxo 5); o
Financeiro responde no tópico pedindo ajuste e o robô republica o RESUMO
revisado (Fluxo 6); satisfeito, o Financeiro move para "em lançamento" e
só então o robô lança no Omie e sobe os anexos, um a um (Fluxo 7).

**O que muda:** a ponte passa a ter dois momentos. (1) **Resumo para
conferência**: assim que a conta está completa, o Agente publica o RESUMO
no tópico, mencionando o Financeiro, e abre uma **Conferência** (a mesma
entidade de Aprovação que a Solicitação usa, D-06/D-09); o Financeiro
confere por clique ("Conferido, pode lançar") ou respondendo "ok" no
tópico; qualquer outra resposta é pedido de ajuste e gera um RESUMO
revisado no mesmo tópico. (2) **Lançamento**: ao entrar em "em lançamento
omie", a ponte só chama `/lancar` se existe Resumo conferido para os dados
atuais da conta — com a categoria confirmada e os anexos —, publica a
confirmação no tópico e move para "lançado omie".

**O que você decide** (§9): quando o Resumo aparece (recomendo: assim que a
conta fica completa, em "para pagar"); se "ok" por comentário vale como
conferência (recomendo: sim, com o clique como caminho oficial); se a
Solicitação também ganha o Resumo depois da aprovação (S5, recomendo: sim,
nesta rodada); e a forma de estender o contrato (recomendo: v1.1 aditiva).

## 1. O processo de referência, lado a lado

| Fluxo (doc v2) | O que o backend faz hoje no ClickUp | O que a plataforma faz hoje | Lacuna |
|---|---|---|---|
| 1–3 Validação, aprovador, análise da resposta | `automation/`: prazo (5/15/25), CPF/CNPJ, auditoria do anexo por IA, "Fulano, para aprovação", classificador da resposta | Solicitações de pagamento: aprovação por clique (S4/S5/S6), classificador como fallback | Fora deste plano (já entregue na Fase 2; só o S5 abaixo) |
| 4 Seleção de conta | centro de custo → conta corrente | `/resolver` devolve `contaPorTag`; o RESUMO mostra "Conta pagamento" | — |
| 5 Conciliação + RESUMO | fornecedor no Omie; RAG de categoria; **RESUMO como comentário raiz, mencionando "Contas a Pagar", para conferência** | RESUMO publicado **depois** do lançamento, resolvido pelo próprio Agente | **Falta o Resumo antes, aberto ao Financeiro** |
| 6 Revisão | qualquer resposta de um revisor no tópico do RESUMO → RAG de novo com o texto do pedido → IA revisa → **novo RESUMO** | nada | **Falta a revisão pelo tópico** |
| 7 Lançamento | status "em lançamento omie" → `IncluirContaPagar` → **`IncluirAnexo` por arquivo (zip)** → "lançado omie"; falha → volta a "para pagar" + comentário | `/lancar` sem `anexos`; Resumo + "lançado omie" na mesma transação; falha → comentário, fica em "em lançamento omie" | **Faltam os anexos** |
| S5 da Solicitação (spec §8) | ClickUp: RESUMO na Solicitação após a aprovação | coorte plataforma: `handlePlatformApprovalDecision` só grava `Aprovado` e muda o Status — **sem RESUMO** | Lacuna conhecida (07-plano, "abertos") |

Achados do mapa do backend que este desenho evita de propósito: o legado
**reparseia o RESUMO por regex** para lançar (aqui os códigos ficam
estruturados na Conferência, nunca lidos do texto); a revisão pode trocar a
categoria sem ser pedida (aqui todo Resumo revisado exige nova conferência,
então um desvio é visto antes do Omie); o código mostrado e o gravado podem
divergir (aqui o `/lancar` recebe o código confirmado e o valida no plano
de contas real).

## 2. O desenho, passo a passo

### 2.1 O Resumo aparece quando a conta está completa (Fluxo 5)

A ponte, a cada ciclo (e logo depois de uma gravação na conta — ver §3.2),
olha as contas ativas da Lista em **"para pagar" ou "em lançamento omie"**
que: não têm `Integração manual = Manual`; passam em `erpMissingFields`
(Centro, Valor, vencimento, Forma e o dado, Categoria, Fornecedor, documento,
Nome); e **não têm Resumo para a impressão atual**. A impressão de
lançamento é o conjunto do que vai ao Omie: Centro de Custo, Empresa,
Categoria, Fornecedor (tipo, documento, nome), Forma e o dado de pagamento,
Valor, vencimento, Data de Emissão, Tag `conta *`, título e descrição.
Anexos não entram (eles só vão no lançamento).

Para cada uma: `POST /resolver` (só leitura) → `buildResumoDePagamento`
(formato exato de CON-CP-08, byte a byte, como hoje) → uma transação no
domínio que:

1. publica o RESUMO como Comentário do Agente — **raiz** na primeira vez;
   **resposta no mesmo tópico** quando já existe um Resumo anterior da conta
   (um tópico por conta, como o "fio" do ClickUp) — com Menção ao
   Financeiro e uma linha final: *"Maryane, confira: responda "ok" para eu
   lançar, ou diga o que ajustar."*;
2. abre a **Conferência**: uma `ApprovalRequest` de processo
   (`origin.kind = "processTask"`, `processStep = "resumo"` — novo valor ao
   lado de `"pagamento"`), com `threadCommentId` = o Comentário raiz do
   tópico, aprovador = o Financeiro (`CP.financeiroId`, quando Membro ativo;
   senão quem administra a Lista), e a tripla conta · categoria · código
   mais a impressão gravadas em `object.input` — é daí que o lançamento lê,
   nunca do texto;
3. cancela a Conferência anterior ainda pendente, se houver (superada);
4. grava a `AgentExecution` (passo "de-para ERP (omie)" + passo
   "criar_comentario"), como `runLancamentoAgent` já faz.

Categoria abaixo do corte (`veredito: "revisar"`): o Resumo sai do mesmo
jeito, com a linha "Código: … (revisar)" e a similaridade no texto de
Observações, e a Conferência nasce igual — é o Financeiro quem decide, no
tópico, qual categoria vale (hoje a ponte recusa e para; passa a perguntar).

Quando os dados da conta mudam depois de um Resumo (conferido ou não), a
impressão muda: o ciclo seguinte publica um Resumo novo no mesmo tópico,
cancela a Conferência anterior e abre outra. Nada é lançado sobre um Resumo
velho.

### 2.2 A conferência (Fluxo 5 → 6)

**Quem pode:** o Financeiro e quem tem Papel base Administrador ou
Proprietário. (Um Papel "Revisor do Resumo" — L-11 da spec, Liliane — fica
para depois; a regra fica numa função só, `revisoresDoResumo`, para trocar
sem tocar o resto.)

**Caminho oficial — clique.** Na página da conta, o card "Conferência do
Resumo" (o mesmo componente da Aprovação da Solicitação, com os campos da
conta: conta de pagamento, categoria, código, similaridade, valor,
fornecedor) tem dois botões: **"Conferido, pode lançar"** e **"Pedir
ajuste"** (motivo obrigatório). A fila `/ia/aprovacoes` lista as
Conferências pendentes ao lado das Aprovações. Os dois chamam
`decideProcessApproval`, que no ramo `"resumo"`:

- publica a resposta canônica no tópico — `✅ Resumo conferido por
  <nome>` ou `🔁 Ajuste pedido por <nome>: <motivo>`;
- grava a decisão (`aprovada` | `rejeitada`), a fonte (`click` |
  `comment`) e o motivo;
- em `aprovada`, **resolve o tópico** (a pílula "Resolvido", como o
  "Resolvido" do ClickUp na captura do dono) — regra nova em
  `resolveTaskComment`: o aprovador da Conferência resolve o fio aberto pelo
  Agente;
- **não muda o Status** (diferente do ramo `"pagamento"`): quem move é o
  Financeiro, ao levar a conta para "em lançamento omie".

**Caminho pelo tópico — resposta.** A ponte lê as respostas do tópico
posteriores ao último Resumo, escritas por quem pode conferir, e:

- resposta de aprovação (mesma lista de palavras do classificador legado:
  "ok", "aprovado", "conferido", "pode lançar/seguir/pagar", "certo",
  "liberado"…) → `decideProcessApproval(aprovada, source: "comment")`, em
  nome de quem respondeu;
- pergunta ("?"), "aguardando", "vou verificar" → nada (como o legado);
- **qualquer outra resposta é pedido de ajuste** (é assim no Fluxo 6: toda
  resposta de revisor ao RESUMO vira revisão) →
  `decideProcessApproval(rejeitada, source: "comment", motivo: o texto)`.

Respostas do próprio Agente e as canônicas nunca são lidas como decisão.

**O ajuste (Fluxo 6).** Com a Conferência `rejeitada`, o ciclo seguinte
chama `/resolver` de novo com `pedidoDeRevisao: <motivo>` — o backend soma o
texto à consulta do RAG, exatamente como `reviseSummary` faz hoje
(`título + categoria + pedido`) e valida o código no plano de contas real —
e publica o Resumo revisado no mesmo tópico, com Observações dizendo o que
mudou e por quê, e abre uma Conferência nova. Se o pedido cita um código
("use 2.02.98"), a ponte manda `codigoCategoriaConfirmado` e o backend só o
valida contra o plano de contas. O Financeiro também pode simplesmente
editar a Categoria de pagamento na conta: a impressão muda e o Resumo é
refeito sem passar pelo tópico.

### 2.3 O lançamento (Fluxo 7)

A conta em "em lançamento omie", que **entrou por movimento**
(`entrouPorMovimento`, como hoje), não é Manual e está completa:

- **sem Conferência aprovada para a impressão atual** → a ponte não chama
  `/lancar`. Se não há Resumo para essa impressão, publica um (2.1); se há
  e está pendente, espera em silêncio; se os dados mudaram depois de uma
  conferência, publica o Resumo novo e diz, na mesma mensagem, que os dados
  mudaram. Nada além do tópico é escrito;
- **com Conferência aprovada** → `POST /lancar` com o corpo de hoje mais:
  `codigoCategoriaConfirmado` (o código da Conferência; o backend valida no
  plano de contas e usa em vez do RAG), `dataDeEmissao` (Campo Data de
  Emissão), e `anexos` — URLs assinadas de 5 minutos dos arquivos do Campo
  Anexo, do Boleto, do QR Code e dos anexos da Tarefa, cada uma com o nome
  original do arquivo (o backend baixa, zipa e chama `IncluirAnexo` por
  arquivo, como o Fluxo 7; uma falha de arquivo não derruba o lançamento e
  volta em `anexos[].ok = false`);
- `payableId` real → transação no domínio: resposta no tópico `✅ Lançado
  no Omie — título <id> · <conta> · <categoria> (<código>) · anexos <n> de
  <m>` (e o motivo de cada anexo que falhou), tópico resolvido, passo
  `omie_lancar_conta_a_pagar` na `AgentExecution` com o id do título,
  Registro "Lançado no Omie", Status → "lançado omie". Mesma transação, como
  hoje;
- erro permanente / transitório / conflito: os mesmos textos e paradas de
  hoje (1.4 do plano pós-auditoria). Numa repetição depois de conflito o
  `/lancar` devolve `reaproveitado: true` e `anexos: []`; a ponte guarda o
  resultado dos anexos da primeira resposta e o repete na confirmação.

INV-CP-01 continua valendo e ganha força: toda conta em "lançado omie" tem
o Resumo (agora conferido), ou `Integração manual`, ou o registro humano.

### 2.4 O que não muda

`Integração manual = Manual` continua sendo "o Agente não encosta" (sem
Resumo, sem lançamento). O Ensaio (D3-03) continua sem escrever nada. A
idempotência no Omie continua `tria:contas-a-pagar:<taskId>` com consulta
antes de incluir. O formato do RESUMO (CON-CP-08) não muda um byte; o
Comentário ganha só a linha de chamada depois do bloco. O diálogo "Registrar
o lançamento que você fez no Omie" e o relatório do Ensaio continuam iguais.

### 2.5 Três modos da ponte

`AGENTE_CONTAS_A_PAGAR_MODO`: `ensaio` (padrão, nada escrito),
**`conferencia`** (novo: publica Resumos, conduz conferências e revisões,
**nunca chama `/lancar`**) e `lancar` (tudo). O modo `conferencia` é como
o Financeiro passa a usar o tópico de verdade, com o Omie fora do
caminho, antes de receber a caneta — e é o modo em que a jornada
automatizada prova o fluxo sem gastar título no Omie.

## 3. O que muda, por camada

### 3.1 `packages/dominio` (nasce primeiro)

- `types/ai.ts`: `processStep: "pagamento" | "resumo"` na origem
  `processTask`.
- `operations/financeiro.ts`: `impressaoDeLancamento(state, task)` (a
  impressão, num lugar só — a ponte deixa de calcular a sua);
  `publicarResumoParaConferencia(state, ator, taskId, { dePara,
  pedidoDeRevisao? })` (2.1, itens 1–4); `registrarLancamentoNoOmie(state,
  ator, taskId, { payableId, reaproveitado, anexos })` (2.3);
  `conferenciaDoResumo(state, task)` (leitura derivada: a Conferência
  vigente e se bate com a impressão atual — é o portão do lançamento e a
  pílula da tela); `revisoresDoResumo(state)`;
  `classificarRespostaDeConferencia(texto)` (a heurística do legado,
  portada, pura). `runLancamentoAgent` fica para o Ensaio e a A7 legada.
- `operations/ai.ts`: `decideProcessApproval` ganha o ramo `"resumo"`
  (textos canônicos, sem mudança de Status, resolve o tópico em
  `aprovada`, motivo obrigatório em `rejeitada`); `solicitarAprovacao`
  ganha o `processStep` (ou nasce `solicitarConferenciaDoResumo`).
- `operations/tasks.ts`: `resolveTaskComment` aceita o aprovador da
  Conferência do fio.
- `registro.ts` / `index.ts` / esquemas: só o que a tela chama
  (`decideProcessApproval` já é alcançável; as duas operações novas são
  chamadas pela ponte, dentro do `apps/api`, como `importarContaAPagarHistorica`).
- Testes: um arquivo por regra — Resumo raiz e depois no fio; Conferência
  superada quando a impressão muda; decisão por clique e por comentário
  (aprovação, ajuste, pergunta ignorada, autor sem direito ignorado);
  resolver o fio pelo aprovador; lançamento só com Conferência aprovada
  para a impressão atual; confirmação com anexos parciais; INV-CP-01.
  Mutações conferidas como nas rodadas anteriores.

### 3.2 `apps/api`

- `automacoes/invocar-agente.ts`: os dois momentos (2.1–2.3), o modo
  `conferencia`, a leitura das respostas do tópico, os `anexos` (ids de
  `WorkspaceFile` → `urlDeDownload` de 5 min → `{ url, nome }`, gerados logo
  antes do `/lancar`, cujo prazo é 60 s), e `cutucar()`: a rota de
  operações avisa a ponte depois de uma gravação numa conta da Lista
  (Campo, Status, Comentário, decisão), e ela roda um ciclo em até 2 s, em
  vez de esperar os 15 min — é o que faz o Resumo aparecer enquanto o
  Financeiro ainda está na conta. Sem evento novo de outbox: ponte e rota
  vivem no mesmo processo.
- `rotas/esquemas`: `decideProcessApproval` sem mudança de forma; a fila e o
  card continuam usando a mesma operação.
- Testes: `invocar-agente.test.ts` com o servidor falso (já existe) cobrindo
  os três modos, a espera pela conferência, a revisão, os anexos no corpo
  de `/lancar` e a confirmação; contrato `contas-a-pagar-v1` atualizado.

### 3.3 `apps/web`

- Card "Conferência do Resumo" na página e no popup da conta (mesmo molde
  de `painel-aprovacao.tsx`, com os campos da conta em vez dos da
  Solicitação); a fila `/ia/aprovacoes` mostra as Conferências com o título
  "Conferir Resumo de pagamento"; pílula "Resumo conferido"/"Aguardando
  conferência" ao lado do Status na conta; o aviso INV-CP-01 continua.
- Jornada (`jornada:financeiro`): cenário novo "CP conferida e lançada" —
  preenche, espera o Resumo aparecer no tópico, responde "ok" (ou clica),
  move para "em lançamento omie" e, em modo `conferencia`, confere que a
  ponte NÃO chamou `/lancar`; em modo `lancar`, que a conta foi a "lançado
  omie" com a confirmação e os anexos.

### 3.4 `financeiro-tria/automation` — contrato v1.1 (aditivo)

- `POST /resolver`: `pedidoDeRevisao?: string (≤ 500)` (entra na consulta do
  RAG, como `reviseSummary`) e `codigoCategoriaConfirmado?: string`
  (validado contra `ListarCategorias`; devolve `resolvida` com o nome real
  do Omie e `similaridade: 1`; inexistente → `revisar` com o motivo).
- `POST /lancar`: `codigoCategoriaConfirmado?` (mesma validação; substitui o
  veredito do RAG) e `anexos?: Array<string | { url, nome }>` (o nome vai
  para o zip e para `cNomeArquivo`; hoje o nome sai da URL assinada, que
  termina no caminho opaco do Storage). O restante igual.
- Fixtures novas em `contratos/contas-a-pagar-v1/` nos DOIS repositórios
  (a comparação por hash já existe) e `05-contrato-lancamento-contas-a-pagar-v1.md`
  com a seção "v1.1 (aditiva)".
- `teste:omie-real` ganha `--anexo=<arquivo>` para provar o `IncluirAnexo`
  no Omie da Tria com o título de R$ 1,00 (e a exclusão no fim, como hoje).

### 3.5 S5 na Solicitação (coorte plataforma) — recomendado nesta rodada

`handlePlatformApprovalDecision` (financeiro-tria) hoje só grava `Aprovado`
e muda o Status. Passa a rodar, em `aprovada`, os passos 2.8→2.11 do
pipeline (conta, fornecedor, categoria, RESUMO) — a mesma sequência que
`processManualPayment` já roda — publicando o RESUMO na Solicitação pelo
adapter da plataforma, e em `rejeitada` avisa o Solicitante (S6). Assim o
Aprovador e o Solicitante veem na Solicitação o mesmo Resumo que o
Financeiro vai conferir na Conta. Risco a tratar: esses passos ainda chamam
`legacyClickUpRaw()` em pontos que não valem na plataforma (mapa §4) —
cada um vira "pela porta ou nada".

### 3.6 Documentos

`docs/07-processos/contas-a-pagar.md` §6.3, §8 (A7/A8) e §9 (Agente:
Resumo antes, conferência, anexos); `05-contrato…` (v1.1); `07-plano…` e
`08-roteiro…` (modo `conferencia` na semana de Ensaio; passo 2B com a
conferência); memória do projeto.

## 4. Ordem de execução e tamanho

| # | Etapa | Tamanho | Depende de |
|---|---|---|---|
| 1 | Domínio (§3.1), com testes e mutações | M | — |
| 2 | Contrato v1.1 no `financeiro-tria` (§3.4), fixtures nos dois lados, `teste:omie-real --anexo` | M | — (paralela à 1) |
| 3 | Ponte (§3.2): dois momentos, modos, anexos, `cutucar`, testes com servidor falso | G | 1, 2 |
| 4 | Tela e fila (§3.3), jornada com o cenário novo | M | 1 |
| 5 | S5 na Solicitação (§3.5) | M | 2 (mesmo repositório) — opcional |
| 6 | Docs (§3.6) e provas finais (§5) | P | 1–4 |

## 5. Provas (na ordem)

1. `npm run check` verde nos três workspaces; `npm test` isolado no
   `financeiro-tria`; contrato `contas-a-pagar-v1` 2× (as duas cópias, hash
   igual).
2. Ponte contra o servidor falso: ensaio não escreve; `conferencia` publica
   o Resumo, aceita "ok" por comentário e por clique, revisa com o pedido,
   nunca chama `/lancar`; `lancar` só lança com conferência da impressão
   atual, manda `anexos` e `codigoCategoriaConfirmado`, confirma no tópico e
   move.
3. Jornada no navegador (visível, com a faixa), API em modo `conferencia`:
   a conta ganha o Resumo no tópico em segundos, o robô responde "ok", a
   pílula vira "Resumo conferido", a conta é movida para "em lançamento
   omie" e fica lá com o aviso de que o lançamento espera o modo `lancar`.
   Depois, um segundo cenário pedindo ajuste no tópico e vendo o Resumo
   revisado.
4. Omie real, com a sua autorização como das outras vezes:
   `teste:omie-real --lancar --anexo=<pdf de teste>` — título de R$ 1,00
   com um anexo, conferido pelo id e excluído no fim.
5. Passo 2B do roteiro, em modo `lancar`, numa conta de teste real da
   plataforma (é o único que o agente não roda sozinho — a API em modo
   `lancar` é você quem sobe).

## 6. Riscos e o que fica de fora

- **Número da nota fiscal**: o legado extrai o nNF do anexo com o Gemini
  antes de incluir; o `/lancar` aceita `numeroDocumentoFiscal` opcional e a
  plataforma não tem esse Campo. Fica vazio (o Omie aceita). Trazer a
  extração para o `/lancar` é decisão à parte.
- **Cartão / Link de pagamento**: o `/lancar` só aceita Chave Pix, Boleto e
  QRCode Pix. Igual a hoje.
- **Departamento Omie** (OQ-CMP-03): resolvido dentro do `/lancar` como hoje;
  não aparece no Resumo.
- **Anexos no replay**: o `/lancar` devolve `anexos: []` quando o título já
  existia; a ponte guarda o resultado da primeira resposta. Se o processo
  cair entre o `/lancar` e a gravação, a confirmação sai sem o detalhe dos
  anexos (o título e os anexos estão no Omie).
- **Custo**: um `/resolver` por conta completa e por mudança de dados (RAG +
  `ListarCategorias`), mais um por pedido de ajuste. Hoje é um por
  lançamento. Com ~120 contas abertas por mês, é pequeno.
- **Revisor como Papel** (L-11) e **lembrete** quando a conferência fica
  parada: fora desta rodada.

## 7. Decisões que só você toma

1. **Quando o Resumo aparece.** (a) *recomendado*: assim que a conta fica
   completa, ainda em "para pagar" — igual ao ClickUp, onde o Resumo vem
   antes de a pessoa mover para "em lançamento", e o Financeiro vê problema
   de categoria dias antes do vencimento; (b) só quando a conta entra em
   "em lançamento omie" — menos Resumos, mas o Status passa a significar
   "conferindo e lançando", e o Financeiro só vê o Resumo depois de mover.
2. **"ok" por comentário vale?** *Recomendado*: sim, como atalho, com o
   clique como caminho oficial (a mesma decisão D-07/D-10 da Solicitação).
   Alternativa: só o clique decide; o tópico só serve para pedir ajuste.
3. **S5 na Solicitação nesta rodada?** *Recomendado*: sim (§3.5).
4. **Contrato**: v1.1 aditiva com fixtures nos dois lados (*recomendado*)
   ou `/v2` separado (duplica ~600 linhas de rota por quatro campos
   opcionais).
5. **Quem confere** além do Financeiro (Maryane): só Administradores por
   enquanto, ou já um Papel "Revisor do Resumo" com a Liliane (L-11)?
