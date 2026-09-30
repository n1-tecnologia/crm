---
phase: 06-conferencia-do-resumo-e-anexos
repo: financeiro-tria (automation/)
diff_base: 2cd13cd
head: 42ca9b5
reviewed: 2026-09-30T14:51:44Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - automation/src/adapters/omie.ts
  - automation/src/adapters/public-apis.ts
  - automation/src/adapters/supabase.ts
  - automation/src/http/contas-a-pagar-routes.ts
  - automation/src/http/routes.ts
  - automation/src/http/webhooks-plataforma.ts
  - automation/src/http/worker-da-plataforma.ts
  - automation/src/server.ts
  - automation/src/tenants/tria/contas-a-pagar-anexos.ts
  - automation/src/tenants/tria/contas-a-pagar-erros.ts
  - automation/src/tenants/tria/contas-a-pagar-lancamento.ts
  - automation/src/tenants/tria/contas-a-pagar-resolucao.ts
  - automation/src/tenants/tria/contas-a-pagar-titulo-existente.ts
  - automation/src/tenants/tria/payment-automation-service.ts
  - automation/src/tenants/tria/teste-omie-real.ts
  - automation/scripts/teste-omie-real.ts
  - automation/src/tenants/tria/payment-automation-service.plataforma.test.ts
findings:
  critical: 1
  warning: 6
  info: 10
  total: 17
status: issues_found
---

# Fase 6 (financeiro-tria/automation), rodada de fechamento 06-07..06-10: relatório de revisão de código

**Revisado em:** 2026-09-30T14:51:44Z
**Profundidade:** standard, com rastreio pontual do que o diff chama: `reivindicarReceiptExistente`/`fecharReceipt` (`receipts-da-plataforma.ts`), `criarEscritaComFila` (`plataforma.ts`), `callOmie`/`rateLimit`, `AutomationStore.upsertStep`/`createApprovalTask`/`updateRun`, `resolveAccountConfig` e `step()`.
**Arquivos revisados:** 17 (16 de código e 1 de teste lido por amostragem). Os demais testes do diff foram executados: `npm test` isolado deu 708/708 em cerca de 19 s.
**Status:** issues_found

## Resumo

Revisei `git diff 2cd13cd..HEAD -- automation`, que são os 13 commits dos planos 06-07 a 06-10, e conferi cada achado de `06-REVIEW-FINANCEIRO-TRIA.md`.

A maior parte do que a rodada anterior pediu está fechada e bem provada:
- O `/lancar` só baixa de `https:` com hostname exato na lista, recusa URL com credencial e redirecionamento, tem prazo de 15 s e teto de 15 MB lido em stream (conta bytes já descomprimidos, então uma bomba gzip também para em 15 MB), e devolve só os cinco códigos fechados, sem `url`.
- O código confirmado passa a exigir linha de despesa, folha e ativa.
- O título reaproveitado é conferido campo a campo e devolve o `dePara` lido do Omie.
- O S5 saiu do turno do webhook, tem chaves por evento, relê a Solicitação pela porta, recusa Centro de Custo sem rota antes do Omie e publica aviso com texto fixo.

O `WR-06` (S5 fora do turno do webhook) introduziu um defeito novo, **bloqueante**. A varredura de aprovações presas **reexecuta a decisão gravada no receipt**, e essa decisão é "o último que escreve vence" sobre `Aprovado` na linha. Uma aprovação cujo S5 falhou de forma transitória e que foi REPROVADA depois volta a `Aprovado = true` na linha. O RESUMO então sai numa Solicitação reprovada, com Menção a Contas a Pagar (CR-01).

Os outros pontos são avisos:
- o orçamento de anexos não garante resposta antes dos 60 s da ponte, e a repetição concorrente pode duplicar anexo;
- a lista de hosts por hostname expõe a API inteira do projeto Supabase;
- o erro cru ainda vai para o log do processo, pelo `console.log` de `upsertStep`, o que desmente a justificativa do desvio registrado no 06-10;
- a deduplicação em processo fecha o receipt como `concluido` e perde o S5;
- a varredura roda S5 em linha no ciclo do worker;
- há receipts que ficam abertos para sempre sem aviso.

