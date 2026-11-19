---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 09
subsystem: api
tags: [email, smtp, nodemailer, imapflow, mensageria, outbox, bcc, append, contrato, vitest]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "17-01 messageIdDaMensagem, cabecalhosDaResposta, teto de 20 MB; 17-03 fábrica de conexão e guarda de rede; 17-04 conta, cursor e porta de acesso à credencial; 17-05 registrarQuedaDoEmail; 17-06/17-07 EnvioAoProvedor com assunto, cópias, referências e objectKey, idExternoDoEnvio, CODIGO_DO_CANAL_DESCONECTADO; 17-08 eventosDoCorpo, chaveDoCorpo e os tetos do e-mail recebido"
provides:
  - "envio.ts: criarEnvioDeEmail (enviar, idExternoDoEnvio), deveGuardarEmEnviados, FRASE_DA_SENHA_RECUSADA_NO_ENVIO, FRASE_SEM_CONTA"
  - "provedor.ts: criarProvedorDeEmail (provedor email-imap-smtp, semWebhook, baixarMidia pela referência uidValidity:uid:índice)"
  - "do-ambiente.ts: provedorDeEmailDoAmbiente (só com COFRE_CHAVE)"
  - "registro.ts: registroPadrao(env) liga o e-mail pela mesma regra dos outros provedores"
affects: [17-10, 17-11, 17-12, 17-13, 17-16]

tech-stack:
  added: []
  patterns:
    - "O MIME é montado uma vez e vai como mensagem pronta (`raw`) com o envelope dito à parte: a cópia oculta só existe no envelope"
    - "Desfecho do SMTP por quem responde: código no servidor = recusa limpa; sem código, só o que certamente não saiu (não conectou, DNS, certificado, tempo de conexão) é transitório; o resto é ambíguo e nunca reenvia"
    - "Defesa em profundidade na saída: endereço, nome, assunto, nome de arquivo e tipo de mídia são conferidos de novo antes do MIME, mesmo já validados no domínio"

key-files:
  created:
    - apps/api/src/mensageria/provedores/email/envio.ts
    - apps/api/src/mensageria/provedores/email/envio.test.ts
    - apps/api/src/mensageria/provedores/email/provedor.ts
    - apps/api/src/mensageria/provedores/email/provedor.contrato.test.ts
    - apps/api/src/mensageria/provedores/email/do-ambiente.ts
    - apps/api/src/e2e/email-saida.test.ts
  modified:
    - apps/api/src/mensageria/registro.ts
    - apps/api/src/mensageria/registro.test.ts
    - apps/api/src/testes/servidor-de-email-falso.ts
    - apps/api/src/testes/servidor-de-email-falso.test.ts

key-decisions:
  - "registroPadrao ganhou o parâmetro `env` (padrão process.env) e o passa a todos os provedores: é o 'ambiente injetado' que o plano pede para provar COFRE_CHAVE sem mexer em process.env"
  - "O Message-ID do cabeçalho e o id_externo gravado antes de enviar vêm da mesma função (idExternoDoEnvio), então a resposta do destinatário acha o fio mesmo depois de um envio ambíguo"
  - "Certificado que não confere, DNS e conexão recusada são falha antes do DATA (transitória ou permanente pelo classificador); tempo de SOCKET esgotado e conexão caída são ambíguos, mesmo quando podem ter ocorrido antes do DATA: o erro sempre cai do lado de 'a pessoa confere em Enviados'"
  - "Se a queda da caixa não pôde ser registrada (banco fora do ar), o resultado é transitório, não CANAL_DESCONECTADO: senão a Mensagem esperaria uma reconexão de um Canal que nunca caiu"
  - "No `auto`, o login por Google ou Microsoft também não copia a Enviados (além do host), porque o servidor é sempre o deles (A4 e A5 seguem a confirmar na prova real, 9.4.4)"

patterns-established:
  - "Provedor semWebhook: verificarChamada é `() => false` e o contrato exige a recusa de toda chamada, inclusive a com o segredo certo"

requirements-completed: [EML-05, EML-07]

duration: 45min
completed: 2026-11-19
status: complete
plan_head_before: fc34c8065d8b3ef239943b0ae40626a70d9599de
plan_head_after: 6ada2081dfd1ea5ea9a0109aa7bf6c467df811f1
commits: 3

actuals:
  tokens: 32000
  tasks: 3
  commits: 3
---

# Phase 17 Plan 09: A saída do e-mail e o provedor email-imap-smtp Summary

