---
phase: 06-conferencia-do-resumo-e-anexos
repo: financeiro-tria (automation/)
diff_base: c272dad
reviewed: 2026-09-30T00:36:30Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - automation/src/http/contas-a-pagar-routes.ts
  - automation/src/tenants/tria/contas-a-pagar-resolucao.ts
  - automation/src/tenants/tria/contas-a-pagar-lancamento.ts
  - automation/src/adapters/omie.ts
  - automation/src/tenants/tria/payment-automation-service.ts
  - automation/src/tenants/tria/teste-omie-real.ts
  - automation/scripts/teste-omie-real.ts
  - automation/src/http/contas-a-pagar-routes.test.ts
  - automation/src/http/contas-a-pagar-contrato.test.ts
  - automation/src/tenants/tria/contas-a-pagar-resolucao.test.ts
  - automation/src/tenants/tria/contas-a-pagar-lancamento.test.ts
  - automation/src/tenants/tria/payment-automation-service.plataforma.test.ts
  - automation/src/tenants/tria/teste-omie-real.test.ts
findings:
  critical: 3
  warning: 7
  info: 6
  total: 16
status: issues_found
---

# Fase 6 (financeiro-tria/automation): relatório de revisão de código

**Revisado em:** 2026-09-30T00:36:30Z
**Profundidade:** standard (com rastreio pontual das funções chamadas: `callOmie`/`ErroDoOmie`, `matchCategory`, `createOrResumeRun`, `retryRun`, `montarHandler` do webhook, a idempotência de `apps/api` e o `anexos-da-conta.ts`/`invocar-agente.ts` da ponte)
**Arquivos revisados:** 13 (7 de código e 6 de teste)
**Status:** issues_found

## Resumo

Revisei o diff `c272dad..HEAD` (4 commits: `/resolver` e `/lancar` v1.1, `--anexo` no `teste:omie-real` e S5/S6 na coorte plataforma), além do que ele chama. Os 121 testes dos seis arquivos passam (`node scripts/testes/rodar-isolado.mjs <arquivos>`), mas nenhum deles exercita as falhas abaixo.

Principais problemas:

1. **`anexos[].url` é um SSRF completo.** Não há restrição de esquema nem de host, os redirects são seguidos e não existe timeout nem teto de tamanho. O conteúdo baixado vai parar num título do Omie, e o `erro` da resposta serve de oráculo. Até a v1.1 nenhum chamador mandava anexos, e agora a ponte manda em todo `/lancar`.
2. **`codigoCategoriaConfirmado` só confere se o código existe.** Uma categoria de receita (`1.xx.xx`), totalizadora ou inativa sai `resolvida` e vai para o `IncluirContaPagar`.
3. **Download sem prazo depois do `IncluirContaPagar`, dentro do prazo de 60 s da ponte.** Se o `/lancar` estoura, a repetição cai em `reaproveitado: true` com `anexos: []`, e a plataforma relata "sem anexos". Os anexos fiscais (NF, boleto) somem sem ninguém saber.
4. **S5 na plataforma.** Nenhum caminho chama `legacyClickUpRaw()` (conferi: `selectAccount`, `ensureSupplierAndCategory`, `postPaymentSummary` e `registrarFalhaDoResumo` usam só store, Omie, IA e `this.adapter`), e a falha no S5 não desfaz a aprovação. Mesmo assim:
   - a ação recomendada (`tentar_novamente`) roda o pipeline errado;
   - as chaves de idempotência valem para a Tarefa inteira e para sempre, e colidem com o corpo não determinístico do RESUMO, que é gerado por LLM;
   - o S5 lê um snapshot velho do comentário;
   - o erro cru vira comentário público.
5. **Caminhos legados do ClickUp.** Não achei mudança de comportamento. `publicarResumoDepoisDaAprovacao` sem `origem` faz a mesma leitura padrão, e a Menção só muda quando `origemAtual() === "plataforma"`.

