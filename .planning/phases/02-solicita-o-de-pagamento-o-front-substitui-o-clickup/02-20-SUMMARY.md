---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 20
subsystem: ui
tags: [nextjs, react, forms, public-form, http-client, accessibility]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-16 — as três rotas públicas do Formulário (GET .../forms/:secret, POST .../uploads, POST .../submissions) e o DTO sanitizado"
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-05 — submitForm atômico com Ator formulario:<id> (D-03)"
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-11 — upload em duas fases, bucket privado (D-04)"
provides:
  - "transportePublico (apps/web/src/dados/transporte-publico.ts) — cliente HTTP público, sem Authorization"
  - "FormularioPublico (apps/web/src/features/formulario-publico/formulario.tsx) — o componente do Formulário público"
  - "camposVisiveis/camposInvalidadosPor (campos-condicionais.ts) — regra de visibilidade CPF/CNPJ e Forma de pagamento, puras"
  - "/f/[segredo] como Server Component que fala com apps/api, sem provider em memória"
  - "prop `required` em TextInput/TextArea/Select/MultiSelect (aria-required) — reusável por qualquer formulário futuro"
affects: [02-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client Component de formulário público que fala direto com o Fastify por fetch, sem Route Handler/BFF do Next"
    - "Máscara de apresentação com valor canônico separado (moeda em centavos internos, convertida para reais decimais só no envio)"
    - "Regras condicionais de formulário como funções puras por RÓTULO (não por id), testáveis sem DOM"

key-files:
  created:
    - apps/web/src/dados/transporte-publico.ts
    - apps/web/src/features/formulario-publico/campos-condicionais.ts
    - apps/web/src/features/formulario-publico/formulario.tsx
    - apps/web/src/features/formulario-publico/formulario.test.tsx
    - apps/web/src/app/(publico)/f/[segredo]/loading.tsx
    - apps/web/src/app/(publico)/p/[segredo]/layout.tsx
  modified:
    - apps/web/src/app/(publico)/f/[segredo]/page.tsx
    - apps/web/src/app/(publico)/layout.tsx
    - apps/web/src/dados/publico-provider.tsx
    - apps/web/src/design/components.tsx

key-decisions:
  - "Moeda: internamente rastreada em centavos (mascara sem erro de ponto flutuante) mas convertida para reais decimais (ex.: \"1234.56\") no envio — setTaskFieldValue faz Number(texto.replace(',', '.')) sem dividir por 100; enviar centavos gravaria 100x o valor"
  - "Título e introdução do Formulário público são hardcoded conforme o Copywriting Contract do UI-SPEC (\"a introdução definida NESTE CONTRATO\"), não lidos de formulario.intro/title do DTO"
  - "PublicoProvider deixou de envolver /f/[segredo]; só /p/[segredo] ainda o usa (movido para um layout próprio dessa rota)"
  - "Campos condicionais decididos por RÓTULO da pergunta, não por id — o DTO público não expõe definitionId (T-02-03)"

patterns-established:
  - "Pattern: rota pública sem shell fala com apps/api por um transporte próprio (não o transporteHttp autenticado), lendo só NEXT_PUBLIC_API_URL"
  - "Pattern: erro de rede numa página Server Component usa uma âncora <a href> para a mesma URL como 'Tentar novamente' — sem precisar de Client Component só para isso"

requirements-completed: [SOL-02]

# Metrics
duration: ~55min
completed: 2026-09-21
---

# Phase 02 Plan 20: Formulário público fala com o apps/api Summary

**O Formulário público (`/f/<segredo>`) troca o provider em memória por um cliente HTTP das rotas do Plan 02-16, com as 7 seções, campos condicionais CPF/CNPJ e Forma de pagamento, e validação do UI-SPEC.**

## Performance

- **Duration:** ~55min (estimativa — o horário de início não foi capturado antes da primeira leitura)
- **Completed:** 2026-09-21T23:09:13Z
- **Tasks:** 3/3
- **Files modified:** 10 (6 novos, 4 modificados)

## Accomplishments

- `/f/[segredo]` virou um Server Component de verdade: busca o DTO público no `apps/api` com `await params`, entrega só o DTO sanitizado ao Client Component, e o antigo caminho em memória (`buildProductSeed()` + operação de domínio local) deixou de existir nesse caminho (D-02).
- `FormularioPublico` implementa as 7 seções da ordem canônica do UI-SPEC, os campos condicionais de Fornecedor (CPF/CNPJ) e Forma de pagamento (Chave Pix/Boleto/QRCode Pix/Cartão) com confirmação antes de apagar dado já digitado, resumo de erros focável com `role="alert"` e links por campo, e envio com `submissionId` estável por tentativa (reusada em todo retry).
- `campos-condicionais.ts` isola a tabela de visibilidade em duas funções puras, testadas sem DOM.

## Task Commits

Each task was committed atomically:

1. **Task 1: Transporte público e a página `/f/[segredo]`** - `40cb653` (feat)
2. **Task 2: Campos condicionais, seções e validação** - `4c1b16e` (feat)
3. **Task 3: Testes de campos condicionais e validação** - `1b83fe6` (test)

_Nenhum commit de metadados adicional ainda — este SUMMARY.md e o commit final `docs(...)` fecham o plano._

## Files Created/Modified

- `apps/web/src/dados/transporte-publico.ts` - `transportePublico`: `obterFormulario`/`pedirTicket`/`enviarSubmissao`, cliente HTTP público sem `Authorization`
- `apps/web/src/features/formulario-publico/campos-condicionais.ts` - `camposVisiveis`/`camposInvalidadosPor`, puras, por rótulo
- `apps/web/src/features/formulario-publico/formulario.tsx` - o Client Component do Formulário: seções, campos, máscaras, confirmação de troca, envio
- `apps/web/src/features/formulario-publico/formulario.test.tsx` - os 11 casos (a)-(k) de V02-02A/V02-02D
- `apps/web/src/app/(publico)/f/[segredo]/page.tsx` - reescrito como Server Component; estados indisponível/falha/ok
- `apps/web/src/app/(publico)/f/[segredo]/loading.tsx` - skeleton de rota (Next.js `loading.tsx`)
- `apps/web/src/app/(publico)/layout.tsx` - reduzido a passthrough; não monta mais `PublicoProvider`
- `apps/web/src/app/(publico)/p/[segredo]/layout.tsx` - novo lar do `PublicoProvider`, só para `/p/[segredo]`
- `apps/web/src/dados/publico-provider.tsx` - docstring atualizada: não serve mais o Formulário
- `apps/web/src/design/components.tsx` - `required?: boolean` (→ `aria-required`) em `TextInput`/`TextArea`/`Select`/`MultiSelect`

## Decisions Made

- **Moeda em centavos internos, reais decimais no envio.** O UI-SPEC pede "moeda... envia centavos", mas `setTaskFieldValue` (`@n1/dominio/operations/tasks.ts`, case `"currency"`) faz `Number(String(value).replace(",", "."))` — sem dividir por 100 — o mesmo padrão que `task-editors.tsx` já usa para editar este Campo autenticado (`type="number"`, `Number(texto)`). Mandar a string `"123456"` gravaria R$123.456,00 no lugar de R$1.234,56: um erro de 100x em todo valor de Solicitação submetido pelo público. `formulario.tsx` mantém o dígitos-como-centavos só como estado interno de máscara (evita erro de ponto flutuante ao digitar) e converte para `"1234.56"` (reais decimais) na hora de montar `answers` — o teste (h) prova o valor convertido no payload, não a string de centavos.
- **Título/introdução hardcoded, não lidos do DTO.** O UI-SPEC diz "a introdução definida NESTE CONTRATO" — a interpretação adotada foi que a apresentação do Formulário canônico da Solicitação usa a copy fixa do Copywriting Contract, não `formulario.title`/`formulario.intro` (que existem no DTO para um Formulário genérico configurável, mas este plano é especificamente sobre o Formulário canônico).
- **`PublicoProvider` não envolve mais `/f/[segredo]`.** `(publico)/layout.tsx` montava o provider para as duas rotas do grupo (`/f` e `/p`); como só `/p/[segredo]` (compartilhamento público de Tarefa) ainda lê o seed em memória, o provider foi movido para `apps/web/src/app/(publico)/p/[segredo]/layout.tsx` e `(publico)/layout.tsx` virou um passthrough. Ver "Deviations" abaixo — sem essa mudança a verdade "o provider em memória... deixa de existir nesse caminho" não seria satisfeita de fato (o provider continuaria montando `buildProductSeed()` a cada visita a `/f/<segredo>`, mesmo sem ser lido).
- **Regras condicionais por RÓTULO, não por id.** O DTO público nunca expõe `definitionId` (T-02-03), então `camposVisiveis`/`camposInvalidadosPor` leem `pergunta.label` — o mesmo texto usado na tabela do UI-SPEC. `formulario.tsx` traduz entre `pergunta.id` (o que usa para `respostas`/`answers`) e `pergunta.label` (o que as funções puras leem) via um mapa derivado (`respostasPorRotulo`).
- **Confirmação e controle de arquivo do upload real ficam para o Plan 02-23**, conforme o próprio plano delimita. As perguntas `kind: "file"` renderizam um botão `Adicionar arquivos` desabilitado com `disabledReason` explicando a razão — reserva o ponto sem inventar um controle de upload fora do escopo desta plano.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moeda enviada em reais decimais, não em centavos inteiros**
- **Found during:** Task 2 (validação e envio)
- **Issue:** O texto do plano/UI-SPEC pede "moeda... envia centavos". `setTaskFieldValue` para Campo `currency` faz `Number(String(valor).replace(",","."))` sem dividir por 100 (confirmado também em `task-editors.tsx`, que edita o mesmo tipo de Campo com `type="number"`/`Number(texto)`). Enviar a string de centavos (`"123456"`) gravaria R$123.456,00 em vez de R$1.234,56 — um erro de 100x em cada Solicitação submetida pelo público, quebrando a correção financeira do fluxo que este plano existe para construir.
- **Fix:** `formulario.tsx` mantém centavos só como representação interna da máscara (evita erro de ponto flutuante ao digitar) e converte para reais decimais (`(centavos/100).toFixed(2)`) antes de montar `answers` para `enviarSubmissao`.
- **Files modified:** `apps/web/src/features/formulario-publico/formulario.tsx`
- **Verification:** Teste (h) em `formulario.test.tsx` prova que o payload de `enviarSubmissao` recebe `"1234.56"`, não `"123456"`, para a entrada `"1.234,56"`.
- **Committed in:** `4c1b16e` (Task 2 commit)

**2. [Rule 2 - Missing Critical] `aria-required` não chegava ao controle**
- **Found during:** Task 2 (renderização dos campos)
- **Issue:** UI-SPEC exige `aria-required` nas perguntas obrigatórias ("Obrigatoriedade e validação"). `Field` só desenha o asterisco visual; nenhuma primitiva do barril (`TextInput`/`TextArea`/`Select`/`MultiSelect`) tinha como setar `aria-required` no controle real.
- **Fix:** Acrescentado `required?: boolean` (default `false`, aditivo — não quebra nenhum uso existente) às quatro primitivas em `apps/web/src/design/components.tsx`, setando `aria-required` no elemento nativo/combobox.
- **Files modified:** `apps/web/src/design/components.tsx`
- **Verification:** `npm run check` verde nos três workspaces (261+86+315 testes); `npm run build -w @n1/web` sai 0.
- **Committed in:** `4c1b16e` (Task 2 commit)

**3. [Rule 2 - Missing Critical] `PublicoProvider` ainda montava o seed em memória para `/f/[segredo]`**
- **Found during:** Task 1 (reescrita de `page.tsx`)
- **Issue:** O plano lista `apps/web/src/dados/publico-provider.tsx` em `files_modified` mas não `layout.tsx`. `(publico)/layout.tsx` montava `PublicoProvider` (e portanto `buildProductSeed()`) para as duas rotas do grupo (`/f` e `/p`). Sem mudar isso, a verdade obrigatória do plano ("o provider em memória que montava o seed deixa de existir nesse caminho") não se sustentaria: o provider continuaria rodando a cada visita a `/f/<segredo>`, só que sem ser lido pelo novo Client Component.
- **Fix:** Movido `PublicoProvider` para um layout próprio de `/p/[segredo]` (`apps/web/src/app/(publico)/p/[segredo]/layout.tsx`); `(publico)/layout.tsx` reduzido a um passthrough (`<>{children}</>`).
- **Files modified:** `apps/web/src/app/(publico)/layout.tsx`, `apps/web/src/app/(publico)/p/[segredo]/layout.tsx` (novo)
- **Verification:** `npm run build -w @n1/web` gera `/f/[segredo]` e `/p/[segredo]` como rotas dinâmicas separadas; `/p/[segredo]/page.tsx` (fora do escopo deste plano) segue usando `useData`/`PublicoProvider` sem alteração de comportamento.
- **Committed in:** `40cb653` (Task 1 commit)

**4. [Rule 2 - Missing Critical] Estado de carregamento e erro de rede não tinham onde viver após a mudança para Server Component**
- **Found during:** Task 1 (reescrita de `page.tsx`)
- **Issue:** A UI-SPEC exige skeleton durante o carregamento ("nunca tela em branco") e `Tentar novamente` num erro de rede. Como `page.tsx` virou `async` (busca no servidor antes de renderizar), não há mais um estado de `loading` client-side para cobrir isso — e o plano não listava um arquivo para isso.
- **Fix:** Criado `apps/web/src/app/(publico)/f/[segredo]/loading.tsx` (convenção nativa do Next.js — cobre o carregamento da árvore assíncrona automaticamente). O estado de falha de rede em `page.tsx` usa uma âncora `<a href="/f/<segredo>">Tentar novamente</a>` simples, sem JavaScript, que refaz o `GET` no servidor ao navegar.
- **Files modified:** `apps/web/src/app/(publico)/f/[segredo]/loading.tsx` (novo), `apps/web/src/app/(publico)/f/[segredo]/page.tsx`
- **Verification:** `npm run build -w @n1/web` sai 0; skeleton usa `Esqueleto`/`EsqueletoDeLinhas` do barril, sem componente novo.
- **Committed in:** `40cb653` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 bug de correção financeira, 3 funcionalidade crítica ausente)
**Impact on plan:** Todos os quatro são necessários para correção (financeira, arquitetural ou de acessibilidade) ou para que a própria verdade obrigatória do plano se sustente. Nenhum é scope creep — nenhum introduz funcionalidade fora do que o plano já pedia.