Nos caminhos legados (ClickUp, MP e FO) não há mudança de fluxo. Há mudanças pequenas, além de prazo e teto, no nome do anexo e no filtro de texto do RAG (IN-03).

## Situação dos achados anteriores (`06-REVIEW-FINANCEIRO-TRIA.md`)

| Id | Situação | Evidência |
|---|---|---|
| CR-01 (SSRF por `anexos[].url`) | **fechado no `/lancar`** (com resíduo WR-02) | `hostDoAnexoPermitido` (`contas-a-pagar-anexos.ts:91-102`): WHATWG `URL`, o mesmo parser do `fetch`, `https:` exceto com política injetada, sem `username`/`password`, `hostname` exato. Mais `redirect: "error"` (`contas-a-pagar-routes.ts:670`), `AbortSignal.timeout` sobre fetch e corpo, e teto por `content-length` e por soma dos pedaços (`omie.ts:1191-1234`). `z.url().max(2048)`, `.max(20)`. `http:` só por `politicaDeAnexosDoTesteReal()`, e a rota do script escuta em 127.0.0.1 com token aleatório. Hosts IDN e IPv6 não entram na lista (regex `^[a-z0-9.-]+$`), e a URL chega normalizada em punycode. O legado segue sem lista de hosts e seguindo redirecionamento (aceito, T-6-07-08). |
| CR-02 (categoria de receita, totalizadora ou inativa) | **fechado** (resíduo IN-05 no reaproveitado) | `resolverCategoriaConfirmada` (`contas-a-pagar-resolucao.ts:386-432`): as três flags obrigatórias, e flag ausente vira `revisar`. Provado no Omie real (06-08). |
| CR-03 (anexos perdidos como "sem anexos") | **parcialmente fechado** | O reaproveitado agora consulta o `ListarAnexo` e sobe o que falta, e o relato é honesto. Mas o orçamento de 35 s só começa em `subirAnexos`, e antes dele o `/lancar` pode passar de 60 s: com REDUNDANT, cada leitura do Omie espera até 65 s × 2. A ponte então repete com o primeiro handler ainda subindo, e isso gera duplicata (WR-01). |
| WR-01 (`tentar_novamente` rodava o pipeline errado) | **fechado** | `retryRun` → `repetirResumoDaPlataforma` (`payment-automation-service.ts:1703`). A falha transitória vira `ErroTransitorioDoResumo` → `falhou_retentavel` → varredura. A varredura é a origem do CR-01 novo. |
| WR-02 (chaves por Tarefa contra texto de LLM) | **fechado** | `status:<eventId>:…`, `approval-comment:<eventId>:…`, `summary:<eventId>:comment/falha`, e o 409 `IDEMPOTENCY_KEY_REUSED` tratado como "já publicado". Regressão adjacente: um evento VELHO reprocessado publica um segundo RESUMO com a chave dele (CR-01). |
| WR-03 (snapshot velho de `linha.comentario`) | **fechado** | `executarResumoDaPlataforma` → `lerTarefa` → `mapper.mapear` → `parsePaymentComment` (`:1560`), e `publicarResumoDepoisDaAprovacao` recusa rodar na plataforma sem `parsed`. |
| WR-04 (erro cru em comentário público) | **parcialmente fechado** | O comentário público agora é fixo (`TEXTO_PUBLICO_DA_FALHA_DO_RESUMO`). O log do processo ainda recebe a mensagem crua do `ErroDoOmie` por `upsertStep` (`supabase.ts:303`) e por `console.error(erro)` com `causa` (`webhooks-plataforma.ts:919`) (WR-03). |
| WR-05 (fallback TRIA com centro sem rota) | **fechado** | `resolveAccountConfig(centro).matched` antes de `publicarResumoDepoisDaAprovacao`. O risco conhecido da FINQ na credencial padrão continua como está, com decisão pendente do dono. |
| WR-06 (S5 inteiro antes do 202) | **fechado** | `montarHandlerDeAprovacao` responde 202 antes do S5, com receipt `recebido`, `reprocessarAprovacoesPresas` e CNPJ com prazo. Defeitos novos: CR-01, WR-04, WR-05 e WR-06. |
| WR-07 (`dePara` recalculado no reaproveitado) | **fechado** | `deParaDoTitulo`, chamado depois de `camposDivergentes` dar `[]`. |
| IN-01 (`.or()` do PostgREST) | **fechado** | `filtroOrDaBuscaPorTexto` remove `, ( ) " \ % *`. |
| IN-02 (nome do anexo) | **parcialmente fechado** | Base e extensão agora são limpas separadas, `anexo-<n>`, `-2` e a extensão pelo `content-type`. `cCodIntAnexo` continua igual ao `recordId` para todos os anexos (IN-07). |
| IN-03 (URL assinada na resposta) | **fechado** | O item da resposta é `{ nome, ok, jaExistia?, erro? }` e o log troca a URL por `[url]`. |
| IN-04 (sem Menção e sem aviso) | **fechado** | `console.warn` sem o par de Contas a Pagar e `simpleMessage` por coorte. O S6 continua sem mencionar o Solicitante, como está documentado. |
| IN-05 (código sem similaridade medida) | **parcialmente fechado** | Existe a marca `(não conferido no Omie — revisar)`, mas "conferido" só quer dizer "existe no plano". Receita, totalizadora ou inativa saem sem a marca (IN-04). |
| IN-06 (`listen` sem `error`) | **fechado** | `escutarNoLoopback` com `once("error")`. O `rota.listen` do próprio script continua sem tratar `error` (IN-09). |

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: a varredura reexecuta uma decisão velha e publica o RESUMO numa Solicitação reprovada (ou um segundo RESUMO)

