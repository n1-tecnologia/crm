---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 11
subsystem: ui
tags: [mensageria, fio-da-conversa, entrega, anexos, midia, url-assinada, swr, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`POST /mensagens/:id/reenviar` e o `motivoFalha` na Mensagem (16-06)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "ticket `POST /mensagens/anexos`, `POST /mensagens` com `anexos`, `GET /mensagens/:id/anexos/:indice` e `@n1/dominio/crm/midia` (16-09)"
provides:
  - "`EstadoDaEntrega`: Enviando…, Enviada, Entregue, Lida e, na que falhou, Não enviada + motivo + Tentar de novo"
  - "`AnexoDaMensagemNoFio`: `<audio controls>`, `<video controls>`, `<img>` e link Baixar, com a URL assinada pedida a cada abertura"
  - "`dados/crm/mensagens.ts`: `reenviarMensagem`, `pedirTicketDeAnexo`, `chaveDoAnexo`, `useUrlDoAnexo`"
  - "`dados/envio-ao-bucket.ts`: `recusaDoAnexoDaMensagem` (tipo do Canal e teto 16/25 MB)"
  - "o compositor do fio anexa arquivo de verdade (ticket, bytes ao bucket, Mensagem com `anexos`) e só oferece o que o Canal envia"
affects: [16-12, 16-14, 16-16]

actuals:
  tokens: 16900
  tasks: 3
  commits: 6
plan_head_before: e3384394782b199036b6417f5bb2b513bbadbf94
plan_head_after: bc8e9e68a9318c16e6fff800ca6760362a29591b

tech-stack:
  added: []
  patterns:
    - "o player de mídia guarda a primeira URL assinada e só troca por outra depois de um erro dele (uma renovação, e outra só se o arquivo chegou a carregar); o link de documento usa sempre a mais nova"
    - "ajuste de estado durante a renderização (padrão do React) para `aceitaPelaApi` e `urlDoPlayer`, sem efeito"
    - "só uma URL http(s) vira `src` ou `href`"

key-files:
  created:
    - apps/web/src/features/crm/estado-da-entrega.tsx
    - apps/web/src/features/crm/estado-da-entrega.test.tsx
    - apps/web/src/features/crm/anexo-da-mensagem.tsx
    - apps/web/src/features/crm/anexo-da-mensagem.test.tsx
  modified:
    - apps/web/src/features/crm/conversation-thread.tsx
    - apps/web/src/features/crm/conversation-thread.test.tsx
    - apps/web/src/dados/crm/mensagens.ts
    - apps/web/src/dados/crm/mensagens.test.ts
    - apps/web/src/dados/envio-ao-bucket.ts

key-decisions:
  - "O envelope real do ticket é `{ ok: true, dados: { submissionId, objectId, uploadUrl } }` (o `<interfaces>` do plano o escreveu sem `dados`); `pedirTicketDeAnexo` lê `dados`, como as outras rotas do CRM."
  - "A chave SWR do anexo, `/mensagens/<id>/anexos/<indice>`, começa por `/mensagens`: `invalidarCrm('/mensagens')` a revalida a cada envio. Para isso não reiniciar um áudio em reprodução, o player não troca de URL fora de um erro dele."
  - "`useUrlDoAnexo` não revalida no foco da janela (cada revalidação assina uma URL nova); só o intervalo de 4 min e o pedido ao montar."
  - "Anexo cuja rota devolve 404 mostra a mesma frase de `baixado: false`; erro de rede/5xx mostra 'Não foi possível abrir o arquivo.' com Tentar de novo; URL que não é http(s) mostra a frase sem botão."
  - "Arquivo vazio tem frase própria ('Este arquivo está vazio.'), que o plano não previa."
  - "A barra de anexos é construída por categoria (`tiposAceitosParaOCanal`); a escolha de arquivo é um `<input type=file hidden>` por categoria, com `aria-label` 'Escolher imagem/áudio/vídeo/documento'. O arquivo escolhido é limpo ao trocar de Canal ('Responder por' ou atalho da ficha)."
  - "Sem texto, `conteudo` vai vazio; com texto, o texto é a legenda. O botão de enviar fica desligado se há arquivo e não há Conversa (o botão '+' já é desligado sem Conversa, então o arquivo nunca perde a Mensagem para a abertura de Conversa)."
  - "O botão de microfone, que não gravava nada, deu lugar ao botão de enviar (D-16-10); localização, figurinha, Flow e 'Visualização única' saíram da barra."

requirements-completed: [MSG-02, MSG-04]

coverage:
  - id: D1
    description: "Cada Mensagem enviada mostra o estado em palavras de produto, e a que falhou mostra o motivo e Tentar de novo, que chama POST /mensagens/:id/reenviar e volta a Enviando…"
    requirement: MSG-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/estado-da-entrega.test.tsx#EstadoDaEntrega"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/crm/mensagens.test.ts#reenviarMensagem"
        status: pass
      - kind: integration
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(30)(31)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O fio toca áudio e vídeo, mostra imagem e baixa documento pela URL assinada; anexo baixado: false e vídeo 3gpp tratados; nome hostil só como texto"
    requirement: MSG-04
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/anexo-da-mensagem.test.tsx#AnexoDaMensagemNoFio"
        status: pass
      - kind: integration
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(32)(33)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O compositor anexa arquivo de verdade (ticket, bytes ao bucket, Mensagem com anexos), só do que o Canal envia, sem microfone"
    requirement: MSG-04
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(34)-(42)"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/crm/mensagens.test.ts#pedirTicketDeAnexo e enviarMensagem com anexos"
        status: pass
    human_judgment: false
  - id: D4
    description: "O áudio de voz do WhatsApp (audio/ogg Opus) toca no navegador que o atendente usa, inclusive Safari (pressuposto A5)"
    requirement: MSG-04
    verification: []
    human_judgment: true
    rationale: "Codec de navegador real: jsdom não toca mídia; a prova é ao vivo no plano 16-16."

duration: 9min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 11: Entrega e mídia no fio Summary

**O fio da Conversa mostra se a resposta saiu (com "Tentar de novo" na que falhou), toca o áudio e o vídeo do cliente, mostra a imagem e baixa o documento por URL assinada, e o compositor anexa um arquivo de verdade, só do que o Canal envia**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-09T19:58:57Z
- **Completed:** 2026-11-09T20:08:00Z
- **Tasks:** 3 (todas TDD: RED, GREEN)
- **Files modified:** 9 (4 criados, 5 alterados)

## Accomplishments

- `EstadoDaEntrega` troca o ` · enviada` cru do fio por Enviando…, Enviada, Entregue, Lida; a Mensagem que falhou mostra "Não enviada", o `motivoFalha` e "Tentar de novo" (`POST /mensagens/:id/reenviar`), com botão desligado em "Enviando…" enquanto espera, sem voltar a "Não enviada" antes da leitura nova, e com a frase da api ao lado se ela recusar.
- `AnexoDaMensagemNoFio` desenha cada anexo abaixo do texto: `<audio controls>`, `<video controls>`, `<img alt=nome>` e, para documento e `video/3gpp`, o link "Baixar nome"; `baixado: false` vira "Arquivo indisponível: o provedor não entregou este arquivo." sem chamar a rota; erro do player pede a URL de novo uma vez.
- O compositor anexa arquivo de verdade: barra por categoria do Canal (Imagem, Áudio, Vídeo, Documento) com `accept` dos tipos de `tiposAceitosParaOCanal`, tipo e teto (16 MB áudio e vídeo, 25 MB o resto) conferidos antes de subir, depois ticket, `enviarBytesAoBucket` e `POST /mensagens` com `anexos` e `conteudo` vazio. Falha no bucket ou no ticket mantém o arquivo escolhido. Microfone, localização, figurinha, Flow e "Visualização única" saíram.

## Task Commits

1. **Task 1 (tracer): estado de entrega e Tentar de novo** - `9c84d6b` (test), `06ac0c1` (feat)
2. **Task 2: áudio, vídeo, imagem e documento no fio** - `4b4579c` (test), `c655595` (feat)
3. **Task 3: compositor anexa arquivo de verdade** - `1196f50` (test), `bc8e9e6` (feat)

**Plan metadata:** commit `docs(16-11)` desta SUMMARY, do STATE e do ROADMAP.

Nenhum commit de refactor: nada a limpar depois do GREEN.

## RED / GREEN (TDD)

- **RED:** cada tarefa subiu primeiro um commit `test(16-11)` com o esqueleto mínimo dos módulos novos (componente que devolve `null`, função que lança "não implementado") só para o teste falhar na asserção do comportamento, e não por importação quebrada. Task 1: 13 falhas (8 em `estado-da-entrega`, 5 em `mensagens`) mais 2 no fio, todas por texto ou botão ausente. Task 2: 15 falhas. Task 3: 13 falhas (barra antiga com "Arquivo" e sem seletor, microfone presente, `pedirTicketDeAnexo` não implementado). Avaliação semântica: em todas o alvo executou e falhou na asserção planejada. `workflow.tdd_mode` é `false` e o plano é `type: execute`, então o classificador `tdd-red-evidence` não foi rodado.
- **GREEN:** as implementações acima, e as suítes dos quatro arquivos de teste da área passam (81 testes).

## Verification

- `npm run typecheck -w @n1/web`: limpo.
- `npm run lint -w @n1/web`: 0 erros, 2 avisos que já existiam (`rotulos.ts`, `app-shell.tsx`).
- `npm run verificar:tokens -w @n1/web`: 445 definidos, 406 arquivos, 0 falhas.
- `npm run test -w @n1/web`: 135 arquivos, 1366 testes, todos passando.
- Testes da área: `estado-da-entrega` 9, `anexo-da-mensagem` 11, `mensagens` 19, `conversation-thread` 42.
- Critérios de aceite por `grep`: `Tentar de novo` em `estado-da-entrega.tsx` (2), `EstadoDaEntrega` no fio (2), `/reenviar` em `mensagens.ts` (1), `<audio` e `<video` no anexo (2 e 2), `dangerouslySetInnerHTML` (0), `Arquivo indisponível` (1), `enviarBytesAoBucket` no fio (2), `tiposAceitosParaOCanal` no fio (3), `getUserMedia` no fio (0) e a lista do Formulário intacta (1).

## Files Created/Modified

- `apps/web/src/features/crm/estado-da-entrega.tsx` (+ teste) - rótulos de entrega, motivo e Tentar de novo.
- `apps/web/src/features/crm/anexo-da-mensagem.tsx` (+ teste) - o anexo no fio.
- `apps/web/src/features/crm/conversation-thread.tsx` (+ teste) - liga os dois componentes e refaz a barra e o envio do compositor.
- `apps/web/src/dados/crm/mensagens.ts` (+ teste) - `reenviarMensagem`, `pedirTicketDeAnexo`, `chaveDoAnexo`, `useUrlDoAnexo`.
- `apps/web/src/dados/envio-ao-bucket.ts` - `recusaDoAnexoDaMensagem`; a lista e as constantes do Formulário não mudaram.

## Decisions Made

Ver `key-decisions`. O que mais pesa para os próximos planos:

- O fio já lê `Mensagem.anexos` e desenha cada um; o 16-12 (e quem mais mexer no fio) não precisa refazer isso. A chave SWR do anexo começa por `/mensagens`, então todo `invalidarCrm("/mensagens")` (envio, tempo real) revalida as URLs dos anexos visíveis: é uma chamada por anexo, aceita porque o player não reinicia.
- `EstadoDaEntrega` recebe a Mensagem inteira (só usa `id`, `direcao`, `statusEntrega`, `motivoFalha`); quando o tempo real (16-08) trocar o `statusEntrega` no cache, o rótulo acompanha sozinho.
- O compositor não lê `capacidades.voiceNote` nem `viewOnce` mais; quem quiser voltar a gravar áudio pelo navegador começa por uma decisão nova (D-16-10 diz que não).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Envelope do ticket: `dados`**
- **Found during:** Task 3
- **Issue:** o `<interfaces>` do plano descreve `POST /mensagens/anexos` como `{ ok: true, submissionId, objectId, uploadUrl }`; a rota real (`responder`) devolve `{ ok: true, dados: { ... } }`.
- **Fix:** `pedirTicketDeAnexo` lê `dados`, como as outras funções de `dados/crm/`.
- **Files modified:** `apps/web/src/dados/crm/mensagens.ts`
- **Committed in:** `bc8e9e6`

**2. [Rule 2 - Missing Critical] Só URL http(s) vira `src` ou `href`; arquivo vazio recusado**
- **Found during:** Task 2 e Task 3 (T-16-41, T-16-42)
- **Issue:** a URL vem da api, mas um `javascript:` num `href` seria XSS se a api algum dia a devolvesse; e um arquivo de 0 bytes passaria pela pré-conferência.
- **Fix:** `urlHttp` em `anexo-da-mensagem.tsx` (teste k); `recusaDoAnexoDaMensagem` recusa tamanho 0 com "Este arquivo está vazio."
- **Files modified:** `anexo-da-mensagem.tsx`, `envio-ao-bucket.ts`
- **Committed in:** `c655595`, `bc8e9e6`

**3. [Rule 1 - Bug] O player reiniciaria a cada envio de Mensagem**
- **Found during:** Task 2
- **Issue:** com a chave SWR do plano, `invalidarCrm("/mensagens")` revalida todo anexo, e uma URL assinada nova trocaria o `src` do `<audio>` no meio da reprodução.
- **Fix:** o player guarda a primeira URL e só troca depois de um erro dele; o link usa sempre a mais nova. `revalidateOnFocus: false` no hook.
- **Files modified:** `anexo-da-mensagem.tsx`, `mensagens.ts`
- **Committed in:** `c655595`

**4. [Rule 3 - Blocking] Testes do compositor ajustados na rodada GREEN**
- **Found during:** Task 3
- **Issue:** os testes (35), (36) e (39) a (41), escritos no RED, usavam a Conversa do WhatsApp oficial, cuja janela de 24 h já fechou nos dados do teste (o envio fica bloqueado), e (41) lia `disabled` de um `Button` que usa `aria-disabled`.
- **Fix:** o bloco passou a usar `cnv_suporte` (WhatsApp não oficial, sem janela) e a checar `aria-disabled`. Os casos de comportamento não mudaram.
- **Files modified:** `conversation-thread.test.tsx`
- **Committed in:** `bc8e9e6`

---

**Total deviations:** 4 auto-fixed (2 Rule 1, 1 Rule 2, 1 Rule 3)
**Impact on plan:** nenhum alarga o escopo; todos protegem o que o plano pedia.

## Issues Encountered

None além dos desvios acima.

## Known Stubs

Nenhum. Os esqueletos do RED foram todos substituídos no GREEN.

## Threat Flags

Nenhum. T-16-41 (XSS por nome e legenda) mitigado: texto do React, `dangerouslySetInnerHTML` zero, testes com nome hostil e com motivo hostil. T-16-42 mitigado: a tela só pré-confere, a api confere de novo (16-09). T-16-SC: nenhum pacote novo.

## Documentation Owed

`apps/web/CONTEXT.md` não está nos `files_modified` deste plano; para o 16-14: no parágrafo do fio (15-20), registrar que (a) a Mensagem enviada mostra `EstadoDaEntrega` e a que falhou tem "Tentar de novo" por `POST /mensagens/:id/reenviar` (a frase "sem botão Tentar de novo" do D-14 do store fala das gravações do store, não do fio); (b) o anexo é desenhado por `AnexoDaMensagemNoFio` com URL de `GET /mensagens/:id/anexos/:indice` (`useUrlDoAnexo`, 4 min, player renova só no erro); (c) o compositor só oferece as categorias de `tiposAceitosParaOCanal`, usa `recusaDoAnexoDaMensagem` (e não `TIPOS_DE_ARQUIVO_ACEITOS`, que fica para Formulário e Tarefa) e não tem microfone nem "ver uma vez".

## Next Phase Readiness

- Pronto para o 16-12. Em aberto, fora do código: o pressuposto A5 (áudio ogg/opus no Safari), que só se prova ao vivo no 16-16.

## Self-Check: PASSED

- Arquivos criados existem: `estado-da-entrega.tsx`, `estado-da-entrega.test.tsx`, `anexo-da-mensagem.tsx`, `anexo-da-mensagem.test.tsx` (verificado com `[ -f ]`).
- Commits `9c84d6b`, `06ac0c1`, `4b4579c`, `c655595`, `1196f50`, `bc8e9e6` são ancestrais de HEAD.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
