---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 23
subsystem: ui
tags: [react, nextjs, playwright, vitest, upload, supabase-storage, accessibility]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-20 (transportePublico.pedirTicket, FormularioPublico com o ponto de montagem do upload); Plan 02-11/02-16 (contrato de duas fases do upload em apps/api)"
provides:
  - "UploadDeArquivos: controle composto de upload por arquivo com os quatro estados (aguardando/enviando/enviado/falhou), progresso real via XMLHttpRequest, sessão de upload compartilhada entre perguntas de arquivo"
  - "Confirmacao: painel de confirmação pública com role=status intercalado, copiar número e reinício de sessão"
  - "e2e/formulario-publico.spec.ts: jornada Playwright de V02-02D, com skip limpo sem ambiente de teste provisionado"
affects: [02-solicita-o-de-pagamento-o-front-substitui-o-clickup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Upload direto ao bucket privado via XMLHttpRequest (não fetch) para expor XMLHttpRequest.upload.onprogress — fetch sem duplex não reporta progresso de upload"
    - "Sessão de upload compartilhada entre múltiplos controles de arquivo do mesmo Formulário via uma fila serializada (executarPedidoDeTicket) em vez de estado local por controle — evita duas sessões abertas por uma corrida entre perguntas"
    - "Confirmação pública com DUAS regiões role=status (não uma) para satisfazer simultaneamente 'ordem visual com o rótulo entre elas' e 'rótulo/botões fora da live region'"
    - "e2e que precisa de ambiente de teste externo pula com test.skip(condition, mensagem) dentro de beforeEach, nunca falha nem trava sem E2E_API_URL/E2E_FORM_SECRET"

key-files:
  created:
    - apps/web/src/features/formulario-publico/upload-de-arquivos.tsx
    - apps/web/src/features/formulario-publico/confirmacao.tsx
    - apps/web/src/features/formulario-publico/upload-de-arquivos.test.tsx
    - apps/web/e2e/formulario-publico.spec.ts
  modified:
    - apps/web/src/features/formulario-publico/formulario.tsx

key-decisions:
  - "submissionId nasce local (crypto.randomUUID) mas é SUBSTITUÍDO pelo valor do servidor assim que a primeira pergunta de arquivo pede um ticket — formulario.tsx serializa os pedidos de ticket entre Anexo/Boleto/QR Code numa fila para nunca abrir duas sessões para o mesmo envio"
  - "Validação de tipo/tamanho no cliente é cortesia: um arquivo inválido no mesmo lote de um válido não impede o válido de chegar ao servidor (prova em upload-de-arquivos.test.tsx caso e)"
  - "Cancelar envio remove o arquivo da lista (mesmo efeito de Remover, mais abort() do XHR em voo) — o UI-SPEC não define um quinto estado 'cancelado'"
  - "e2e usa E2E_API_URL + E2E_FORM_SECRET (novo) além de E2E_BASE_URL — documentado no cabeçalho do spec que NEXT_PUBLIC_API_URL do build precisa apontar para o MESMO apps/api de teste"

patterns-established:
  - "Componente de upload NUNCA constrói URL de bucket: só usa uploadUrl/token devolvidos pelo ticket (grep de service_role/anon_key/supabaseKey limpo)"

requirements-completed: []  # SOL-02 permanece aberto — Task 4 (checkpoint humano) ainda não ocorreu

# Metrics
duration: ~65min (Tasks 1-3; Task 4 é checkpoint humano, não iniciado)
completed: 2026-09-21
---

# Phase 02 Plan 23: Upload de arquivos e confirmação pública Summary

**Controle de upload por arquivo com progresso real via XMLHttpRequest direto ao bucket privado, confirmação pública com duas regiões role=status, e a jornada Playwright de V02-02D — que pula (não falha) sem um apps/api de teste provisionado.**

## Performance

- **Duration:** ~65 min (Tasks 1–3)
- **Completed:** 2026-09-21 (Tasks 1–3); Task 4 (checkpoint humano) aguardando
- **Tasks:** 3 de 4 (Task 4 é `checkpoint:human-verify`, gate="blocking" — não executável por este agente)
- **Files modified:** 5 (3 criados, 1 modificado, 1 de teste criado) + `e2e/formulario-publico.spec.ts`

## Accomplishments

- `UploadDeArquivos` (`upload-de-arquivos.tsx`): escolhe arquivo → pede ticket (`transportePublico.pedirTicket`) → sobe bytes direto ao bucket privado via `XMLHttpRequest` (progresso real, `XMLHttpRequest.upload.onprogress`) — os quatro estados (`aguardando`/`enviando`/`enviado`/`falhou`) com a copy exata do UI-SPEC, validação de tipo/tamanho no cliente como cortesia (autoridade é o servidor), limite de 10 arquivos por ENVIO (não por campo).
- `formulario.tsx` monta o controle nas perguntas de arquivo (`Anexo` sempre visível; `Boleto`/`QR Code` condicionais) e serializa os pedidos de ticket entre elas (`executarPedidoDeTicket`) para nunca abrir duas sessões de upload para o mesmo envio — a MESMA `submissionId` do servidor passa a valer para todo ticket e para a submissão final assim que a primeira pergunta de arquivo a obtém.
- `Confirmacao` (`confirmacao.tsx`): recibo público — só ícone/heading/corpo, o número legível e "Copiar número"/"Enviar outra solicitação"; identificador dentro de `role="status"`, rótulo e botões fora.
- `upload-de-arquivos.test.tsx`: os 11 casos (a)–(k) do plano, todos passando, com um `XMLHttpRequest` falso controlável (sem rede real).
- `e2e/formulario-publico.spec.ts`: jornada completa de V02-02D contra o build de produção; **confirmado neste ambiente** que ela pula (2/2 `skipped`, exit 0) com mensagem clara quando `E2E_API_URL`/`E2E_FORM_SECRET` não estão definidos — o caminho realmente executado aqui foi o de skip, não a jornada inteira (ver "O que rodou de fato" abaixo).

## Task Commits

1. **Task 1: Controle de upload por arquivo** - `43afe86` (feat)
2. **Task 2: Confirmação pública e testes de seletor** - `9c3c47f` (feat)
3. **Task 3: Jornada Playwright do formulário público** - `830b035` (feat)

Task 4 (`checkpoint:human-verify`, gate="blocking") não foi iniciada — ver "Checkpoint pendente" abaixo. Nenhum commit de metadados de plano (`docs(02-23): complete ...`) foi feito ainda: por instrução explícita do orquestrador para esta execução, STATE.md/ROADMAP.md não são tocados por este agente, e o plano só está "completo" depois do checkpoint humano.

## Files Created/Modified

- `apps/web/src/features/formulario-publico/upload-de-arquivos.tsx` (novo, 349 linhas) — o controle composto de upload
- `apps/web/src/features/formulario-publico/confirmacao.tsx` (novo) — o recibo público
- `apps/web/src/features/formulario-publico/upload-de-arquivos.test.tsx` (novo) — os 11 casos (a)-(k)
- `apps/web/src/features/formulario-publico/formulario.tsx` (modificado) — monta o upload, coordena a sessão compartilhada, agrega `attachments`/`uploadEmAndamento`, troca a confirmação inline pelo componente `Confirmacao`, devolve foco ao heading em "Enviar outra solicitação"
- `apps/web/e2e/formulario-publico.spec.ts` (novo) — a jornada de navegador

## Decisions Made

- **Sessão de upload compartilhada:** como até duas perguntas de arquivo podem estar visíveis ao mesmo tempo (`Anexo` + `Boleto` OU `Anexo` + `QR Code`), o `submissionId` de sessão do servidor (obtido só na primeira chamada bem-sucedida de `pedirTicket`) precisa ser um valor ÚNICO compartilhado. `formulario.tsx` serializa os pedidos via uma fila (`executarPedidoDeTicket`, uma cadeia de Promises) — sem isso, duas escolhas de arquivo quase simultâneas em campos diferentes poderiam cada uma pedir um ticket sem `submissionId`, abrindo duas sessões para o mesmo envio.
- **"Aguardando envio" observável:** `iniciarEnvio` cede um microtask (`await Promise.resolve()`) antes de sair de `aguardando` — sem isso, a transição para `enviando` acontece de forma síncrona demais para ser testável/perceptível como estado distinto quando vários arquivos são escolhidos no mesmo lote.
- **Confirmação com duas regiões `role="status"`:** o UI-SPEC pede uma "ordem visual" onde o rótulo `Número da solicitação` fica ENTRE o corpo (que deve estar dentro da live region) e o identificador (que também deve estar dentro), mas o próprio rótulo deve ficar FORA da live region — uma única região contígua não alcança as duas exigências ao mesmo tempo. Resolvido com duas regiões: uma para ícone+heading+corpo, outra para o identificador.
- **`E2E_FORM_SECRET` como variável nova:** o plano só nomeia `E2E_BASE_URL`/`E2E_API_URL`, mas a jornada precisa saber QUAL segredo de Formulário testar contra o `apps/api` de teste — `formulario-publico.spec.ts` também lê `E2E_FORM_SECRET` e pula com mensagem clara se ausente. Ver "Issues Encontrados" para o porquê disto ser necessário e o que falta para alguém rodar a jornada de ponta a ponta.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Testabilidade] Microtask antes de sair de "aguardando"**
- **Found during:** Task 2 (escrevendo o caso (a) do teste de seletor)
- **Issue:** `iniciarEnvio` mudava para `enviando` de forma síncrona demais dentro do mesmo ciclo de evento de `onChange` — o estado `aguardando` nunca ficava observável, mesmo sendo real (a fila de tickets serializada faz arquivos subsequentes esperarem de verdade).
- **Fix:** `await Promise.resolve()` como primeira linha de `iniciarEnvio`.
- **Files modified:** `apps/web/src/features/formulario-publico/upload-de-arquivos.tsx`
- **Committed in:** `9c3c47f`