**Arquivos:** `automation/src/http/webhooks-plataforma.ts:950-1011` (em especial `:992`), `automation/src/tenants/tria/payment-automation-service.ts:1407-1415` e `:1484-1532`

**Problema:** `reprocessarAprovacoesPresas` retoma todo receipt `falhou_retentavel` (fora do backoff) ou `recebido` (além do lease) e, antes do S5, **roda de novo `handlePlatformApprovalDecision` com a decisão guardada no `payload`**. O comentário diz que "toda escrita da decisão é idempotente pelo evento". Isso vale para o Status e o S6, que usam chave da fila, mas não para a linha. `upsertSolicitacaoPagamento({ ..., Aprovado: approved })` é incondicional e o último que escreve vence. O S5 só confere `linha.Aprovado === true`.

Sequência concreta:
1. Evento A (`aprovada`): a decisão grava `Aprovado = true` e o 202 sai. O S5 falha de forma transitória (Omie ou plataforma fora) e o receipt A fica `falhou_retentavel`.
2. O Financeiro reprova (evento R): `Aprovado = false`, Status "não aprovado", S6 publicado. Receipt R `concluido`.
3. Depois do backoff, a varredura retoma A e reexecuta a decisão:
   - `Aprovado = true` de novo na linha;
   - `updateTaskStatus` com `status:A:aprovado` devolve o comando que já existe na fila, então a plataforma continua "não aprovado";
   - `publicarResumoDaDecisao` vê `Aprovado === true` e publica o RESUMO com `summary:A:comment` (chave nunca usada), com **Menção a Contas a Pagar numa Solicitação reprovada**.
4. A linha fica divergente da plataforma (`Aprovado = true` × "não aprovado") até a próxima decisão.

Variações do mesmo defeito:
- A (S5 transitório) → R → A2 (`aprovada`, S5 publica com a chave de A2) → a varredura retoma A e publica um **segundo RESUMO**.
- Sem varredura nenhuma: o S5 de A em voo lê `Aprovado` só no começo (`:1500`). Se R chega durante o S5, que agora é assíncrono e pode levar minutos, o RESUMO sai depois da reprovação.

O teste D7 prova só `publicar` direto depois de R, nunca a varredura, que regrava a decisão antes.