## Issues Encountered

- `getByLabelText` do testing-library casa pelo `textContent` do `<label>`, que inclui o asterisco visual de obrigatório (`" *"`) desenhado por `Field`. Resolvido usando `{ exact: false }` num helper de teste, em vez de repetir o asterisco em cada consulta.
- `Intl`/`toLocaleString("pt-BR", { style: "currency", currency: "BRL" })` usa NBSP (U+00A0), não espaço comum, entre `"R$"` e o número — um literal `"R$ 1.234,56"` no teste não batia por causa do caractere invisível. Resolvido comparando contra o valor formatado pela mesma chamada, não contra uma string hardcoded.
- Múltiplos elementos com `role="alert"` no DOM (o resumo de erros + o `<p role="alert">` de cada erro de campo, já embutido em `Field`) quebravam `getByRole("alert")` sem nome. Resolvido dando `aria-label="Resumo de erros"` ao contêiner do resumo.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- O Plan 02-23 (upload real + tela de confirmação completa) tem onde entrar: a seção "Documento e datas" já reserva o ponto para cada pergunta `kind: "file"`, e o componente já lê `uploadEmAndamento` de uma prop para travar o CTA.
- `transportePublico.pedirTicket` já está implementado e tipado (Task 1), pronto para o Plan 02-23 chamar ao construir o controle de upload real.
- A tela de sucesso atual (`formulario.tsx`, ramo `enviado`) é um placeholder mínimo (heading + número) — o Plan 02-23 substitui por: `role="status"` com live region conforme a seção "Confirmação pública" do UI-SPEC, `Copiar número`/`Número copiado.` e `Enviar outra solicitação`.
- Nenhum bloqueio conhecido para a Fila de aprovações ou os demais planos da Fase 2.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*

## Self-Check: PASSED

Todos os 11 arquivos (criados/modificados) e os 3 commits de task (`40cb653`, `4c1b16e`, `1b83fe6`) foram confirmados presentes no disco e no `git log` desta branch.