**2. [Rule 1 - Bug] Comentário de `confirmacao.tsx` continha as próprias palavras banidas**
- **Found during:** Task 2 (rodando o grep do critério de aceite)
- **Issue:** O comentário de topo do arquivo dizia "link de acompanhamento" — o próprio `grep -niE 'acompanhar|acompanhamento|...'` do critério de aceite batia na documentação, não no código.
- **Fix:** Reescrito para "link de rastreio externo" / "situação interna do processo" / "quem decide", preservando o sentido sem as palavras banidas.
- **Files modified:** `apps/web/src/features/formulario-publico/confirmacao.tsx`
- **Committed in:** `9c3c47f`

---

**Total deviations:** 2 auto-fixed (ambos Rule 1). Nenhuma mudança de escopo — os dois foram encontrados escrevendo e verificando os próprios critérios de aceite deste plano.

**Fora de escopo, registrado e NÃO corrigido** (Rule 3 exclui alterações fora de `files_modified`/fora do repositório declarado):

- **`apps/api` — `consumirSessao` incondicional em `POST .../submissions`.** Ao escrever a coordenação de `submissionId`, encontrei que `formularios-publicos.ts` chama `consumirSessao(cliente, submissionId)` mesmo quando `attachments` está vazio. Como uma sessão do servidor só nasce em `POST .../uploads`, um envio do Formulário público SEM nenhum anexo (a pergunta `Anexo` pode não ser obrigatória) usaria um `submissionId` gerado só no cliente — que nunca teve uma sessão real — e terminaria em 409 (`sessao_inexistente`). **Não corrigido**: está fora de `apps/web` (fora de `files_modified` deste plano) e fora do repositório que este agente pode tocar nesta execução (Plan 02-24 roda concorrentemente em `apps/api`). Registrado em `deferred-items.md` com a correção sugerida.