**Correção:**
- (1) A varredura não reexecuta decisão já gravada. No passo 5 do handler, depois de `decidir`, marque no receipt `payload.decisaoGravada = true`. Na varredura, com a marca, chame só `publicarResumoDaDecisao`.
- (2) A plataforma é a fonte da verdade, então o S5 confere o Status relido antes de qualquer efeito e de novo imediatamente antes do `createComment` do RESUMO:
```ts
const tarefa = await this.lerTarefa(taskId);
if (tarefa.status !== "aprovado") {
  console.info(`[plataforma] ${taskId} não está "aprovado" na plataforma; S5 do evento ${opcoes.ciclo} ignorado`);
  return { resumoPublicado: false, ignorado: "nao_aprovada" };
}
```
- (3) Para a linha, torne a decisão monotônica: guarde o `eventId` (ou o `occurredAt` do evento) da última decisão e ignore evento mais antigo em `handlePlatformApprovalDecision`.
- (4) Teste: A (S5 transitório) → R → `reprocessarAprovacoesPresas` ⇒ nenhum RESUMO e `Aprovado` continua `false`.

## Warnings

### WR-01: o orçamento dos anexos não conta desde o início do `/lancar`; a repetição da ponte corre com o primeiro handler e duplica anexo (CR-03 residual)

**Arquivos:** `automation/src/tenants/tria/contas-a-pagar-anexos.ts:253-254`, `automation/src/tenants/tria/contas-a-pagar-lancamento.ts:344-358` e `:455-464`, `automation/src/adapters/omie.ts:1298-1370`

**Problema:** `inicio = Date.now()` é tomado dentro de `subirAnexos`. Antes dele vêm, sem prazo total:
- a resolução (`ListarCategorias` paginado, contas, departamentos, embedding);
- a consulta;
- `consultarTitulo` (duas leituras);
- o CNPJ (8 s);
- `garantirFornecedor`;
- `IncluirContaPagar`.

O `callOmie` não tem prazo no `fetch` (vale o padrão de 300 s do undici), espaça as chamadas pelo `OMIE_MAX_RPS` e, em REDUNDANT, espera até 65 s por tentativa (2 esperas por leitura). Um único REDUNDANT já leva o `/lancar` além dos 60 s do `TIMEOUT_LANCAR_MS`. A ponte aborta e repete, e o handler antigo segue subindo anexos. A repetição chega ao `ListarAnexo`, que não vê o `IncluirAnexo` em voo, e sobe de novo: **duplica NF/boleto no título**. O próprio `correrContraOrcamento` documenta que a promessa perdedora "continua rodando".

**Correção:**
- Um prazo por requisição (ex.: 50 s desde a entrada do handler), passado a `subirAnexos` como `orcamentoTotalMs = min(35 s, prazo − decorrido)`.
- Serializar em processo por `codigoLancamentoIntegracao`: um `Map<string, Promise<ResultadoDoLancamento>>`, em que a repetição espera a primeira e devolve o mesmo resultado, como `inFlight` faz no serviço.
- Opcionalmente, `AbortSignal.timeout` no `fetch` de `callOmie` para as leituras.

### WR-02: a lista de hosts por hostname libera a API inteira do projeto Supabase, não só o Storage

**Arquivo:** `automation/src/tenants/tria/contas-a-pagar-anexos.ts:91-102`

**Problema:** o valor de produção é o host do projeto (`<ref>.supabase.co`), o mesmo que serve `/rest/v1/*` (PostgREST, `apikey` aceito na query), `/auth/v1/*`, `/functions/v1/*` (Edge Functions por GET) e `/graphql/v1`. Quem tem o token da rota, ou compromete a ponte, pode apontar `anexos[].url` para `https://<ref>.supabase.co/rest/v1/<tabela>?select=*&apikey=<anon>` ou acionar uma Edge Function. A resposta sobe ao Omie como "anexo", que qualquer usuário do ERP baixa. O CR-01 anterior era sobre o raio do dano, e o Storage precisa só de `/storage/v1/object/…`.

**Correção:** restringir também o caminho:
```ts
const PREFIXOS_DO_STORAGE = ["/storage/v1/object/sign/", "/storage/v1/object/public/", "/storage/v1/object/authenticated/"];
if (!PREFIXOS_DO_STORAGE.some((p) => alvo.pathname.startsWith(p))) return false;
```
A política de teste pode injetar `prefixosPermitidos: ["/"]`. Opcionalmente, fixar também o bucket (`/sign/<bucket>/`).

### WR-03: o erro cru do S5 ainda vai para o log do processo, e a premissa do desvio do 06-10 é falsa (WR-04 residual)

