---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 08
subsystem: api
tags: [email, mailparser, fila-de-entrada, midia, mime, vitest]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "17-01 fio-de-email (idLimpo, idsDoCabecalho, motivoParaIgnorarEmail); 17-04 gravarCursor(cliente); 17-06 RecebidaDoProvedor com anexosGuardados/corpoHtml/referencias e guarda com Pick<baixarMidia>"
provides:
  - "traduzir.ts: CorpoDoEmail v1, prepararEmailRecebido, corpoIgnorado, eventosDoCorpo, chaveDoCorpo, os tetos"
  - "entrada.ts: enfileirarEmailEAvancar (INSERT na fila e cursor numa transação)"
  - "sete .eml sintéticos em exemplos/"
affects: [17-09, 17-10, 17-11, 17-15, 17-16]

tech-stack:
  added: []
  patterns:
    - "O corpo da fila é o e-mail já interpretado e versionado (v: 1); o tradutor o valida com zod e nunca lança"
    - "A guarda de mídia da Fase 16 recebe um adaptador em memória no lugar do provedor (os bytes já lidos do MIME)"

key-files:
  created:
    - apps/api/src/mensageria/provedores/email/traduzir.ts
    - apps/api/src/mensageria/provedores/email/traduzir.test.ts
    - apps/api/src/mensageria/provedores/email/entrada.ts
    - apps/api/src/mensageria/provedores/email/entrada.test.ts
    - apps/api/src/mensageria/provedores/email/exemplos/com-anexo.eml
    - apps/api/src/mensageria/provedores/email/exemplos/resposta.eml
    - apps/api/src/mensageria/provedores/email/exemplos/resposta-automatica.eml
    - apps/api/src/mensageria/provedores/email/exemplos/nao-entrega.eml
    - apps/api/src/mensageria/provedores/email/exemplos/lista.eml
    - apps/api/src/mensageria/provedores/email/exemplos/sem-message-id.eml
    - apps/api/src/mensageria/provedores/email/exemplos/imagem-embutida.eml
  modified: []

key-decisions:
  - "Dois motivos de descarte além dos do domínio: ilegivel (o parser recusa o MIME, ou não há From) e sem_conteudo (nada para mostrar). Sem eles um e-mail veneno prenderia o cursor do leitor ou voltaria da fila em laço"
  - "A chave do e-mail grande demais e do ilegivel é sem-id: + SHA-256 de uidValidity, uid e tamanho (não há Message-ID lido antes do parser)"
  - "O sem-id: do e-mail sem Message-ID usa o texto cru do cabeçalho Date, não o Date do mailparser (que vira a hora atual quando não lê o cabeçalho e faria a chave mudar a cada leitura)"
  - "Todo texto que vai ao jsonb passa por NUL removido e toWellFormed: o jsonb do Postgres recusa os dois e o INSERT da fila falharia sempre naquele e-mail"

patterns-established:
  - "Quem lê a caixa nunca grava MIME cru, HTML nem base64 na fila: o HTML vai ao bucket em entrada/ e o corpo só leva a chave (coberta pela coleta de órfãos via jsonb_path_query)"

requirements-completed: [EML-03, EML-04]

duration: 40min
completed: 2026-11-19
status: complete
plan_head_before: a4f6dc6b25d0691bb629a546f70b4e225ea4f9ad
plan_head_after: 418f359ac79567e17f346d108869bc82ca554246
commits: 3

actuals:
  tokens: 14700
  tasks: 3
  commits: 3
---

# Phase 17 Plan 08: O e-mail lido vira fila e Conversa Summary

**`prepararEmailRecebido` interpreta o MIME com o `mailparser`, filtra o que não vira Conversa, guarda arquivos e HTML pelo bucket da Fase 16 e devolve o corpo `v: 1` da fila; `enfileirarEmailEAvancar` o grava com o cursor numa transação; `eventosDoCorpo` o traduz no evento de `receberMensagem`.**

## Accomplishments