O servidor HTTP efêmero do `teste-omie-real` está correto: escuta só em `127.0.0.1`, usa caminho aleatório de 96 bits, serve uma vez só, devolve 410 a partir da segunda e fecha no `finally`. Sobre ele restou só um item Info.

## Critical Issues

### CR-01: SSRF por `anexos[].url`: o backend baixa de qualquer URL, sem timeout nem limite de tamanho, e sobe o conteúdo ao Omie

**Arquivos:** `automation/src/http/contas-a-pagar-routes.ts:138-142`, `automation/src/adapters/omie.ts:1023-1027`, `automation/src/tenants/tria/contas-a-pagar-lancamento.ts:371-384`

**Problema:** o schema aceita `url: z.string().min(1)`. Não há `.url()`, nem esquema `https:`, nem allowlist de host, nem teto no tamanho da lista `anexos`. O adapter faz `await fetch(input.url)` direto, com os padrões do undici: segue redirects, não tem timeout nem limite de corpo, e lê tudo com `response.arrayBuffer()`. Consequências concretas:
- **Leitura de recursos internos.** Quem tem o token da rota (ou compromete a ponte) aponta `url` para `http://127.0.0.1:<porta>/…`, `http://169.254.169.254/…` (metadata do provedor da VPS), serviços da VPS compartilhada (`85.155.186.214`, pm2/nginx) ou a rede interna. O corpo da resposta é zipado e sobe pelo `IncluirAnexo` para dentro de um título do Omie, onde qualquer usuário do ERP baixa. O próprio `teste-omie-real` prova que a rota de produção baixa de loopback.
- **Oráculo de varredura.** `anexos[].erro` devolve `download anexo falhou: 404 Not Found`, `fetch failed` ou `ok: true`, o que permite mapear portas e hosts internos.
- **DoS.** Uma URL que devolve gigabytes ou nunca termina (slowloris) enche a memória ou prende o processo. É o mesmo processo que roda o pipeline ClickUp, a ponte e o outbox. Uma lista com milhares de anexos repete o efeito em série.
- **Superfície nova.** O contrato diz que "nenhum chamador mandava anexos até a v1.1". Agora a ponte manda em todo `/lancar`. Os caminhos legados (ClickUp, MP e FO) já tinham o mesmo defeito com URLs tiradas de texto livre da Tarefa, então a correção no adapter protege todos.

**Correção:** validar no adapter, onde todos os chamadores passam, com uma allowlist injetável para o teste de loopback:
```ts
// omie.ts
const HOSTS_DE_ANEXO = (process.env.ANEXO_HOSTS_PERMITIDOS ?? "<projeto>.supabase.co").split(",");
const LIMITE_DO_ANEXO = 15 * 1024 * 1024;
const alvo = new URL(input.url);
if (alvo.protocol !== "https:" && !this.permitirLoopbackEmTeste) throw new Error("anexo: esquema não permitido");
if (!HOSTS_DE_ANEXO.includes(alvo.hostname) && !this.permitirLoopbackEmTeste) throw new Error("anexo: host não permitido");
const response = await fetch(alvo, { redirect: "error", signal: AbortSignal.timeout(20_000) });
const tamanho = Number(response.headers.get("content-length") ?? "0");
if (tamanho > LIMITE_DO_ANEXO) throw new Error("anexo: arquivo acima do limite");
// ler em stream contando bytes e abortar ao passar do limite (content-length pode faltar ou mentir)
```
No schema: `anexos: z.array(...).max(20)` e `url: z.string().url().max(2048)`. Nas mensagens de erro devolvidas em `anexos[].erro`, trocar o status HTTP cru por um texto fixo ("download do anexo falhou").

### CR-02: `codigoCategoriaConfirmado` aceita categoria de receita, totalizadora ou inativa numa Conta a PAGAR

**Arquivo:** `automation/src/tenants/tria/contas-a-pagar-resolucao.ts:345-374` (e a regex em `contas-a-pagar-routes.ts:91`)