**Arquivos:** `automation/src/adapters/supabase.ts:303`, `automation/src/tenants/tria/payment-automation-service.ts:2890-2898` (`step`), `automation/src/http/webhooks-plataforma.ts:919` e `:856`

**Problema:** o 06-10 adiou "`step()` grava `error.message` cru em `upsertStep`" dizendo que isso "não vai para o log do processo". Vai. `AutomationStore.upsertStep` faz `console.log(\`[step] ${stepKey} | ${status} | ${errorMessage}\`)`, e a `message` do `ErroDoOmie` mantém o corpo cru do Omie (`omie.ts:1352`, só as credenciais são redigidas). No cenário do F1 (`IncluirCliente` recusado), o pm2 recebe `[step] supplier | failed | Omie IncluirCliente failed: 500 {"faultstring":"… O CNPJ 12.345.678/0001-90 de FORNECEDOR … já está cadastrado"}`, com CNPJ e razão social, que é exatamente o que o F1 prova não estar no `console.error`. Além disso, `console.error(…, erro)` em `publicarResumoDaDecisaoReivindicado` imprime o `ErroTransitorioDoResumo` inteiro, e o `util.inspect` mostra a propriedade `causa` com a mensagem crua.

**Correção:** em `step()`, gravar e registrar `textoSemSegredo(...)` (ou, na coorte plataforma, `detalheSanitizadoDaFalha`) no lugar de `error.message`, sem mudar o que o legado relança. No webhook, registrar só `classificarErro(erro).code` e o `summary` já sanitizado. Um teste F1-bis que espie `console.log` também.

### WR-04: a deduplicação em processo fecha o receipt `concluido` sem rodar o S5 do evento e pode sobrescrever um `falhou_retentavel`

**Arquivos:** `automation/src/tenants/tria/payment-automation-service.ts:1488-1493` e `:1710-1715`, `automation/src/http/webhooks-plataforma.ts:903-910`, `automation/src/http/receipts-da-plataforma.ts:268-291`

**Problema:** a chave é `resumo:<taskId>`, não o evento. Se o S5 do evento A está em voo e chega o S5 de outro evento C da mesma Tarefa (novo ciclo, ou varredura e webhook de eventos diferentes), C espera A, devolve `{ deduped: true }` e `publicarResumoDaDecisaoReivindicado` fecha o receipt de C como `concluido`. O RESUMO do ciclo C nunca sai e ninguém é avisado.

Para o MESMO evento, reivindicado de novo depois do lease (S5 mais longo que `PLATAFORMA_RECEIPT_LEASE_MIN`, que é configurável):
- as duas execuções fecham o receipt por `fecharReceipt`, que é um `update` incondicional por `event_id`, sem conferir `attempts` ou dono;
- se a primeira falhou de forma transitória (`falhou_retentavel`) e a segunda grava `concluido` depois, a repetição se perde.

**Correção:** `deduped` não pode ser sucesso. Faça `publicarResumoDaDecisao` lançar `ErroTransitorioDoResumo("PLATAFORMA_INDISPONIVEL" | novo código interno de "em andamento", …)` quando deduplicar, para o receipt fechar `falhou_retentavel` e a varredura voltar depois. Em `fecharReceipt`, aceitar um `attempts` esperado (CAS `.eq("attempts", tentativa)`) para quem reivindicou.

### WR-05: a varredura roda os S5 em série dentro do ciclo do worker e trava a fila e a varredura de comentários

**Arquivos:** `automation/src/http/worker-da-plataforma.ts:100-127`, `automation/src/http/webhooks-plataforma.ts:969-1008`

**Problema:** `processarCiclo` é um ciclo por vez (`emAndamento`), e o terceiro passo aguarda até 20 S5 em série. Cada um faz `getTask`, `ensureSupplier`, `ListarCategorias` (até 20 páginas, com esperas de REDUNDANT de até 65 s), embeddings e LLM, sem prazo total. Depois de uma queda do Omie ficam dezenas de `falhou_retentavel`, e um único ciclo leva minutos. Nesse tempo, o passo 1 (repetições da fila `platform_adapter_commands` de TODAS as Tarefas) e o passo 2 (classificação de comentários presos) não rodam.