- `traduzir.ts`: `CorpoDoEmail` (`v: 1`, lido ou `ignorado`), os tetos (50 MiB antes do parser, 5 MiB de HTML, 200 000 caracteres de texto, 50 `References`, 100 `To` e 100 `Cc`, 50 arquivos), `prepararEmailRecebido`, `corpoIgnorado`, `eventosDoCorpo` (zod, nunca lança) e `chaveDoCorpo`. O texto cortado vai inteiro como `texto-completo.txt` pela guarda. O HTML sobe como `text/html` em `workspace/<ws>/entrada/<canal>/<uuid>` e fica só em `corpoHtml`, nunca em `anexos`. O `criadoEm` é o `INTERNALDATE` que o leitor passa, com o `Date` como reserva. Nenhum `console` nem log.
- `entrada.ts`: `begin`, `INSERT ... on conflict (workspace_id, canal_id, chave) where chave is not null do nothing`, `gravarCursor` no mesmo cliente, `commit` (ou `rollback` e relança). Devolve `"guardada"` ou `"repetida"`; a repetida avança o cursor do mesmo jeito.
- Sete `.eml` sintéticos (`example.*` e `.test`) e 36 testes novos (11 em `entrada.test.ts` com banco, 25 em `traduzir.test.ts` sem banco).

## Task Commits

1. **Task 1 (tracer): .eml com PDF vira linha da fila e Conversa** - `104781a` (feat)
2. **Task 2: o que não vira Conversa e os limites do corpo** - `23385e6` (test)
3. **Task 3: anexos e imagem embutida pela guarda; falha do bucket volta ao leitor** - `418f359` (test)

**Portão do tracer:** o `<verify>` do tracer (`entrada.test.ts` e `tsc`) passou antes de expandir; a expansão foi liberada.

## Verification Results

Postgres 16 próprio (container `crm-n1-pg-1708`, porta 55749, migrado até a 017 com `npm run --silent migrar`, removido no fim; nenhum container `supabase_*` tocado).

- Task 1: `entrada.test.ts` (11 testes) e `npx tsc --noEmit` em `apps/api`: passam. O `<automated>` não foi executado literalmente (a porta é a 55749 pedida pelo orquestrador, não a 55735, e os passos foram separados), mas são os mesmos comandos.
- Task 2: `traduzir.test.ts` com `DATABASE_URL=` vazio e `tsc`: passam (17 testes no commit da Task 2).
- Task 3: `traduzir.test.ts` e `midia.test.ts` com `DATABASE_URL=` vazio: 2 arquivos, 36 testes; `tsc` limpo.
- Regressão no meu Postgres: `src/mensageria/provedores/email`, `midia.test.ts`, `coleta-de-orfaos.test.ts`, `processador-de-entrada.test.ts`, `provedor.test.ts`, `e2e/mensageria-entrada.test.ts`, `e2e/mensageria-midia.test.ts` e `servicos/crm/recebimento.test.ts`: 16 arquivos, 263 testes, todos passando.
- Teste com dentes: troquei temporariamente o limite de 50 arquivos para 60 e desliguei o filtro de motivos; 3 testes falharam, e voltei o código.
- Acceptance: todos os `grep` do plano batem (`on conflict (workspace_id, canal_id, chave)` 1, `gravarCursor` 2, `simpleParser` e `guardarAnexosRecebidos` na tradução, `console.|simpleParser` em `entrada.ts` 0, `motivoParaIgnorarEmail`, `sem-id:`, `grande_demais`, `TETO_DO_HTML_GUARDADO_BYTES`, `algumTransitorio`, `"text/html"`; 7 `.eml`).
- Não rodei o `npm test` completo da api nem o `tsc` do domínio e da web (nenhum dos dois foi tocado).

## TDD