**Problema:** `resolverCategoriaConfirmada` monta `omieMap` com todas as linhas de `ListarCategorias` (`listCategorias` pagina o plano inteiro: receitas `1.x`, despesas `2.x`, totalizadoras e inativas) e só pergunta `omieMap.get(codigo)`. A regex `^\d(\.\d{2}){2,3}$` também aceita `1.01.01`. Resultado: um código de receita existente sai `{ veredito: "resolvida", similaridade: 1 }`, e o `/lancar` faz `IncluirContaPagar` com `codigo_categoria` de receita. O mesmo vale para uma categoria totalizadora, que só agrupa as filhas (ex.: `2.02.98` quando existe `2.02.98.01`, justamente o exemplo do contrato §3), e para uma categoria inativa. O risco é concreto porque a ponte extrai esse código de TEXTO LIVRE do pedido de ajuste (`invocar-agente.ts:903`, `codigoNoPedido(pedido)`), e um dígito errado ("1.02.01" em vez de "2.02.01") atravessa até o ERP. O caminho do RAG não sofre disso porque o banco `conciliador_contas` é filtrado por `tipo: "pagar"` (`supabase.ts:346-350`). Com o código confirmado esse filtro é pulado, e nenhum teste cobre um código de receita (os testes só usam `2.06.01`, `2.02.98` e `9.99.99`).

**Correção:** validar o tipo e a condição da linha do plano de contas, não só a existência:
```ts
for (const c of categoriasOmie) {
  const cod = String(c.codigo || "").trim();
  if (!cod) continue;
  omieMap.set(cod, {
    descricao: String(c.descricao || "").trim(),
    despesa: String(c.conta_despesa ?? "").toUpperCase() === "S",
    totalizadora: String(c.totalizadora ?? "").toUpperCase() === "S",
    inativa: String(c.conta_inativa ?? "").toUpperCase() === "S",
  });
}
const linha = omieMap.get(codigo);
if (!linha) return revisar(`Código ${codigo} não existe no plano de contas do Omie.`);
if (!linha.despesa) return revisar(`Código ${codigo} não é uma categoria de despesa.`);
if (linha.totalizadora) return revisar(`Código ${codigo} é uma categoria totalizadora — escolha uma subcategoria.`);
if (linha.inativa) return revisar(`Código ${codigo} está inativo no Omie.`);
```
Como defesa barata, também trocar a regex por `^2(\.\d{2}){2,3}$`. Acrescentar ao `resolucao.test.ts` casos com receita, totalizadora e inativa.

### CR-03: anexos perdidos e relatados como "sem anexos" quando o `/lancar` passa do prazo de 60 s da ponte

**Arquivos:** `automation/src/tenants/tria/contas-a-pagar-lancamento.ts:262-277` e `:371-384`, `automation/src/adapters/omie.ts:1023`

**Problema:** os anexos sobem em série, depois do `IncluirContaPagar` e dentro da mesma requisição. Cada um é download sem timeout, zip e `IncluirAnexo` (uma escrita que não é repetida em REDUNDANT). A ponte chama o `/lancar` com `TIMEOUT_LANCAR_MS = 60_000` (`apps/api/src/automacoes/invocar-agente.ts:206`) e agora manda todos os arquivos dos Campos Anexo, Boleto e QR Code mais os anexos da Tarefa (`anexos-da-conta.ts`). Com alguns PDFs e um Omie lento (ou um Storage lento, que não tem prazo), o `/lancar` passa de 60 s:
1. A ponte aborta e trata como transitória. O handler do Express não é abortado e segue subindo anexos, ou morre no meio se o processo reinicia.
2. A repetição consulta, acha o título e volta `reaproveitado: true, anexos: []` (linhas 265-276).
3. `anexosDaResposta` na ponte devolve `[]`, e o texto da plataforma fica "Lançado … · sem anexos".

A "primeira resposta que a ponte guarda" (comentário da linha 267) nunca chegou. Resultado: anexos fiscais que não subiram (ou subiram pela metade) somem sem ninguém saber, e o relato na plataforma afirma o contrário. A v1.1 é o primeiro chamador real de anexos, então o caminho "adiado" deixou de ser teórico.