**Correção:** limitar a 1 ou 2 aprovações por ciclo (`limite` padrão baixo), ou rodar o S5 da varredura desanexado do ciclo (`void`, com o mesmo guarda de concorrência por Tarefa) e só reivindicar no ciclo. O ideal é somar um prazo total por S5.

### WR-06: receipt de aprovação que fica aberto para sempre, sem aviso na Solicitação

**Arquivo:** `automation/src/http/webhooks-plataforma.ts:736-751` (`filtrarCandidatosDaVarredura`) e `:950-1011`

**Problema:** o filtro exclui `attempts >= maxTentativas`. Com `ultimaTentativa`, o S5 avisa e fecha, mas dois caminhos escapam:
- o processo morre durante a tentativa `maxTentativas`: o receipt fica `recebido` e `attempts = max`;
- a DECISÃO falha de forma transitória na última tentativa (a plataforma fora no `updateTaskStatus`): o receipt fecha `falhou_retentavel`, e `ultimaTentativa` só chega ao S5.

Nos dois casos o receipt nunca mais entra na varredura, o outbox não reentrega (já recebeu 202) e a Solicitação aprovada fica sem RESUMO e sem aviso. Só o CLI `reprocessar-receipt` enxerga.

**Correção:** na varredura, para linha não terminal com `attempts >= maxTentativas` e lease vencido, fechar `falhou` e, sendo `aprovada`, publicar o aviso fixo uma vez (`summary:<eventId>:falha`, que já é idempotente). No mínimo, um `console.error` por linha abandonada.

## Info

### IN-01: `jaExistia` é decidido antes da política de host

**Arquivo:** `automation/src/tenants/tria/contas-a-pagar-anexos.ts:275-282`

**Problema:** no reaproveitado, um anexo de URL fora da lista (ou qualquer URL) cujo nome normalizado coincide com um anexo do título volta `{ ok: true, jaExistia: true }`. Isso não baixa nada, mas relata sucesso de uma URL que a política recusaria e revela os nomes que o título já tem a quem tem o token.

**Correção:** conferir `hostDoAnexoPermitido` primeiro e só então `jaEstaNoTitulo`.

### IN-02: `ANEXO_OMIE_RECUSOU` também para o Omie fora do ar

**Arquivo:** `automation/src/tenants/tria/contas-a-pagar-anexos.ts:196-200` e `:264-267`

**Problema:** um `ErroDoOmie` de `natureza: "infraestrutura"` no `IncluirAnexo` ou no `ListarAnexo` (sem resposta, 5xx, REDUNDANT esgotado) vira "o Omie recusou". A ponte comenta uma recusa quando a causa foi uma queda, e ninguém repete.

**Correção:** como a lista é fechada, mapear a infraestrutura para `ANEXO_TEMPO_ESGOTADO` (o anexo "não coube"), ou documentar no contrato que `ANEXO_OMIE_RECUSOU` cobre a indisponibilidade.

### IN-03: mudanças de comportamento no legado além de prazo e teto

**Arquivos:** `automation/src/adapters/omie.ts:48-56` e `:1148-1161`, `automation/src/adapters/supabase.ts:50-60`

**Problema:** nenhuma quebra o fluxo, mas a meta era "nenhuma mudança além de prazo e teto". Os três tenants legados agora:
- (a) acrescentam a extensão do `content-type` a nome sem extensão;
- (b) normalizam `.env` como `arquivo.env` e `arquivo.` como `arquivo`;
- (c) aparam o `fileName`;
- (d) não lançam mais `URIError` num segmento mal codificado;
- (e) gravam em `uploaded[].error` a mensagem nova (`download do anexo falhou: HTTP 404` no lugar de `download anexo falhou: 404 Not Found`).

Além disso, `filtroOrDaBuscaPorTexto` muda o fallback de texto do `matchCategory` também para ClickUp, MP e FO: palavras com `,()"\%*` perdem esses caracteres, e as que ficam com 3 ou menos caracteres saem.

**Correção:** registrar isso no README e no SUMMARY como mudança aceita, ou restringir (a) e (e) ao `/lancar`.