Os dois planos de teste foram escritos depois do código no mesmo plano: não houve fase RED observada (o `traduzir.ts` e o `entrada.ts` nasceram na Task 1 já completos, e as Tasks 2 e 3 viraram testes e exemplos sobre o que já existia). Os testes passaram na primeira rodada; a prova de que eles pegam defeito é a troca temporária descrita acima. O plano é `type: execute`, então não há gate de pares RED/GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] E-mail veneno e e-mail sem conteúdo**
- **Found during:** Task 1
- **Issue:** O plano só prevê `ignorado` pelos motivos do domínio e `grande_demais`. Um MIME que o `mailparser` recusa (`maxChildNodes`, cabeçalho enorme), ou sem `From`, faria `prepararEmailRecebido` lançar e o leitor ficaria preso nesse e-mail para sempre. Um corpo sem texto, assunto, arquivo nem HTML seria recusado por `receberMensagem` (400) e voltaria da fila em laço.
- **Fix:** dois motivos novos no tipo do corpo, `ilegivel` e `sem_conteudo`; os dois ficam registrados como `ignorado:<motivo>` (D-17-11, T-17-34).
- **Files modified:** `traduzir.ts`, `traduzir.test.ts`
- **Commit:** `104781a`, `23385e6`

**2. [Rule 2 - Missing critical] jsonb recusa NUL e par substituto solto**
- **Found during:** Task 1
- **Issue:** Texto, assunto, nomes, endereços e ids vêm de terceiro. Um NUL ou um surrogate solto faz o `INSERT ... ::jsonb` falhar, e o leitor repetiria o mesmo e-mail sem avançar.
- **Fix:** controle e NUL removidos e `toWellFormed()` em todo texto que entra no corpo; `Message-ID` ou endereço com caractere de controle cai na chave `sem-id:` ou fora da lista.
- **Files modified:** `traduzir.ts`
- **Commit:** `104781a`

### Escolhas dentro da lacuna do plano

- `Message-ID` com mais de 512 caracteres (ou com caractere de controle) cai na chave `sem-id:`; um id gigante não vira `chave` nem `id_externo`.
- `eventosDoCorpo` descarta (não rejeita) o endereço de `Para` ou `Cc` que `normalizarEmail` recusa, para um endereço torto de terceiro não derrubar a Mensagem inteira.
- Os `.eml` usam `caixa.test` (não `caixa.teste`) por causa da regra de domínios do orquestrador.
- Task 2 e Task 3 não tiveram implementação própria: a Task 1 já entregou o `traduzir.ts` completo; elas acrescentam testes e exemplos. O arquivo `traduzir.test.ts` foi dividido na hora do commit para a Task 2 não ficar com teste que dependia do exemplo da Task 3.
- Em um e-mail só de texto, o `mailparser` não devolve HTML: a Mensagem não leva `corpoHtml` (provado em `resposta.eml`).

**Total deviations:** 2 auto-fixed (Rule 2); nenhuma exigiu decisão do dono.

## Notas para a revisão

- D-17-10 continua `[auto]`, sem confirmação do dono; o plano o seguiu como escrito.
- O bucket real pode recusar `text/html` se tiver lista de tipos: nesse caso a Mensagem entra só com o texto e a prova real (17-16) deve conferir com `storage:conferir`.
- Para o 17-10: chamar `prepararEmailRecebido` com o `INTERNALDATE` em `recebidoEm`; se `algumTransitorio` vier `true`, repetir antes de chamar `enfileirarEmailEAvancar`.

## Auth gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. T-17-30 (teto de 50 MiB antes do parser e limites do corpo), T-17-31 (guarda da Fase 16, `.exe`, `text/calendar` e PDF forjado ficam `baixado: false` sem subir nada), T-17-33 (corpo sem MIME cru, HTML nem base64, provado por teste; sem log) e T-17-34 (descartado entra como `ignorado:<motivo>`) estão mitigados e provados. T-17-32 (HTML hostil) depende de 17-11 e 17-15: aqui o HTML só é guardado.

## Self-Check: PASSED

- Os 11 arquivos criados existem e os commits `104781a`, `23385e6` e `418f359` são ancestrais de HEAD; `commits: 3` medido do ledger (`a4f6dc6..HEAD`).
- Container `crm-n1-pg-1708` removido.

---
*Phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9*
*Completed: 2026-11-19*