**Correção (mínima):**
- (a) prazo por download (`AbortSignal.timeout`) e um orçamento total de anexos bem abaixo dos 60 s da ponte (ex.: 35 s). O que não coube vira `ok: false, erro: "tempo esgotado"`, e a resposta sai dentro do prazo;
- (b) no caminho `reaproveitado`, não devolver `anexos: []` como se estivesse tudo certo. Uma alternativa é devolver cada anexo pedido como `{ url, nome, ok: false, erro: "não confirmado: o título já existia" }`, para a ponte avisar que é preciso conferir os anexos no Omie. A outra, melhor, é consultar os anexos do título (`ListarAnexo` por `nId`) e reenviar só os que faltam, pelo nome.

## Warnings

### WR-01: após falha no S5, "tentar_novamente" roda o pipeline errado e nunca publica o Resumo; falhas transitórias viram definitivas

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:1268-1276`, `:1304-1332` e `:1334-1340`

**Problema:** o S5 falha, `registrarFalhaDoResumo` grava `recommendedAction: "tentar_novamente"` e o webhook responde 202 (receipt `concluido`). O webhook, portanto, nunca repete, nem para falha TRANSITÓRIA (5xx da plataforma no `createComment`, OpenAI fora do ar, rede). A única repetição disponível, `retryRun(runId, "summary")`, vai para `runInitialValidation`. Esse caminho não passa pela guarda de status terminal de `startPaymentRequest` e roda de novo prazo, documento, auditoria e `assignResponsible`: republica o "para aprovação", cria outra `approvalTask` "estrategista" e põe o run em `waiting_approval`, tudo numa Solicitação já aprovada. O S5 não é refeito. Além disso, o `createApprovalTask("financeiro_final")` só roda no caminho de sucesso, e a Solicitação fica sem a pendência "Liberar lançamento".

**Correção:** tratar `stepKey === "summary"` em `retryRun` para a coorte plataforma, relendo a linha por `origem` e chamando `publicarResumoDepoisDaAprovacao` seguido do mesmo bloco de sucesso (updateRun, approvalTask e logEvent). Opcionalmente, marcar o receipt como `falhou_retentavel` quando o erro do S5 for transitório (`ErroTransitorioDaPlataforma` ou `natureza` transitória do `ErroDoOmie`) em vez de engoli-lo.

### WR-02: chaves de idempotência valem para a Tarefa inteira e para sempre, contra um RESUMO gerado por LLM: 409 `IDEMPOTENCY_KEY_REUSED` em qualquer reprocesso

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:1803-1806` (`summary:${runId}:comment`), `:1325-1328` (`summary:${runId}:falha`), `:1229-1232`

**Problema:** `runId` é sempre `task:<taskId>` (`supabase.ts:453-455`, `createOrResumeRun`). Então `summary:task:<id>:comment` é uma chave única por Tarefa, para sempre. O `apps/api` guarda a chave sem TTL e compara o hash do corpo (`servicos/idempotencia.ts`), e o texto do RESUMO sai de `ai.formatPaymentSummary`, que não é determinístico. Qualquer segunda execução do S5 na mesma Solicitação gera 409 e cai em `registrarFalhaDoResumo`. São segundas execuções, por exemplo:
- reentrega depois de o processo morrer entre o `createComment` e o `fecharReceipt`;
- nova decisão "aprovada" depois de uma "rejeitada";
- reprocesso manual.

O efeito é publicar "Não consegui montar o Resumo: …409…" logo abaixo de um RESUMO que JÁ foi publicado, ou nunca publicar o RESUMO do novo ciclo de aprovação. A chave `summary:${runId}:falha` tem o mesmo problema: uma segunda falha com outro motivo recebe 409, que é engolido, e o comentário antigo e errado fica.