**A resposta escrita na Caixa de um Canal de e-mail sai pelo outbox e pelo worker da Fase 16 até o SMTP da caixa conectada, no mesmo fio (Subject, Message-ID `n1.<id>@<domínio>`, In-Reply-To, References, texto e HTML escapado, anexos do bucket), com a cópia oculta só no envelope, ambíguo nunca reenviado, senha recusada derrubando o Canal e cópia em Enviados por APPEND; o provedor `email-imap-smtp` entra no registro só com `COFRE_CHAVE` e passa no conjunto de contrato com `semWebhook`.**

## Accomplishments

- `envio.ts`: `criarEnvioDeEmail` monta o MIME uma vez com o `MailComposer` (sem cópia oculta, `disableFileAccess` e `disableUrlAccess`) e o envia como `raw` com `envelope` explícito (destinatário, Para, Cópia e Cópia oculta, cada endereço uma vez). Os arquivos vêm de `armazenamento.baixar(objectKey, { tetoBytes: o que falta dos 20 MB })`, nunca por URL; a soma declarada é conferida antes de qualquer conexão e a real depois do download. `idExternoDoEnvio` e o `Message-ID` do cabeçalho são a mesma função.
- Desfecho: o servidor que respondeu com código é recusa limpa (4xx e 503 transitórios, 5xx permanentes, com frase fixa e só o número); DNS, conexão recusada, certificado e tempo de conexão são falha antes do envio; sem código e com a sessão de pé (tempo de socket, conexão derrubada) é `ambiguo: true`, e a entrega da Fase 16 grava `falhou` com "confira em Enviados" sem reenviar. Destinatário parcialmente recusado com algum aceito é `ok` e só a contagem é registrada.
- Senha recusada (`EAUTH` sem 4xx) ou `AUTORIZACAO_RECUSADA` da porta de acesso chama `registrarQuedaDoEmail` com o motivo e devolve `CANAL_DESCONECTADO`: a Mensagem fica `pendente` (a entrega da 17-07 já tratava esse código). `OAUTH_NAO_CONFIGURADO` e `RENOVACAO_FALHOU` são transitórios sem queda.
- `deveGuardarEmEnviados` e o `APPEND` do mesmo MIME com `\Seen` por `abrirImap` (guarda de rede reaplicada); sem `\Sent` conhecido pula e registra sem endereço; falha do `APPEND` só registra o tipo.
- `provedor.ts`: `provedor: "email-imap-smtp"`, `semWebhook: true`, `verificarChamada` sempre `false`, `interpretarChamada` e `chaveDaChamada` do tradutor de 17-08, `baixarMidia` que relê o anexo da INBOX pela referência `<uidValidity>:<uid>:<índice>` (UIDVALIDITY diferente, UID sumido ou índice inexistente: `MIDIA_INDISPONIVEL`; acima do teto: `MIDIA_GRANDE_DEMAIS`; caixa fora do ar ou recusa: `PROVEDOR_INDISPONIVEL` sem host nem usuário na mensagem).
- `do-ambiente.ts` e `registro.ts`: `registroPadrao(env)` inclui `email-imap-smtp` só com `COFRE_CHAVE` não vazia; sem ela, o Canal real continua sem provedor (MSG-05) e o simulado fica no provedor de teste.

## Task Commits

1. **Task 1 (tracer): a resposta sai pelo outbox até o SMTP no mesmo fio e o provedor entra no registro** - `d199f9c` (feat)
2. **Task 2: cópia oculta, injeção por CRLF, anexos, 20 MB, ambíguo, recusa e senha que mudou** - `94da431` (test)
3. **Task 3: o contrato do provedor com `semWebhook` e o anexo relido da caixa** - `6ada208` (test)

**Portão do tracer:** o e2e (`email-saida.test.ts`) e o `registro.test.ts` passaram antes de expandir; a expansão foi liberada. O `envio.ts` já nasceu completo na Task 1 (anexos, classificação, queda e `APPEND` incluídos); as Tasks 2 e 3 acrescentam as provas.

## Verification Results

Postgres 16 próprio (container `crm-n1-pg-1709`, porta 55751, migrado até a 017 com `npm run --silent migrar -w @n1/api`; nenhum container `supabase_*` tocado; removido no fim). Nenhum `npm install`, nenhuma credencial nem servidor de e-mail reais: só os dublês de 17-02.