### IN-04: `conferidoNoOmie` no RESUMO só quer dizer "existe no plano de contas"

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:2078-2083` (e `resolveCategoryCodeAgainstOmie`, `:394-419`)

**Problema:** o `omieMap` do S5 legado tem todas as linhas do `ListarCategorias`. Uma receita, totalizadora ou inativa achada pelo RAG sai sem a marca `(não conferido no Omie — revisar)`, justamente o que o CR-02 fechou no `/resolver`.

**Correção:** montar o `omieMap` do S5 com as três flags e exigir despesa, folha e ativa para `conferidoNoOmie` (só na coorte plataforma, para não mudar o legado).

### IN-05: no reaproveitado, `deParaDoTitulo` marca como `resolvida` o código do título mesmo fora do plano de contas ou fora da regra do CR-02

**Arquivo:** `automation/src/tenants/tria/contas-a-pagar-resolucao.ts:586-602`

**Problema:** um título antigo, lançado antes do 06-08 ou à mão, com código de receita ou inexistente no plano volta `veredito: "resolvida"`, com o nome da Categoria do pedido como fallback. O passo 5 (veredito) é pulado no reaproveitado. O impacto é baixo, porque o título já existe, mas o "Lançado · {categoria} ({código})" da plataforma afirma uma categoria válida.

**Correção:** quando a linha não existe no plano, ou não passa nas flags, devolver `veredito: "revisar"` com motivo, sem recusar o reaproveitado.

### IN-06: `contaConfirmada` é comparada pelo rótulo, não pelo id

**Arquivo:** `automation/src/tenants/tria/contas-a-pagar-lancamento.ts:271-285`

**Problema:** duas contas correntes com a mesma `descricao`, ou uma troca de `nCodCC` sob o mesmo rótulo, passam como "a mesma conta". Isso segue o contrato v1.2, que fixa rótulos.

**Correção:** registrar como limite conhecido. Numa v1.3, a Conferência pode guardar também o id da conta.

### IN-07: `cCodIntAnexo` continua igual ao `recordId` para todos os anexos do título

**Arquivo:** `automation/src/adapters/omie.ts:1176-1178`

**Problema:** o IN-02 anterior pedia desambiguação. Os nomes foram desambiguados, mas o código de integração do anexo continua o mesmo para todos.

**Correção:** `cCodIntAnexo: \`${recordId}:${normalizedName}\`` (só no `/lancar`, se o legado precisar ficar como está), ou confirmar no Omie real que duplicatas são aceitas e registrar.

### IN-08: a redação dos valores da Solicitação diferencia maiúsculas

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:616-635` (`valoresSensiveisDaSolicitacao`), `automation/src/adapters/omie.ts:165-172` (`redigirValores`)

**Problema:** o Omie costuma ecoar a razão social como está no cadastro, em maiúsculas. `split(alvo)` só redige a grafia exata do pedido, e a razão social passa para o `technicalMessage` e para o log. O F1 usa a mesma grafia nos dois lados.

**Correção:** redigir sem diferenciar maiúsculas e acentos (regex escapada com a flag `i` sobre o texto normalizado).

### IN-09: `rota.listen` do script `teste-omie-real` sem tratar `error`

**Arquivo:** `automation/scripts/teste-omie-real.ts:112`

**Problema:** o IN-06 anterior foi corrigido no servidor efêmero (`escutarNoLoopback`), mas a rota montada pelo próprio script ainda usa `listen(0, "127.0.0.1", resolve)` sem `once("error")`.

**Correção:** reusar `escutarNoLoopback(rota)`.

### IN-10: `retryRun("summary")` com a varredura ainda pendente publica dois RESUMOs

**Arquivo:** `automation/src/tenants/tria/payment-automation-service.ts:1703-1731`

**Problema:** com o receipt do evento em `falhou_retentavel`, fora de voo, a repetição pelo painel publica com `summary:retry-<uuid>:comment`. Depois, a varredura publica com `summary:<eventId>:comment`. A deduplicação `resumo:<taskId>` só cobre execuções simultâneas.

**Correção:** no fim de `repetirResumoDaPlataforma` com sucesso, fechar como `concluido` os receipts `aprovacao-decidida` não terminais da Tarefa, ou recusar a repetição enquanto houver receipt não terminal.

---

_Revisado em: 2026-09-30T14:51:44Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