**Correção:** incluir na chave um discriminador do ciclo, por exemplo o `eventId` do `aprovacao-decidida` repassado a `handlePlatformApprovalDecision`: `summary:${eventId}:comment` e `summary:${eventId}:falha`. Assim a reentrega do MESMO evento reaproveita a resposta e um ciclo novo publica de novo. Para a reentrega do mesmo evento, gerar o texto uma vez e guardá-lo (ou tratar 409 `IDEMPOTENCY_KEY_REUSED` no `createComment` do RESUMO como "já publicado").

### WR-03: S5 na plataforma lê um snapshot velho (`linha.comentario`) e, num segundo ciclo, reparseia o próprio RESUMO

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:1270` e `:1733`

**Problema:** `publicarResumoDepoisDaAprovacao(runId, taskId, linha, { origem: "plataforma" })` sem `parsed` faz `parsePaymentComment(linha.comentario)`. Esse texto foi montado por `montarComentario(dto)` no `solicitacao-criada` e não é ressincronizado. A plataforma só manda três webhooks, nenhum de edição. Se o Solicitante corrigiu valor, documento ou fornecedor antes da aprovação, o S5 usa os dados antigos: `ensureSupplier` pode CADASTRAR no Omie um fornecedor com o documento velho, e o RESUMO sai com valores superados. E depois do primeiro S5, `postPaymentSummary` grava `comentario: summary.raw` (linha 1814). Num segundo ciclo, `parsePaymentComment` passa a ler o RESUMO em vez da Solicitação, exatamente o problema que o comentário de `processManualPayment` (linhas 746-747) diz evitar.

**Correção:** no ramo aprovado da plataforma, reler a Tarefa pela porta antes do S5, como o fluxo manual faz com o ClickUp:
```ts
const tarefa = await this.lerTarefa(taskId);            // this.adapter.getTask na plataforma
const mapped = this.mapper.mapear(tarefa.entradaDoMapper);
await this.publicarResumoDepoisDaAprovacao(runId, taskId, linha, {
  origem: "plataforma",
  parsed: parsePaymentComment(mapped.comentario),
});
```

### WR-04: o erro cru do S5 é publicado como comentário na Solicitação, sem `sanitizarMotivo`

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:537-541` (`motivoCurto`) e `:1324`

**Problema:** `motivoCurto` só corta a primeira linha e trunca em 200 caracteres. A mensagem do `ErroDoOmie` embute o `faultstring` CRU (`omie.ts:155-156`: `JSON.stringify({ faultstring: dados.faultstring … })`, não a versão redigida). Erros do `ensureSupplier` e `IncluirCliente` podem ecoar CPF/CNPJ e razão social, erros do Supabase trazem detalhes de schema, e os da OpenAI trazem trechos da chave mascarada ou do projeto. O texto vai para `createComment(taskId, "Não consegui montar o Resumo: ${motivo}")`, que o Solicitante e toda a Lista veem. O próprio projeto proíbe dado sensível em motivo (T-3-14) e tem `sanitizarMotivo` para isso. O caminho legado não publicava o erro: ele subia para o webhook.

**Correção:** publicar um texto fixo por classe de erro ("o Omie recusou o cadastro do fornecedor", "a IA do Resumo não respondeu", "o Omie não respondeu") e deixar o detalhe só no `logEvent`/`technicalMessage`. Se o detalhe precisar aparecer, usar `ErroDoOmie.detalhe` (que já sai redigido) passado por `sanitizarMotivo(…, [documento, valor, chavePix])`.

### WR-05: S5 na plataforma herda o fallback para a conta TRIA quando o Centro de Custo não roteia e grava fornecedor no Omie errado

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:1602-1668` (chamado de `:1270`)

**Problema:** `selectAccount` e `ensureSupplierAndCategory` usam `resolveAccountConfig(centroCusto)`. Quando o centro não bate (`matched: false`), eles só registram um aviso e seguem com a credencial TRIA padrão, e `ensureSupplier` pode executar `IncluirCliente` na empresa Omie errada. O `/resolver`/`/lancar` recusa exatamente isso (`CENTRO_DE_CUSTO_NAO_ROTEADO`, T-3-15, `contas-a-pagar-resolucao.ts:445-451`). O Plano 06-05 estendeu o comportamento legado inseguro à coorte nova sem essa guarda.

**Correção:** no ramo plataforma, antes do S5: `if (!resolveAccountConfig(centro).matched) throw new Error("Centro de Custo não roteia para nenhuma conta Omie — Resumo não montado.")`. Esse erro cai em `registrarFalhaDoResumo` já com texto fixo, conforme WR-04.

### WR-06: `aprovacao-decidida` agora roda o S5 inteiro antes do 202; a entrega estoura rotineiramente o prazo de 10 s do outbox

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:1264-1302`, `automation/src/http/webhooks-plataforma.ts:461-465`