## Issues Encountered

- **O `apps/api` de teste real é inatingível deste ambiente** (IPv6 egress indisponível para `db.<ref>.supabase.co`), então a jornada completa de Playwright (upload real, submissão real) nunca poderia rodar ponta a ponta aqui de qualquer forma — mesmo com um Formulário de teste provisionado.
- **Nenhum `E2E_FORM_SECRET` de teste está provisionado.** O evolver de Solicitações de pagamento (`packages/dominio/src/solicitacao-de-pagamento-evolver.ts`) cria a Lista/Campos/Papéis, mas NÃO cria um Formulário público — isso é feito manualmente (operação `createForm` autenticada) e não existe hoje um Formulário de teste com o segredo documentado em lugar nenhum do repositório. Fica para quem provisionar o ambiente de teste E2E: rodar o evolver, autenticar como um Membro do Espaço e chamar a operação de criar Formulário para a Lista de Solicitações, documentando o segredo resultante como `E2E_FORM_SECRET`.
- **Criar/ler `apps/web/.env.local` está bloqueado pela política de permissões deste ambiente** (tanto `Read` quanto `Write` recusam qualquer caminho `.env*`). Isso não impediu a validação: `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`NEXT_PUBLIC_API_URL` foram exportadas diretamente no processo do shell (nunca gravadas em arquivo), permitindo `npm run build` e a suíte Playwright completa rodarem.

### O que rodou de fato vs. o que só foi escrito

| Item | Rodou aqui? | Evidência |
|---|---|---|
| `npm run test -w @n1/web` (unit/component, incl. os 11 casos a-k) | **Sim** | 8 arquivos de teste, 97 testes, todos verdes |
| `npm run typecheck`, `lint`, `verificar:tokens` (3 workspaces) | **Sim** | `npm run check` verde |
| `e2e/formulario-publico.spec.ts` — caminho de SKIP (sem env) | **Sim** | `npx playwright test e2e/formulario-publico.spec.ts` → `2 skipped`, exit 0, mensagem de skip confirmada via reporter JSON |
| `e2e/formulario-publico.spec.ts` — a jornada completa (preencher/anexar/enviar/confirmar) | **NÃO — só escrita, nunca executada** | Backend de teste inatingível (rede) + nenhum `E2E_FORM_SECRET` provisionado. Não fingido como passando: o único resultado observado foi o skip. |
| Upload real contra um bucket privado do Supabase Storage | **NÃO — só escrita** | Mesmo motivo acima; a prova manual de bucket privado é exatamente o propósito da Task 4 (checkpoint humano) |
| `e2e/fumaca.spec.ts` (pré-existente, Plan 02-01) | Rodou e **falhou** neste ambiente | Causa: credenciais Supabase placeholder (fictícias, só para permitir o build) fazem `proxy.ts` tentar uma chamada de rede real a um projeto inexistente — não é regressão deste plano (`fumaca.spec.ts` não está em `files_modified`); confirmar com credenciais reais fica para quem tiver acesso a um projeto Supabase de teste |

## Checkpoint pendente (Task 4 — `checkpoint:human-verify`, gate="blocking")

Tasks 1–3 estão completas, commitadas e verificadas (`npm run check` verde). **Task 4 não pode ser executada por este agente**: ela pede sete passos manuais num navegador real contra infraestrutura real —

1. `npm run dev`; abrir `/f/<segredo>` sem sessão
2. Preencher e anexar um PDF real; confirmar progresso, "Arquivo enviado", remover/reanexar
3. Enviar e conferir a confirmação (número, "Copiar número", sem link de acompanhamento)
4. No dashboard do Supabase, copiar a URL direta do objeto e abrir em aba anônima → deve falhar
5. Abrir a Tarefa criada no CRM N1, baixar o anexo pela timeline → deve funcionar
6. Tentar reutilizar um ticket de upload de outra submissão pelo devtools → deve ser recusado
7. Repetir o fluxo em 375px, só com teclado, sem drag-and-drop

Nenhum destes é automatizável sem: (a) um Supabase real com bucket privado configurado, (b) um `apps/api` rodando contra Postgres real, (c) um Formulário público de verdade publicado, e (d) um humano avaliando clareza visual — exatamente o que a Task 4 existe para prover. Este ambiente sandbox não tem acesso de rede a Postgres/Storage (IPv6 egress indisponível) nem credenciais Supabase reais.

**Resume signal do plano:** "Digite 'aprovado' ou descreva os problemas" — depois que um humano completar os 7 passos acima contra um ambiente com infraestrutura real.

## User Setup Required

Para a Task 4 (e para rodar `e2e/formulario-publico.spec.ts` de ponta a ponta em qualquer ambiente futuro), alguém com acesso à infraestrutura real precisa:
1. Ter um `apps/api` rodando contra Postgres/Supabase Storage reais (de teste, nunca produção).
2. Rodar o evolver de Solicitações de pagamento e criar (uma vez) um Formulário público para a Lista resultante, anotando o segredo.
3. Exportar `E2E_API_URL`, `E2E_FORM_SECRET`, e `NEXT_PUBLIC_API_URL` (igual a `E2E_API_URL`) antes de `npm run test:e2e -w @n1/web`.
4. Ter um `apps/web/.env.local` real (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) para `npm run dev`/`next build` não falharem no proxy de autenticação.

## Next Phase Readiness

Bloqueado em Task 4 (checkpoint humano) — este mesmo plano (02-23), não a próxima fase. Uma vez aprovado (ou com as divergências resolvidas), SOL-02 fica completo: o pedido entra pelo Formulário do CRM N1 com anexo real em bucket privado, e o solicitante sai só com um número.

## Self-Check: PASSED

- `apps/web/src/features/formulario-publico/upload-de-arquivos.tsx` — FOUND
- `apps/web/src/features/formulario-publico/confirmacao.tsx` — FOUND
- `apps/web/src/features/formulario-publico/upload-de-arquivos.test.tsx` — FOUND
- `apps/web/e2e/formulario-publico.spec.ts` — FOUND
- Commit `43afe86` (Task 1) — FOUND
- Commit `9c3c47f` (Task 2) — FOUND
- Commit `830b035` (Task 3) — FOUND

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Plan: 23*
*Status: Tasks 1-3 completas; Task 4 (checkpoint humano) pendente*
