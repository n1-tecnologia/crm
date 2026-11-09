---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 09
subsystem: api
tags: [mensageria, anexos, midia, storage, url-assinada, assinatura-de-arquivo, zip, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`reenviar`, `atualizarStatusDeEntrega` e o serviço de Mensagens com a Mensagem nascendo `pendente` (16-06)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`avisarCrm` no mesmo cliente da transação do `enviar` (16-07)"
provides:
  - "`@n1/dominio/crm/midia`: `TIPOS_ACEITOS_NA_MENSAGEM` (17 tipos), `normalizarTipoDeMidia`, `categoriaDaMidia`, `tiposAceitosParaOCanal`, `tetoDaMidia`, `ehDocumento`, `TETO_PADRAO_*`"
  - "`@n1/dominio/crm/mensagens`: `AnexoDaMensagem` com `objectKey?`, `tamanhoBytes?` e `baixado`; `ReferenciaDeAnexoEnviado`, `AnexoConfirmado`, `MAX_ANEXOS_POR_MENSAGEM`, `NovaMensagem.anexos`, `validarAnexosDoEnvio`; texto OU anexo (INV-CXE-07)"
  - "`servicos/armazenamento-de-anexos.ts`: a porta `ArmazenamentoDeAnexos` e `armazenamentoDeAnexosPadrao()` (delega a `storage-uploads.ts`); `testes/armazenamento-falso.ts`: `criarArmazenamentoFalso()`"
  - "`storage-uploads.ts`: `emitirTicket`/`confirmarObjeto` com `opcoes` (tipos, prefixo, teto), assinaturas de OggS, MP3, MP4/3GP/M4A, AAC, ZIP e Office, `familiaDoZip`, `pareceTexto`, `tetosDeMidia`/`tetoDoTipo`/`MAX_BYTES_DE_MIDIA`, `urlDeDownload(..., { download })`, `subirObjeto`, `removerObjetos`, `listarObjetos`"
  - "`POST /mensagens/anexos`, `POST /mensagens` com `anexos`, `GET /mensagens/:id/anexos/:indice`; `ServicoDeMensagens.pedirTicketDeAnexo` e `urlDoAnexo`; `Recusa` ganhou o status 422"
affects: [16-10, 16-11, 16-12, 16-14]

actuals:
  tokens: 25700
  tasks: 3
  commits: 5
plan_head_before: b90fa568170fe5fc1de3edcb8a3cefa9734abfb3
plan_head_after: e8b0ad810577c720db14e6b056c0f3c0445ac1dd

tech-stack:
  added: []
  patterns:
    - "a chave do objeto nasce no servidor (`workspace/<ws>/conversas/<conversaId>/<uuid>`); o cliente devolve só `{ submissionId, objectId }` e a sessão tem de ser `conversa-<id>` do mesmo Espaço"
    - "o arquivo é conferido pelo CONTEÚDO inteiro contra o tipo RESERVADO na sessão (normalizado), não só pelo `contentType` do bucket"
    - "zip e Office lidos só pelo diretório central (EOCD nos últimos 64 KiB + nomes das entradas): nada é descomprimido, nenhum pacote novo"
    - "uma porta (`ArmazenamentoDeAnexos`) separa o serviço do Supabase: os testes de rota e de mídia rodam com o falso em memória, que usa as MESMAS funções puras de assinatura"
    - "documento (PDF, XML, Office, csv, txt, zip) sai sempre com `download` (`Content-Disposition: attachment`); imagem, áudio e vídeo abrem no `<img>/<audio>/<video>`"

key-files:
  created:
    - packages/dominio/src/crm/midia.ts
    - packages/dominio/src/crm/midia.test.ts
    - apps/api/src/servicos/armazenamento-de-anexos.ts
    - apps/api/src/testes/armazenamento-falso.ts
  modified:
    - packages/dominio/src/crm/mensagens.ts
    - packages/dominio/src/crm/mensagens.test.ts
    - apps/api/src/servicos/storage-uploads.ts
    - apps/api/src/servicos/storage-uploads.test.ts
    - apps/api/src/servicos/crm/mensagens.ts
    - apps/api/src/repositorios/crm/mensagens.ts
    - apps/api/src/rotas/crm/mensagens.ts
    - apps/api/src/rotas/crm/mensagens.test.ts
    - apps/api/src/rotas/formularios-publicos.test.ts
    - apps/api/src/servicos/crm/resultado.ts
    - apps/api/src/servicos/crm/recebimento.ts
    - apps/api/src/servicos/crm/recebimento.test.ts

key-decisions:
  - "`Recusa.status` ganhou 422 (`servicos/crm/resultado.ts`): o plano manda 422 para arquivo grande demais, de outra Conversa e de tipo que o Canal não envia, e o tipo só aceitava 400/403/404/409. `responder()` já repassa qualquer status."
  - "A rota recusa `conteudo` vazio SEM anexo com um `.refine` no corpo (400), e o domínio refaz a regra: o texto vazio só passa com um anexo, e a frase nova é \"Escreva a mensagem ou anexe um arquivo antes de enviar.\""
  - "`confirmarObjeto` roda DENTRO do `comTransacao` do `enviar` (como o plano manda): a transação segura uma conexão durante o download do objeto (até 25 MiB). Uma sessão já usada falha no `consumirSessao` (409 `ANEXO_JA_USADO`) e a Mensagem não fica."
  - "A Mensagem só com anexo grava `conteudo = null` (o CHECK `mensagens_conteudo_ck` aceita anexo sem texto)."
  - "A porta ganhou `tetoDoTipo(mime)` e o ticket ganhou `tamanhoBytes?`: sem isso o serviço teria de importar `storage-uploads` e ler a variável de ambiente, e a defesa de tamanho no `emitirTicket` não teria o que comparar."
  - "Nota `interna` pode levar anexo (a lista da Mensagem vale, o Canal não é consultado: ela não sai pelo Canal); só a `enviada` passa por `validarAnexosDoEnvio`."
  - "O `Mensagem` devolvido (POST e GET /mensagens) carrega `objectKey` do anexo, como o plano pede no teste do tracador; nenhuma mensagem de ERRO cita a chave e o download confere que ela é do Espaço da sessão antes de assinar."
  - "`text/xml` não está em `TIPOS_ACEITOS_NA_MENSAGEM` (são 17 tipos, um XML só: `application/xml`); o Formulário continua com os dois."

patterns-established:
  - "Quem anexa pede o ticket (`POST /mensagens/anexos`), sobe os bytes no `uploadUrl` e devolve `{ submissionId, objectId }` em `POST /mensagens`; ver `rotas/anexos-da-tarefa.ts`, de que este fluxo é irmão."

requirements-completed: [MSG-04]

coverage:
  - id: D1
    description: "A lista de tipos da Mensagem tem os 17 tipos (D-16-09), cada um com categoria; o Canal só aceita os tipos das categorias de `sendableMediaTypes`; teto 16 MiB para áudio e vídeo e 25 MiB para o resto; `audio/ogg; codecs=opus` normaliza para `audio/ogg`"
    requirement: MSG-04
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/midia.test.ts (10 testes)"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/crm/mensagens.test.ts#validarAnexosDoEnvio e validarNovaMensagem (texto OU anexo, no máximo 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uma imagem anexada sobe por ticket (chave do Espaço e da Conversa, sessão `conversa-<id>`), vai com a Mensagem sem texto (sessão consumida na mesma transação) e abre por uma URL assinada nova, sem `download`"
    requirement: MSG-04
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/mensagens.test.ts#Anexo da Mensagem (16-09, 3.9.3, MSG-04) (3 testes do tracador)"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/crm/mensagens.test.ts#serviço falso (ticket, anexos, 401, 400 por campo extra e por índice inválido)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Áudio, vídeo e documentos são conferidos pelo conteúdo: OggS, ID3 e quadro MP3, ftyp, ADTS, zip e a família do Office por `[Content_Types].xml` + pasta; csv e txt só sem NUL e sem controle C0; arquivo de texto renomeado para .ogg recusado; zip sem diretório central recusado; teto por tipo"
    requirement: MSG-04
    verification:
      - kind: unit
        ref: "apps/api/src/servicos/storage-uploads.test.ts#assinatura de áudio, vídeo e documento; familiaDoZip; csv e txt; teto por tipo (30 testes puros, sem env)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O Formulário público segue com os seis tipos de hoje e recusa áudio, vídeo, Office, csv, txt e zip no ticket; nenhum pacote de zip ou de tipo de arquivo foi instalado"
    requirement: MSG-04
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/formularios-publicos.test.ts#(l) T-16-36: o ticket do Formulário recusa <tipo> (7 casos)"
        status: pass
      - kind: unit
        ref: "apps/api/src/servicos/storage-uploads.test.ts#a lista do Formulário continua com os seis tipos de hoje"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sessão de outra Conversa ou de outro Espaço, sessão já usada, dois anexos, Canal que não envia o tipo, tipo fora da lista e arquivo grande demais são recusados sem gravar nada; download recusa Membro de outro Espaço (404) e Membro removido (403), índice inexistente e `baixado: false` (404); documento sai sempre com `download`; nenhuma resposta cita a chave do objeto"
    requirement: MSG-04
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/mensagens.test.ts#recusas por Conversa, Espaço, Papel e Canal (Task 3) (24 testes)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Contra o bucket REAL do Supabase: o ticket assinado aceita o upload do navegador, `confirmarObjeto` mede o objeto que de fato chegou, e a URL com `download` entrega `Content-Disposition: attachment`"
    requirement: MSG-04
    verification: []
    human_judgment: true
    rationale: "O Storage real só roda com `SUPABASE_*`; todos os testes deste plano usam o armazenamento falso. O `info`/`download`/`createSignedUrl` do SDK já são os do 02-11 e do 07.3, mas o `createSignedUrl(..., { download })` e o `list` com `created_at` (usado pela coleta de órfãos do 16-10) são [ASSUMED] até a prova ao vivo (16-16)."

duration: 17min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 09: Anexo da Mensagem ligado a um arquivo guardado Summary

**Uma imagem, um áudio ou um documento sobe ao bucket por ticket assinado, vai junto da Mensagem (sessão consumida na mesma transação) e só abre por URL assinada para quem pode ler a Conversa; o arquivo é conferido pelo conteúdo (OggS, ID3, ftyp, ADTS, diretório central do ZIP, texto sem NUL) contra o tipo reservado e contra o teto de 16 MiB (áudio e vídeo) ou 25 MiB (o resto), e o Formulário público continua com os seis tipos de hoje.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-11-09T19:13:59Z
- **Completed:** 2026-11-09T19:31:18Z
- **Tasks:** 3
- **Files modified:** 16 (4 novos, 12 alterados), 1760 linhas inseridas

## Accomplishments

- Domínio: `crm/midia.ts` com os 17 tipos, a categoria de cada um, os tetos e `tiposAceitosParaOCanal`; o anexo da Mensagem ganhou `objectKey`, `tamanhoBytes` e `baixado`; `validarNovaMensagem` aceita texto OU um anexo (no máximo 1) e `validarAnexosDoEnvio` recusa o tipo cuja categoria o Canal não declara.
- `storage-uploads.ts` parametrizado sem mexer no Formulário: `emitirTicket` e `confirmarObjeto` recebem `opcoes` (tipos, prefixo da chave, teto por tipo); sem elas o comportamento é o de hoje. A confirmação compara o tipo RESERVADO e confere o conteúdo inteiro.
- Assinaturas novas: OggS, MP3 (ID3 e quadros), `ftyp` no byte 4 (MP4, M4A, 3GP), ADTS, ZIP, e docx/xlsx/pptx por `[Content_Types].xml` + `word/`, `xl/` ou `ppt/` lidos do diretório central (EOCD nos últimos 64 KiB, comentário que imita EOCD ignorado, ZIP64 e diretório inflado recusados). csv e txt só valem como texto (aceita Windows-1252).
- A porta `ArmazenamentoDeAnexos` e o falso em memória, que usa as mesmas funções puras de assinatura: toda a rota roda sem Supabase.
- Rotas: `POST /mensagens/anexos` (ticket), `POST /mensagens` com `anexos: [{ submissionId, objectId }]` (confirma e consome a sessão no mesmo `comTransacao`) e `GET /mensagens/:id/anexos/:indice` (URL assinada nova; documento com `download`).

## Task Commits

Plano `type: execute`, tarefas `tdd="true"`; Task 1 é o traçador.

1. **Task 1 (traçador), RED** - `7a624ff` (test): domínio, porta, falso e rotas; 15 testes de rota e 14 de domínio falham por asserção (`expected 404 to be 200`, `expected 400 to be 201`, listas vazias).
2. **Task 1, GREEN** - `e872873` (feat): `midia.ts`, o anexo no domínio e no serviço, as três rotas, a porta padrão sobre o `storage-uploads`.
3. **Task 2, RED** - `9d1d7c6` (test): 12 testes de assinatura, `familiaDoZip` e texto falham por asserção contra esqueletos.
4. **Task 2, GREEN** - `bcf31ca` (feat): as assinaturas novas, `familiaDoZip`, `pareceTexto`.
5. **Task 3** - `e8b0ad8` (test): 24 testes de recusa (ver Gate Compliance: nasceram verdes).

**Plan metadata:** commit `docs(16-09)` seguinte (STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `packages/dominio/src/crm/midia.ts` (+ teste) - lista, categoria, teto
- `packages/dominio/src/crm/mensagens.ts` (+ teste) - o anexo novo, `validarNovaMensagem`, `validarAnexosDoEnvio`
- `apps/api/src/servicos/armazenamento-de-anexos.ts` - a porta e a implementação padrão
- `apps/api/src/testes/armazenamento-falso.ts` - o falso em memória (objetos, sessões, URLs emitidas, falha injetável)
- `apps/api/src/servicos/storage-uploads.ts` (+ teste) - `opcoes`, assinaturas, `familiaDoZip`, `pareceTexto`, tetos, `download`, `subirObjeto`/`removerObjetos`/`listarObjetos`
- `apps/api/src/servicos/crm/mensagens.ts` - `pedirTicketDeAnexo`, `enviar` com anexos, `urlDoAnexo`, `formIdDaConversa`
- `apps/api/src/repositorios/crm/mensagens.ts` - `inserir` grava `anexos`; `linhaParaMensagem` lê `baixado ?? false`
- `apps/api/src/rotas/crm/mensagens.ts` (+ teste) - as três rotas e os esquemas `.strict()`
- `apps/api/src/rotas/formularios-publicos.test.ts` - o Formulário recusa áudio, vídeo, Office, csv, txt e zip
- `apps/api/src/servicos/crm/{resultado,recebimento}.ts`, `recebimento.test.ts` - 422 em `Recusa`; `baixado: false` no anexo recebido (ver desvios)

## Decisions Made

Ver `key-decisions`. O que mais pesa para os próximos planos:

- **16-10 (mídia recebida):** use a porta (`armazenamento.subir/remover/listar/urlAssinada`) e `tetoDoTipo`; grave o anexo com `{ tipoDeMidia (normalizado), nome, objectKey, tamanhoBytes, baixado: true }`, ou `baixado: false` com `referenciaExterna`. O `recebimento.ts` hoje grava `baixado: false` em todo anexo recebido. `listarObjetos` lista UMA pasta (sem descer) e devolve só arquivos com `created_at`; a coleta de `entrada/` tem de listar por pasta de Canal.
- **16-11/16-12 (tela):** o fluxo é ticket -> `PUT` dos bytes no `uploadUrl` (com `contentType` igual ao `tipoDeMidia` do ticket, senão a confirmação recusa por `tipo_nao_confere`) -> `POST /mensagens` com `conteudo` vazio e `anexos`. A URL de download vem de `GET /mensagens/:id/anexos/:indice` a cada abertura (TTL 5 min); documento só baixa. Códigos de recusa: `ANEXO_DE_OUTRA_CONVERSA`, `ANEXO_NAO_ENCONTRADO`, `ANEXO_JA_USADO` (409), `ARQUIVO_GRANDE_DEMAIS`, `TIPO_NAO_ACEITO`, `TIPO_NAO_ENVIADO_PELO_CANAL`, `ARQUIVO_NAO_CONFERE`, `ARQUIVO_AUSENTE` (todos 422 salvo o indicado) e `ARQUIVO_INDISPONIVEL` (404). O seletor de arquivo deve usar `tiposAceitosParaOCanal(capacidades.sendableMediaTypes)` do domínio.
- O entregador (`entregar-mensagem.ts`) AINDA NÃO manda o anexo ao provedor: `EnvioAoProvedor.anexos` e a URL assinada são do 16-10.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Recusa.status` não aceitava 422**
- **Found during:** Task 1
- **Issue:** o plano pede 422 para arquivo grande demais, de outra Conversa e de tipo que o Canal não envia; o tipo da recusa do CRM era `400 | 403 | 404 | 409`.
- **Fix:** `422` entrou na união (`servicos/crm/resultado.ts`, fora dos `files_modified`); `responder()` já repassa qualquer status.
- **Files modified:** `apps/api/src/servicos/crm/resultado.ts`
- **Verification:** `tsc` limpo; testes de rota 422 passando.
- **Committed in:** `e872873`

**2. [Rule 3 - Blocking] `AnexoDaMensagem.baixado` obrigatório quebra o anexo recebido e um teste**
- **Found during:** Task 1
- **Issue:** `baixado: boolean` obrigatório faz o `tsc` recusar o `recebimento.ts`, que monta o anexo da `recebida` sem ele; e `linhaParaMensagem` passa a devolver `baixado: false`, que quebra `recebimento.test.ts:221` (`toEqual` sem a chave).
- **Fix:** `recebimento.ts` grava `baixado: false` (só a referência do provedor; a mídia guardada é do 16-10) e o teste espera a chave. O `mapeador.ts` da migração não muda: o tipo dele é `unknown[]` e as linhas migradas leem `false`.
- **Files modified:** `apps/api/src/servicos/crm/recebimento.ts`, `apps/api/src/servicos/crm/recebimento.test.ts`
- **Verification:** `recebimento.test.ts` e `tsc` verdes na rodada ampla.
- **Committed in:** `e872873`

**3. [Rule 2 - Missing Critical] Rede de segurança no download e erro do armazenamento sem vazar a chave**
- **Found during:** Task 1 (threat model T-16-33/34)
- **Issue:** `urlDoAnexo` assinaria qualquer `objectKey` que a linha trouxesse, e uma falha do SDK subiria com a mensagem (que pode citar a chave) até o log.
- **Fix:** o download exige a chave sob `workspace/<ws da sessão>/`; as chamadas ao armazenamento passam por `noArmazenamento`, que relança só o código (`armazenamento_indisponivel: <código>`), sem a mensagem original.
- **Files modified:** `apps/api/src/servicos/crm/mensagens.ts`
- **Verification:** testes "a chave de OUTRO Espaço ... nunca vira URL" e "uma falha do armazenamento vira 500 genérico".
- **Committed in:** `e872873`

### Decisões do planejador que o plano deixou abertas

- A rota recusa `conteudo` vazio sem anexo por `.refine`, e o domínio mudou a frase para "Escreva a mensagem ou anexe um arquivo antes de enviar."; `conteudo` vazio com anexo grava `null`.
- `tetoDoTipo` na porta e `tamanhoBytes?` no ticket (aditivos ao `<interfaces>`).
- `listarObjetos` do bucket só lista uma pasta e só devolve arquivos com `created_at`.

---

**Total deviations:** 3 auto-fixed (2 Rule 3, 1 Rule 2)
**Impact on plan:** nenhuma muda o contrato público do `<interfaces>` além de acrescentar `tetoDoTipo`, `tamanhoBytes?` e o status 422. Sem scope creep.

## TDD Gate Compliance

O plano é `type: execute` e `workflow.tdd_mode` é `false`: não usei `gsd_run check tdd-red-evidence`; a avaliação semântica foi manual (o alvo executou e falhou na asserção planejada, nunca por import ou sintaxe).

- **Task 1 (traçador):** RED `7a624ff`: `midia.test.ts` e `mensagens.test.ts` do domínio falharam 14 de 53 em valores errados (lista vazia, `validarAnexosDoEnvio` que sempre aceita, `expected false to be true`); as rotas, 15 de 50 em `expected 404 to be 200` (rota inexistente) e `expected 400 to be 201` (corpo estrito). Parte dos testes de 400 passou por construção (a rota não existia). GREEN `e872873`: 53/53 e 50/50. Traçador reverificado: os dois comandos `<automated>` do plano (domínio + `tsc`; API em Postgres de Docker novo) passaram antes da expansão (sem `blocking-human` e sem `<human-check>`, `human_verify_mode` `end-of-phase`).
- **Task 2:** RED `9d1d7c6`: 12 de 43 falham por asserção (`expected false to be true`, `expected undefined to be 'docx'`) contra os esqueletos de `familiaDoZip`/`pareceTexto` e o `assinaturaConfereComTipo` antigo. Nasceram verdes por construção: o teto por tipo (`tetoDoTipo` foi preciso já na Task 1, para a porta padrão), a lista do Formulário e o teste de `emitirTicket` (o Formulário nunca aceitou áudio). `midia.test.ts` do domínio (teto, `tiposAceitosParaOCanal`, `ehDocumento`) também entrou no RED da Task 1. GREEN `bcf31ca`: 43 passando e 13 pulados (integração com Supabase, como hoje).
- **Task 3:** os 24 testes de recusa **nasceram verdes**: o serviço do Task 1 já aplicava todas as recusas (o plano as lista como "completar", mas elas eram parte do fluxo). Para provar que não são vácuos, três mutações no serviço (tirar a conferência de `formId`, tirar a conferência de prefixo da chave, tirar o `download` do documento) derrubaram 9 testes; o serviço foi restaurado e confere com `git diff` vazio. Sem commit de implementação.
- **REFACTOR:** nao houve.

## Issues Encountered

- O critério de aceite `grep -c "/mensagens/anexos" == 1` contou 3 por causa de dois comentários; passaram a escrever `mensagens/anexos` sem a barra inicial.
- A primeira versão dos testes do tracador usou a Conversa `comercial` (WhatsApp oficial), cuja janela de 24 h tinha expirado por um teste anterior do mesmo arquivo (409 `JANELA_EXPIRADA`): passaram a usar a `suporte` (não oficial).
- Um `cp ... /tmp/ignore` escapou numa verificação de mutação e foi apagado logo depois; nada ficou em `/tmp`.
- Na rodada ampla, `persistencia/colunas-geradas.test.ts > due_date` falhou uma vez (carga do banco compartilhado) e passa isolado, 8/8: não toca nada deste plano.

## Verification Run

- Postgres 16 em Docker (`crm-n1-pg-1609`, porta 55724), `npm run --silent migrar` até `013-mensageria.sql`, contêiner removido no fim:
  - `rotas/crm/mensagens.test.ts` 74 (50 do plano anterior + o fluxo novo), `e2e/mensageria.test.ts`, `seguranca/anexos.test.ts`: 3 arquivos, 91 testes passando (comando `<automated>` da Task 3 verbatim).
  - Rodada ampla, a SUÍTE INTEIRA de `apps/api`: 211 arquivos, 208 passando, 2 pulados (Storage real, anteriores), 1 falhou (`colunas-geradas due_date`, flaky sob carga; isolado passa 8/8), 2735 testes passando.
  - `inventario-de-rotas.test.ts` e `cofre.test.ts` passam (nenhuma rota importa `servicos/cofre`; as três rotas novas exigem JWT).
- Sem banco: `storage-uploads.test.ts` + `formularios-publicos.test.ts` 43 passando e 13 pulados (Supabase), `DATABASE_URL=`.
- Domínio inteiro: 132 arquivos, 2440 testes passando; `midia.test.ts` 10; `mensagens.test.ts` 43.
- `npx tsc --noEmit` em `packages/dominio`, `apps/api` e `apps/web`: ok (a web usa `NovaMensagem` e continua compilando).
- Critérios de aceite: `TIPOS_ACEITOS_NA_MENSAGEM` 1; `conversas/` no serviço 2 e `consumirSessao` 1; `/mensagens/anexos` 1 e `/mensagens/:id/anexos/:indice` 1; `from "../`/`@n1/(api|web)` em `midia.ts` 0; `UPLOAD_MAX_BYTES_MIDIA` 2; `OggS|ftyp` 2; `familiaDoZip` 6; audio/video/zip na lista do Formulário 0; `jszip|fflate|yauzl|file-type` no `package.json` 0; `ANEXO_DE_OUTRA_CONVERSA` 2 e `ARQUIVO_INDISPONIVEL` 1; `error: .*objectKey` 0.
- Não rodei `npm run check` inteiro (13-17 min), conforme o plano.

## Known Stubs

None.

## Threat Flags

None. T-16-31 (assinatura conferida no conteúdo contra o tipo reservado; texto como `.ogg` recusado, teste), T-16-32 (ZIP só pelo diretório central, ZIP64 e diretório inflado recusados; teto 16/25 MiB no ticket e na confirmação, com o objeto de 17 MiB recusado sem baixar), T-16-33 (o servidor escolhe a chave, a sessão tem de ser `conversa-<id>` do mesmo Espaço; testes de outra Conversa, outro Espaço e objeto cruzado), T-16-34 (`exigir(..., "ler", "mensagem")`, Mensagem do Espaço da sessão, chave do Espaço conferida; 404/403 testados), T-16-35 (documento sempre com `download`, 5 tipos testados), T-16-36 (lista do Formulário intocada, 7 recusas testadas) e T-16-SC (nenhum pacote novo) estão cobertos.

## User Setup Required

None - no external service configuration required. A variável `UPLOAD_MAX_BYTES_MIDIA` (padrão 16 MiB, para áudio e vídeo) é opcional; a prova contra o bucket real fica para a prova ao vivo (16-16).

## Next Phase Readiness

- 16-10: use `armazenamentoDeAnexosPadrao()`/`ArmazenamentoDeAnexos` e `criarArmazenamentoFalso()` nos testes de mídia; o anexo recebido hoje grava `baixado: false`.
- 16-11/16-12: veja "Decisions Made" para o fluxo e os códigos de recusa. A web ainda manda `conteudo` obrigatório; não mudou nada na tela neste plano.
- Documentação devida (arquivos fora dos `files_modified`, para o 16-14): `apps/api/src/servicos/CONTEXT.md` (`storage-uploads.ts` ganhou as assinaturas novas, `familiaDoZip`, `pareceTexto`, os tetos por tipo, `opcoes` de ticket e confirmação e `urlDeDownload(..., { download })`, e a porta `armazenamento-de-anexos.ts`); `apps/api/src/rotas/CONTEXT.md` (as três rotas, o 422 e os códigos); `apps/api/src/testes/CONTEXT.md` (`armazenamento-falso.ts`); `apps/api/src/persistencia/CONTEXT.md` (anexo gravado em `mensagens.anexos` jsonb, sessão de upload `conversa-<id>`); `apps/api/.env.example` (`UPLOAD_MAX_BYTES_MIDIA`); e o `CONTEXT.md` do domínio, se houver, para `crm/midia.ts`.

## Self-Check: PASSED

- Os 4 arquivos novos existem (`midia.ts`, `midia.test.ts`, `armazenamento-de-anexos.ts`, `armazenamento-falso.ts`) e os 12 modificados constam de `git diff --stat`.
- Commits na branch: `7a624ff`, `e872873`, `9d1d7c6`, `bcf31ca`, `e8b0ad8`.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