**Problema:** `montarHandler` espera `executar()` terminar antes de responder. O handler agora inclui `fetchCnpjDetails` (sem timeout, `public-apis.ts:61`, e o `/lancar` usa `dadosDoCnpjComPrazo` de 8 s, mas o S5 não), `ensureSupplier`, `ListarCategorias` (até 20 páginas e 3 tentativas), embeddings e `formatPaymentSummary` (LLM). O outbox do `apps/api` entrega com `timeoutMs = 10_000` (`persistencia/outbox-worker.ts:185`). Na prática, a primeira entrega de toda aprovação vai estourar: o outbox conta falha e repete, recebe `409 REQUEST_IN_PROGRESS` até o fim e só então `duplicated`. Se o S5 passar do lease (`PLATAFORMA_RECEIPT_LEASE_MIN`, que é configurável), a reentrega reivindica o receipt e roda um segundo S5 em paralelo, que colide com WR-02.

**Correção:** responder 202 depois de gravar a decisão e o Status e rodar o S5 depois da resposta, com receipt e varredura próprios, como `montarHandlerDeComentario` já faz para o classificador. Também pôr prazo em `fetchCnpjDetails` no S5, reaproveitando `dadosDoCnpjComPrazo`.

### WR-07: com `reaproveitado: true`, o `dePara` devolvido é recalculado do pedido atual, não é o que está no título do Omie

**Arquivo:** `automation/src/tenants/tria/contas-a-pagar-lancamento.ts:251` e `:265-276`

**Problema:** a resolução roda antes da consulta, e no ramo `encontrado` a resposta devolve o `dePara` do pedido ATUAL. Na v1.1, a categoria de uma repetição pode ser outra: a primeira resposta se perde, um ajuste no Resumo gera nova Conferência e a ponte chama de novo com outro `codigoCategoriaConfirmado`. A plataforma então confirma "Lançado · {categoria} ({código})" com o código NOVO, enquanto o título no Omie tem o antigo. Antes da v1.1 o código saía do RAG, com a mesma entrada, e raramente mudava.

**Correção:** no ramo `encontrado`, ler `codigo_categoria` do título consultado (o `ConsultarContaPagar` já o devolve) e, se divergir de `omie.codigoCategoria`, devolver o do Omie no `dePara`, com um `motivo`/aviso. Outra opção é recusar com `REGRA_DE_DOMINIO` ("o título já existe com a categoria X").

## Info

### IN-01: `pedidoDeRevisao` chega sem escape ao `.or()` do PostgREST no fallback `ilike`

**Arquivo:** `automation/src/tenants/tria/contas-a-pagar-resolucao.ts:386-390`, `automation/src/adapters/supabase.ts:361-364`

**Problema:** o texto livre do Financeiro é anexado à consulta. Sem embedding (sem chave da OpenAI), as primeiras 4 palavras com mais de 3 caracteres entram em `content.ilike.%${w}%` dentro de `.or(...)`, e vírgulas ou parênteses alteram o filtro. O impacto é baixo: o `.contains("metadata", filter)` continua em AND, e um candidato sem `similarity` sempre sai `revisar`. Não há LLM neste caminho, só embeddings, então o risco de prompt injection se limita a desviar o vetor dentro do banco já filtrado. O teto de 500 caracteres está no schema, e a ponte corta em 500.

**Correção:** remover `,()"\\` das palavras antes de montar o `or`, ou usar `.textSearch`.