- Task 1: `src/e2e/email-saida.test.ts` e `src/mensageria/registro.test.ts` (23 testes) e `npx tsc --noEmit` em `apps/api`: passam.
- Task 2: `envio.test.ts` com `DATABASE_URL=` vazio (37 testes) e `tsc`: passam. O teste "a cópia oculta entra no envelope e o DATA não tem Bcc nem o endereço dela" está entre os passados.
- Task 3: `envio.test.ts`, `provedor.contrato.test.ts` (16 testes; `contrato do provedor: e-mail` incluído), `registro.test.ts` e `provedor.test.ts` (o do `mensageria/`) e `tsc`: passam.
- Regressão no meu Postgres: `src/mensageria` inteiro (43 arquivos: registro, contrato dos outros provedores, entregar-mensagem, processador-de-entrada, midia, tudo de `provedores/*`), `src/testes` e `src/e2e/mensageria.test.ts` (a saída ponta a ponta do provedor de teste): 787 de 788 testes passam. `src/e2e/mensageria-entrada`, `-evolution`, `-midia`, `-tempo-real`, `lista-conversacional-entrada`, `lista-conversacional-evolution` e `conexao-evolution`: 7 arquivos, passam (um teste pulado por falta de Evolution de homologação, como antes).
- A única falha é a já registrada em `deferred-items.md`: `whatsapp-cloud.test.ts` "sem a integração configurada, 503 dizendo o que falta" (o teste espera `META_APP_SECRET` na frase). Não é deste plano e não foi tocada.
- Os `<automated>` não foram rodados literalmente: a porta é a 55751 pedida pelo orquestrador (não a 55736), o container tem outro nome e os passos foram separados; são os mesmos comandos e arquivos. Não rodei o `npm test` completo da api, nem o `tsc` do domínio e da web (nenhum foi tocado). O `lint` do repositório só cobre a web.
- Teste com dentes: troquei temporariamente o MIME para pôr a cópia oculta em `Cc`; o teste da Cópia oculta falhou, e voltei o código. A tentativa de pôr `bcc` e `headers: { Bcc }` no `MailComposer` NÃO falhou o teste: o `nodemailer` 10.6.0 nunca escreve `Bcc` no `build()`, de modo que o envelope explícito e a ausência do campo são uma segunda barreira por cima do padrão seguro da biblioteca (é o que a nota do plano pedia).
- Acceptance: todos os `grep` do plano batem (`"email-imap-smtp"` em `registro.ts` 1, `semWebhook: true` em `provedor.ts` 1 e em `provedor.contrato.test.ts` 1, `envelope` 7, `messageIdDaMensagem` 2, `ambiguo: true` 1, `registrarQuedaDoEmail` 3, `armazenamento.baixar` 1, `urlAssinada` 0, `A4` 2, `A5` 2, `export function deveGuardarEmEnviados` 1).

## TDD

A implementação (`envio.ts`, `provedor.ts`, `do-ambiente.ts`) foi escrita inteira antes dos testes das Tasks 2 e 3, e o e2e da Task 1 foi escrito logo depois dela: não há fase RED observada nem commit RED separado. Os testes passaram quase todos na primeira rodada; a única falha real foi a do certificado (abaixo). A prova de que eles pegam defeito é a troca temporária da cópia oculta descrita acima. O plano é `type: execute`, sem gate de pares RED/GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Certificado que não confere era tratado como ambíguo**
- **Found during:** Task 2 (teste "certificado que não confere é permanente")
- **Issue:** o `nodemailer` embrulha a falha de TLS em `ESOCKET` com `originalCode: DEPTH_ZERO_SELF_SIGNED_CERT` e `command: CONN`, sem `responseCode`; a regra "sem código é ambíguo" o pegava e a Mensagem seria dada como "sem confirmação" por um envio que nem começou.
- **Fix:** o classificador de conexão de 17-03 (`tipo: "certificado"`) entra na lista do que certamente não saiu; o resultado é `SMTP_CERTIFICADO`, permanente.
- **Files modified:** `envio.ts`
- **Commit:** `94da431`

**2. [Rule 2 - Missing critical] Conferência de endereço, nomes e tipos na saída (defesa em profundidade)**
- **Found during:** Task 1/2
- **Issue:** o domínio já valida o que a pessoa digita, mas o envelope SMTP e os cabeçalhos são o ponto onde um CRLF ou um `>,` forja destinatário ou cabeçalho; `REGEX_EMAIL` do domínio só barra espaço.
- **Fix:** `enderecoSeguro` (normaliza, recusa controle, espaço, `< > ( ) , ; : " \ [ ]`, mais de 254 caracteres, IDN para ASCII), assunto e nome de exibição sem controle, nome de arquivo sem separador nem aspas, tipo de mídia fora da forma `tipo/subtipo` vira `application/octet-stream`, ids do fio com controle ou colchete descartados. Provado por testes de injeção (assunto, nome do endereço, nome do arquivo e tipo com CRLF).
- **Files modified:** `envio.ts`, `envio.test.ts`
- **Commit:** `d199f9c`, `94da431`

