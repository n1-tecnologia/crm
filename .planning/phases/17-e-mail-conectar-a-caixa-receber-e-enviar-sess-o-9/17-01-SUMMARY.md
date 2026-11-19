---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 01
subsystem: dominio
tags: [email, fio, message-id, in-reply-to, references, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: RecebidaDoProvedor, destinoDaRecebida, NovaMensagem/validarNovaMensagem, AnexoDaMensagem
provides:
  - "fio-de-email.ts: idLimpo, idsDoCabecalho, mensagemRespondida, cabecalhosDaResposta, assuntoDaResposta, messageIdDaMensagem, motivoParaIgnorarEmail"
  - "NovaMensagem com assunto e enderecosAdicionais; validarNovaMensagem(entrada, canal?); maxAnexosDoCanal; validarTamanhoDoEmail; Mensagem.corpoHtml"
  - "RecebidaDoProvedor com enderecosAdicionais, referencias, anexosGuardados e corpoHtml; destinoDoFio"
affects: [17-04, 17-06, 17-07, 17-08, 17-09, 17-15]

actuals:
  tokens: 9900
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Regra de e-mail pura no domínio, com a busca do fio injetada (a api a restringe ao Canal e ao Espaço)"
    - "Capacidades do Canal declaradas em linha no segundo parâmetro opcional de validarNovaMensagem, sem ciclo com capacidades.ts"

key-files:
  created:
    - packages/dominio/src/crm/fio-de-email.ts
    - packages/dominio/src/crm/fio-de-email.test.ts
  modified:
    - packages/dominio/src/crm/mensagens.ts
    - packages/dominio/src/crm/mensagens.test.ts
    - packages/dominio/src/crm/recebimento.ts
    - packages/dominio/src/crm/recebimento.test.ts

key-decisions:
  - "mensagemRespondida mora em crm/fio-de-email.ts, não em mensagens.ts (o arquivo de Mensagens já passa de 400 linhas e o fio só serve ao e-mail)"
  - "validarNovaMensagem ganha um segundo parâmetro opcional com as duas capacidades; sem ele vale a regra de antes (um arquivo, sem assunto nem cópias)"
  - "TIPOS_ACEITOS_NA_MENSAGEM não cresce: image/gif entraria como imagem e seria oferecido ao WhatsApp"
  - "Mensagem.corpoHtml é opcional (?:) para nenhum construtor de Mensagem existente quebrar"

patterns-established:
  - "Todo id de e-mail passa por idLimpo antes de virar chave, id_externo, busca ou cabeçalho"
  - "Validação de cabeçalho de e-mail (assunto, nome de exibição, endereço) recusa qualquer caractere de controle antes de qualquer outra regra de conteúdo"

requirements-completed: [EML-04, EML-05]

duration: 4min
completed: 2026-11-19
status: complete
plan_head_before: 0e4ddf469acf0b0605b9c4b6951a3e9aeb23f930
plan_head_after: 4ce63226beb3779fd2ffbafb2ba315c1e8079bb4
commits: 6

coverage:
  - id: D1
    description: "mensagemRespondida acha o fio pelo In-Reply-To e pelo References (do último ao primeiro); assunto Re: sem cabeçalho de fio não acha nada"
    requirement: EML-04
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/fio-de-email.test.ts#mensagemRespondida (EML-04, D-17-14)"
        status: pass
    human_judgment: false
  - id: D2
    description: "cabecalhosDaResposta (20 ids: o primeiro e os 19 últimos), assuntoDaResposta e messageIdDaMensagem"
    requirement: EML-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/fio-de-email.test.ts#cabecalhosDaResposta (D-17-16, RFC 5322 §3.6.4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "motivoParaIgnorarEmail reconhece resposta automática, não entrega, lista e o próprio Canal; List-Unsubscribe sozinho não descarta"
    requirement: EML-04
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/fio-de-email.test.ts#motivoParaIgnorarEmail (D-17-11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "NovaMensagem aceita assunto, cópias e até 10 arquivos só no Canal de e-mail, recusa injeção de cabeçalho e o total acima de 20 MB"
    requirement: EML-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/mensagens.test.ts#validarNovaMensagem com assunto e cópias (D-17-19)"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/crm/mensagens.test.ts#maxAnexosDoCanal e validarTamanhoDoEmail (D-17-18)"
        status: pass
    human_judgment: false
  - id: D5
    description: "RecebidaDoProvedor com os campos do e-mail e destinoDoFio (aberta usa, pendente volta, resolvida reabre, lixeira cai na regra do par)"
    requirement: EML-04
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/recebimento.test.ts#destinoDoFio (D-17-15)"
        status: pass
    human_judgment: false
---

# Phase 17 Plan 01: O domínio do e-mail Summary

**Regras puras do e-mail no domínio: fio por `In-Reply-To`/`References` com `idLimpo`, filtro do que não vira Conversa, `NovaMensagem` com assunto, cópias e até 10 anexos dentro de 20 MB, campos novos da recebida e `destinoDoFio`.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-19T17:33:19Z
- **Completed:** 2026-11-19T17:37:30Z
- **Tasks:** 3 (1 tracer + 2 auto, todas TDD)
- **Files modified:** 6 (2 criados, 4 estendidos)

## Accomplishments

- `fio-de-email.ts` novo: uma troca de três e-mails acha o anterior (B acha A, C acha B); `In-Reply-To` desconhecido cai no `References` do fim para o começo; só os 50 últimos ids entram na busca; assunto "Re: ..." sem cabeçalho de fio não chama a busca (prova a proibição EML-04).
- Respostas: `cabecalhosDaResposta` limita `References` a 20 ids (o primeiro e os 19 últimos), `messageIdDaMensagem` gera `n1.<id>@<domínio do Canal>`, `assuntoDaResposta` não empilha `Re:`.
- `motivoParaIgnorarEmail` (próprio Canal, não entrega, resposta automática, lista) em ordem fixa, nomes de cabeçalho em qualquer caixa; `List-Unsubscribe` sozinho não descarta.
- `validarNovaMensagem(entrada, canal?)` recusa assunto e cópias num Canal sem `hasSubjectAndCopies`, recusa quebra de linha e caractere de controle no assunto, no endereço e no `nomeExibido` (T-17-01), limita a 500 caracteres e 100 endereços, aceita 10 arquivos no e-mail e continua com 1 nos outros.
- `validarTamanhoDoEmail` recusa o total acima de 20 MB (20 MiB exatos passam); `Mensagem.corpoHtml` opcional; `RecebidaDoProvedor` ganha `enderecosAdicionais`, `referencias`, `anexosGuardados`, `corpoHtml`; `destinoDoFio` decide sem olhar o Contato.

## Task Commits

1. **Task 1: Traçador, fio pelo In-Reply-To e References**
   - RED `1235fef` (test), GREEN `7fa7805` (feat)
2. **Task 2: O que não vira Conversa (D-17-11)**
   - RED `7d411dc` (test), GREEN `7576d74` (feat)
3. **Task 3: NovaMensagem com assunto/cópias/anexos, campos da recebida, destino pelo fio**
   - RED `81bac6a` (test), GREEN `4ce6322` (feat)

Nenhum REFACTOR (sem mudança necessária). **Plan metadata:** commit `docs(17-01)` seguinte a este arquivo.

## Files Created/Modified

- `packages/dominio/src/crm/fio-de-email.ts` - regra do fio, do filtro e dos cabeçalhos de resposta (sem I/O)
- `packages/dominio/src/crm/fio-de-email.test.ts` - 35 testes (fio, resposta, Message-ID, assunto, filtros)
- `packages/dominio/src/crm/mensagens.ts` - `NovaMensagem` com assunto e cópias, limites, `maxAnexosDoCanal`, `validarTamanhoDoEmail`, `Mensagem.corpoHtml`
- `packages/dominio/src/crm/mensagens.test.ts` - casos novos de assunto, cópias, anexos e teto de 20 MB
- `packages/dominio/src/crm/recebimento.ts` - campos do e-mail em `RecebidaDoProvedor` e `destinoDoFio`
- `packages/dominio/src/crm/recebimento.test.ts` - casos de `destinoDoFio`

## Decisions Made

- Seguiu as decisões do planejador do plano (arquivo `fio-de-email.ts`, segundo parâmetro opcional, lista de tipos de mídia intocada, `corpoHtml` opcional); nenhuma decisão nova de arquitetura.
- Assunto em branco conta como ausente; endereços adicionais voltam normalizados (`normalizarEmail`) no valor de `validarNovaMensagem`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `normalizarEmail` não trata `googlemail.com`**
- **Found during:** Task 2
- **Issue:** O plano supunha que `normalizarEmail` já dobra `googlemail.com` em `gmail.com` ("a forma de `normalizarEmail`"). Ela só minúscula e valida; `googlemail.com` aparece apenas na lista `PROVEDORES_PUBLICOS_DE_EMAIL`. O caso `pessoa@googlemail.com` x Canal `pessoa@gmail.com` → `proprio_canal` falharia.
- **Fix:** `formaDoEndereco` em `fio-de-email.ts` normaliza com `normalizarEmail` e dobra `@googlemail.com` em `@gmail.com` só na comparação do descarte. Não mexi em `normalizarEmail` (muda a chave de unicidade dos Contatos em todo o CRM: fora de escopo).
- **Files modified:** `packages/dominio/src/crm/fio-de-email.ts`
- **Verification:** teste "googlemail.com e gmail.com são o mesmo endereço do próprio Canal"
- **Committed in:** `7576d74`

**2. [Rule 2 - Missing critical] Validação de assunto e cópias antes do ramo de modelo**
- **Found during:** Task 3
- **Issue:** `validarNovaMensagem` retorna cedo na Mensagem de modelo (`modeloId`); validar assunto/cópias só depois deixaria passar um cabeçalho com quebra de linha por esse caminho (T-17-01).
- **Fix:** a validação de assunto e endereços roda antes do ramo de modelo.
- **Files modified:** `packages/dominio/src/crm/mensagens.ts`
- **Verification:** teste "a Mensagem de modelo também não leva assunto nem cópia num Canal que não os tem"
- **Committed in:** `4ce6322`

### Escolhas dentro da lacuna do plano (não são defeitos)

- `CabecalhosDoFio` tem um campo opcional extra, `assunto`, ignorado de propósito: o plano exige provar que "Re: Orçamento" sem fio não chama a busca, e o teste precisa passar o e-mail inteiro.
- `destinoDoFio` devolve `conversaId` também no caso `usar` (o `<behavior>` do plano abreviou o objeto). Segue o formato de `DestinoDaRecebida`; o 17-06 usa o `conversaId` do próprio destino.
- `cabecalhosDaResposta` acrescenta `respondida` ao fim de `References` quando ela não está em `idsDoFio` (RFC 5322 §3.6.4: o pai entra em `References`).
- `assuntoDaResposta("   ")` devolve `""` (não `"Re:    "`).
- Nos commits RED, `fio-de-email.ts` e os tipos novos de `mensagens.ts`/`recebimento.ts` entram só como assinaturas com valores neutros, para o teste falhar por asserção e não por import quebrado (22, 9 e 18 testes falhando por asserção, respectivamente).

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Ambas necessárias para a correção; sem ampliação de escopo.

## TDD Gate Compliance

Os três pares RED (`test(17-01)`) e GREEN (`feat(17-01)`) existem, na ordem (`1235fef`→`7fa7805`, `7d411dc`→`7576d74`, `81bac6a`→`4ce6322`). Cada RED foi conferido por falha de asserção do vitest (saída lida, nenhum erro de import ou de sintaxe). Como `workflow.tdd_mode` está `false`, não rodei `gsd_run check tdd-red-evidence` (exige relatório TAP capturado); a avaliação semântica é a leitura da saída do vitest descrita acima.

## Issues Encountered

None. Primeiro `sed -i` de limpeza falhou por sintaxe do macOS e foi refeito com Python (sem efeito no commit).

## Known Stubs

Nenhum. Os stubs dos commits RED foram todos substituídos no GREEN do mesmo par.

## User Setup Required

None - no external service configuration required.

## Verification Results

- `cd packages/dominio && npx vitest run src/crm/fio-de-email.test.ts && npx tsc --noEmit` (Task 1 e 2): 35 testes passando, `tsc` 0.
- `<automated>` da Task 3: `mensagens.test.ts`, `recebimento.test.ts` e `fio-de-email.test.ts` = 153 testes passando; `tsc --noEmit` do domínio, da api e da web saíram com 0.
- Suíte inteira do domínio: 140 arquivos, 2715 testes passando.
- Acceptance criteria: todos os `grep` de cada tarefa >= 1 (e 0 para I/O em `fio-de-email.ts`); `MAX_ANEXOS_POR_MENSAGEM = 1;` preservado.
- Portão do traçador: `⚡ Tracer verified end-to-end — expanding`.
- Não rodei `npm run check` da raiz (13–17 min, testes de banco); o plano pede só os `<automated>` acima.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. T-17-01 (injeção de cabeçalho) e T-17-03 (laço de resposta automática) mitigados e testados; T-17-02 depende da busca injetada que a api restringe no 17-06.

## Next Phase Readiness

Domínio pronto para 17-04 (coluna `corpo_html` na 017), 17-06 (processador usa `mensagemRespondida`/`destinoDoFio`), 17-07/08/09 (envio e leitor) e 17-15 (tela). A api e a web compilam sem mudança.

## Self-Check: PASSED

- Arquivos criados e modificados existem.
- Commits `1235fef`, `7fa7805`, `7d411dc`, `7576d74`, `81bac6a`, `4ce6322` são ancestrais de HEAD; `git rev-list --count` desde `plan_head_before` = 6.

---
*Phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9*
*Completed: 2026-11-19*