### IN-02: normalização do `nome` perde a extensão ou o nome inteiro em casos comuns

**Arquivo:** `automation/src/adapters/omie.ts:27-36` e `:1028`

**Problema:**
- um nome com escrita não latina (`照片.png`) vira `.png`, um arquivo oculto dentro do zip;
- um nome só com espaços (passa em `min(1)`) vira `arquivo.pdf` mesmo sendo PNG;
- um nome sem extensão sobe sem extensão (`cTipoArquivo: ""`);
- dois anexos com o mesmo nome vão com o mesmo `cNomeArquivo` e o mesmo `cCodIntAnexo` (= `recordId` para todos, comportamento anterior).

**Correção:** `nome: z.string().trim().min(1).max(200)`. Se o resultado normalizado não tiver base, usar `anexo-<n>.<ext>`, com a extensão inferida do `content-type`. Desambiguar duplicatas com um sufixo.

### IN-03: `anexos[].url` (URL assinada com token) volta na resposta do `/lancar`

**Arquivo:** `automation/src/tenants/tria/contas-a-pagar-lancamento.ts:379-383`, `contas-a-pagar-routes.ts:186`

**Problema:** a ponte descarta a URL (`anexosDaResposta`), mas a resposta carrega o token de acesso ao arquivo sem necessidade (T-3-04 no `apps/api`). Qualquer log futuro do corpo da resposta vaza esse token.

**Correção:** na v1.1, quando o anexo veio com `nome`, responder a identificação pelo `nome` ou pelo índice e omitir a `url`, ou devolvê-la sem query string.

### IN-04: RESUMO na plataforma sai sem Menção e sem aviso de configuração; o log diz "publicado no ClickUp"

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:1798-1800` e `:1822`

**Problema:** sem `PLATAFORMA_MEMBRO_POR_CLICKUP_ID` para `81581816`, o RESUMO sai sem Menção e ninguém de Contas a Pagar é notificado. O `assignResponsible` avisa com `console.warn` nesse caso, e aqui nada avisa. O `simpleMessage` diz "RESUMO publicado no ClickUp." também na coorte plataforma. Somado a isso, o S6 da plataforma não menciona o Solicitante (`criadorId: ""`), o que está documentado mas significa que a reprovação não gera notificação.

**Correção:** `console.warn` equivalente ao de `assignResponsible` e `simpleMessage` por coorte.

### IN-05: o S5 da plataforma herda a validação de categoria legada, que aceita candidato sem similaridade medida

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:1665-1680`

**Problema:** `ensureSupplierAndCategory` faz `createEmbedding(...).catch(() => null)`, cai no `ilike` e usa `resolveCategoryCodeAgainstOmie`. Com o Omie fora, o fluxo "segue sem bloquear". É o defeito que o plano pós-auditoria 1.3 corrigiu no `/resolver`, agora publicado no RESUMO da Solicitação da plataforma. O impacto é limitado porque a Conta tem Resumo próprio via `/resolver` (D6-07), mas pessoas podem confiar no código mostrado na Solicitação.

**Correção:** marcar no RESUMO quando o código não foi validado, ou reusar `resolverDeParaDeLancamento`.

### IN-06: servidor efêmero do `teste-omie-real` sem listener de erro no `listen`

**Arquivo:** `automation/src/tenants/tria/teste-omie-real.ts:161`

**Problema:** `servidor.listen(0, "127.0.0.1", resolve)` não trata o evento `error`, então uma falha ao abrir a porta derruba o processo com exceção não tratada em vez de reprovar o passo. De resto, está correto: escuta só em loopback, caminho aleatório de 96 bits, 404 fora dele, uma entrega e depois 410, `closeAllConnections` e `close` no `finally`, URL nunca impressa. Observação para o CR-01: este teste depende de a rota baixar de `127.0.0.1`, então a allowlist precisa ser injetável (ou o teste precisa servir por um host permitido).

**Correção:** `servidor.once("error", reject)` na Promise do `listen`.

---

_Revisado em: 2026-09-30T00:36:30Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