**3. [Rule 3 - Blocking] `registroPadrao` não aceitava ambiente injetado**
- **Found during:** Task 1
- **Issue:** o plano pede provar "com `COFRE_CHAVE` no ambiente injetado", mas `registroPadrao()` lia `process.env` direto.
- **Fix:** `registroPadrao(env = process.env)` passa `env` ao Evolution, ao Instagram, ao WhatsApp oficial e ao e-mail; o padrão não muda o comportamento de nenhum chamador existente.
- **Files modified:** `registro.ts`
- **Commit:** `d199f9c`

**4. [Rule 3 - Blocking] O dublê de SMTP não sabia recusar só um destinatário**
- **Found during:** Task 2
- **Issue:** "dois destinatários, um recusado com 550 e outro aceito" não podia ser programado: `recusarRcpt` valia para a transação inteira.
- **Fix:** `recusarRcpt` aceita `enderecos` opcional (sem ele, recusa todos, como antes); teste novo no `servidor-de-email-falso.test.ts`.
- **Files modified:** `testes/servidor-de-email-falso.ts`, `testes/servidor-de-email-falso.test.ts`
- **Commit:** `94da431`

### Escolhas dentro da lacuna do plano

- A frase de motivo do 4xx/5xx leva só o número do código SMTP ("O servidor de e-mail recusou o destinatário (código 550)."): o texto do servidor nunca sobe (T-17-38).
- `EAUTH` com `responseCode` 4xx (autenticação temporariamente indisponível) é transitório e não derruba a caixa.
- O `auto` de `deveGuardarEmEnviados` também recusa o login por Google ou Microsoft e inclui `outlook.office.com` e `imap-mail.outlook.com`, além de `imap.gmail.com`, `imap.googlemail.com` e `outlook.office365.com`.
- `estadoDaConexao` devolve a conexão que o Canal já tem (como o plano diz); a conferência na fonte fica para o leitor (17-10).
- `baixarMidia` abre a INBOX (a pasta do cursor) e confere o tamanho antes de baixar o corpo.
- Um e-mail só com arquivo (sem texto) sai; sem texto e sem arquivo é `MENSAGEM_VAZIA`.
- O MIME inclui `Date` automático da biblioteca e nenhum `X-Mailer`.

**Total deviations:** 4 auto-fixed (1 Rule 1, 1 Rule 2, 2 Rule 3); nenhuma exigiu decisão do dono.

## Notas para a revisão

- A4 e A5 (Gmail e Microsoft 365 guardam em Enviados sozinhos) seguem pressupostos: o código os trata como padrão do `auto`, comentado "a confirmar na prova real (9.4.4)", e `append_enviados` da conta muda o comportamento sem código novo.
- O desfecho `ambiguo` é conservador: um tempo de socket esgotado ANTES do `DATA` (por exemplo, no meio do login) também vira "confira em Enviados". Errar para esse lado custa um clique da pessoa; errar para o outro custa um e-mail duplicado ao cliente.
- 17-10 (leitor) pode usar `criarProvedorDeEmail`/`provedorDeEmailDoAmbiente` como está; `baixarMidia` já resolve a referência `<uidValidity>:<uid>:<índice>` que `prepararEmailRecebido` grava em `referenciaExterna`.
- Nenhum registro de log usa endereço, assunto, corpo, senha ou texto do servidor; os dois registros de aviso levam só uma contagem e o tipo da falha.

## Auth gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. T-17-35 (cópia oculta só no envelope e fora de qualquer cabeçalho e da cópia em Enviados: provado com leitura do `DATA` e da pasta de enviados), T-17-36 (anexos só como bytes do bucket pela chave, sem `urlAssinada` no envio, `disableFileAccess`/`disableUrlAccess`), T-17-37 (ambíguo nunca reenviado, `id_externo` gravado antes de sair: provado no e2e com `mudoNoData`), T-17-38 (resultado, erro e registro serializados sem a senha), T-17-39 (`EAUTH` derruba a caixa e a Mensagem espera) e T-17-40 (guarda de rede reaplicada no envio e no `APPEND`, provada com resolução para `10.0.0.5` e `169.254.169.254`) estão mitigados e provados. T-17-SC: nenhum pacote novo.

## Self-Check: PASSED

- Arquivos criados e alterados existem (`envio.ts`, `envio.test.ts`, `provedor.ts`, `provedor.contrato.test.ts`, `do-ambiente.ts`, `e2e/email-saida.test.ts`, `registro.ts`, `registro.test.ts`, `servidor-de-email-falso.ts` e o teste dele).
- Commits `d199f9c`, `94da431` e `6ada208` são ancestrais de `HEAD`.
