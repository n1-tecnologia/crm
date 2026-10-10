---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 11
subsystem: web-crm
tags: [next, react, swr, vitest, negocios, ficha, mover, encerramento, ciclo-de-vida, d-02, d-04, d-05, d-14, d-15]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-10: useNegocio/useNegocios e as mutacoes de Negocio (editar, mover, ganhar, perder, reabrir, arquivar, restaurar, lixeira, permanente), valorDigitadoParaDecimal, DialogoDeEncerramento, DialogoNovoNegocio com valorInicial.empresa|contato, marcarChegada na criacao; 07-06/07-09: FichaDeContato, FichaDeEmpresa, AcoesDeCicloDeVida, MensagemDeRecusa, seloDoEstado, SeletorDeRegistro, SeletorDeProprietario, usePodeNoCrm, useNomeDoMembro; 07-08: GET /negocios?empresaId|contatoId e os 409 de Negocio; dominio: validarEdicao, validarMovimento, probabilidadeEfetiva"
provides:
  - "features/crm/ficha-de-negocio.tsx: FichaDeNegocio (Dados com PATCH so do que mudou, Dono Empresa OU Contato com troca por Segmentos + SeletorDeRegistro, Etapa por Select -> POST /mover e Mudar de Funil com Etapa obrigatoria, Encerramento pelo DialogoDeEncerramento, AcoesDeCicloDeVida; arquivado so leitura; Toast de chegada), montarEdicaoDeNegocio"
  - "app/(shell)/crm/negocios/[negocio]/page.tsx: a pagina religada a api (useNegocio) com recuo para DealScreen quando a api da 404 e o id existe em state.deals (D-15)"
  - "features/crm/negocios-do-registro.tsx: NegociosDoRegistro (secao Negocios das fichas de Contato e Empresa: GET /negocios?contatoId|empresaId, Novo Negocio com o dono preenchido, Toast com Abrir Negocio, revalidacao)"
  - "FichaDeContato e FichaDeEmpresa com a secao Negocios; create-record-dialog.tsx so com CREATE_PARAM, CrmFamily e useCreateRecordDialog (o CreateRecordDialog antigo saiu)"
affects: [07-12, 07-13]

actuals:
  tokens: 24200
  tasks: 2
  commits: 4
plan_head_before: 9934b5566e9e8ad21f21150803eba9cd29c92117
plan_head_after: b71e7550392d9da98755f7d2b62605add1c893c1
commits: 4

tech-stack:
  added: []
  patterns:
    - "Edicao por diferenca: o corpo do PATCH e so o que mudou em relacao ao registro (texto apagado vira null); nada mudou = 'Nada para salvar.' no botao; validarEdicao do dominio antes do envio"
    - "Troca de dono numa edicao so: { empresaId, contatoId: null } (ou o inverso) - o backend e a check negocios_dono_ck veem os dois campos juntos"
    - "Mudar de Funil e um painel na secao Etapa (Funil de destino + Etapa de destino); o botao carrega a frase de validarMovimento (RN-FUN-15) ate a Etapa ser escolhida; mover nao da Toast de sucesso (como no quadro)"
    - "Nome da Etapa numa lista de NegocioResumo: um componente por linha le useFunil(funilId) - a chave /funis/:id e uma so por Funil, o SWR busca uma vez por Funil, nao por linha"
    - "Secao de ficha que le da api e defensiva com o que o SWR guardou (Array.isArray(data.itens)): os testes das fichas antigas respondem a mesma coisa para toda URL e a secao nao pode quebrar a ficha"

key-files:
  created:
    - apps/web/src/features/crm/ficha-de-negocio.tsx
    - apps/web/src/features/crm/ficha-de-negocio.test.tsx
    - apps/web/src/features/crm/negocios-do-registro.tsx
    - apps/web/src/features/crm/negocios-do-registro.test.tsx
  modified:
    - "apps/web/src/app/(shell)/crm/negocios/[negocio]/page.tsx"
    - apps/web/src/features/crm/ficha-de-contato.tsx
    - apps/web/src/features/crm/ficha-de-empresa.tsx
    - apps/web/src/features/crm/create-record-dialog.tsx
    - .planning/WINDOWS.md

key-decisions:
  - "O PATCH da ficha leva so o que mudou (diferenca contra o Negocio, texto apagado vira null): editar o valor manda exatamente { valor: '2500.00' }, e 'Nada para salvar.' desliga o botao quando nada mudou"
  - "Trocar o dono e uma edicao com os dois campos ({ empresaId, contatoId: null } ou o inverso), validada por validarEdicao antes; um painel inline com Segmentos + SeletorDeRegistro, nao um dialogo"
  - "Mudar de Funil mora na secao Etapa: Funil de destino (so os ativos, menos o atual) + Etapa de destino obrigatoria, com a frase de validarMovimento (RN-FUN-15) no botao ate a Etapa ser escolhida; trocar a Etapa no Select e um POST /mover direto, sem Toast de sucesso"
  - "Ganho/perdido e arquivado nao mostram o Select de Etapa: a Etapa vira texto ('Ultima Etapa' no encerrado); arquivado/na lixeira esconde Editar, Trocar dono, Mudar de Funil e os botoes de encerramento (RN-NEG-16) - o cabecalho fica so com Restaurar/Excluir"
  - "Ao criar um Negocio pela ficha do dono a tela fica onde esta: Toast 'Negocio criado.' com a acao 'Abrir Negocio' e a lista revalida (lista.mutate alem da invalidacao da mutacao); o quadro continua navegando para a ficha"
  - "NegocioResumo nao traz o nome da Etapa: cada linha da secao le o Funil por useFunil (uma ida por Funil pelo SWR) e mostra '-' ate chegar"
  - "CRM-W1 e CRM-W2 nao foram marcados: 07-12 declara CRM-W1 e 07-13 declara os dois (requirements.ready-ids 0/2); marcam quando o ultimo plano declarante fechar"
  - "Commits em main por decisao do orquestrador (branching_strategy: none), como em 07-01..07-10"

patterns-established:
  - "Ficha de Negocio: Dados / Dono / Etapa / Encerramento como Sections de Painel, cada gesto numa rota propria; permissao por acao com um usePodeNoCrm por acao (editar, mover, ganhar, perder, reabrir com situacao)"
  - "Pagina de ficha pela api com recuo D-15: 404 verificado ANTES de data; recuo so se o id existe no DataState (state.deals); outro erro vira EmptyState com a frase da api"

requirements-completed: [CRM-W1, CRM-W2]

duration: 22 min
completed: 2026-10-10
status: complete

coverage:
  - id: D1
    description: "Ficha de Negocio lida de GET /negocios/:id: titulo, Pilula Aberto/Ganho/Perdido, 'Funil · Etapa', valor na moeda do Negocio, probabilidade efetiva (e 'ajustada' quando sobrescrita), Proprietario pelo nome, Empresa OU Contato com link de rota fixa + id"
    requirement: CRM-W2
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/ficha-de-negocio.test.tsx (casos a - 2 testes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Trocar a Etapa no Select chama POST /negocios/:id/mover com { etapaId }; Mudar de Funil exige a Etapa do Funil novo (frase de validarMovimento no botao, RN-FUN-15) e envia { funilId, etapaId }; recusa da api vira Toast e a Etapa fica como estava"
    requirement: CRM-W2
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/ficha-de-negocio.test.tsx (casos b - 3 testes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Editar envia PATCH so com o que mudou ('2.500,00' -> { valor: '2500.00' }); valor ilegivel e probabilidade fora de 0-100 travam no campo sem ir a api; trocar o dono de Contato para Empresa envia { empresaId, contatoId: null }"
    requirement: CRM-W2
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/ficha-de-negocio.test.tsx (casos c - 3 testes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Negocio ganho mostra motivo, nota e data do encerramento e 100%; Reabrir desligado para base membro com a frase de RN-NEG-10 e habilitado para Administrador (POST /reabrir + 'Negocio reaberto.'); Marcar como perdido abre o DialogoDeEncerramento com a Regra do Funil (D-05) e confirma por POST /perder"
    requirement: CRM-W2
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/ficha-de-negocio.test.tsx (casos d - 3 testes)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ciclo de vida (D-06) e RN-NEG-16: arquivado e so leitura (sem Editar, Trocar dono, Select de Etapa, Mudar de Funil nem encerramento; so Restaurar/Excluir), ativo arquiva e exclui para a Lixeira com confirmacao; a ficha nao tem Tags, Comentarios, Anexos, Requisitos nem Vinculos (D-02)"
    requirement: CRM-W2
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/ficha-de-negocio.test.tsx (casos e, f - 3 testes)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Recuo D-15 da pagina /crm/negocios/[negocio]: 404 com id do modelo antigo abre a DealScreen intacta; 404 sem registro antigo mostra 'Negocio nao encontrado.'; outro erro vira EmptyState com a frase da api"
    requirement: CRM-W2
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/ficha-de-negocio.test.tsx (recuo D-15 - 3 testes)"
        status: pass
      - kind: other
        ref: "grep -c FichaDeNegocio page.tsx = 3; grep -c DealScreen page.tsx = 4"
        status: pass
    human_judgment: false
  - id: D7
    description: "NegociosDoRegistro: GET /negocios?estado=ativo&contatoId=c1&limite=50 (ou empresaId), titulo com link /crm/negocios/:id, Pilula da situacao, Etapa pelo Funil, valor na moeda; vazio nomeado ('deste Contato' / 'desta Empresa'); Novo Negocio abre o DialogoNovoNegocio com o dono da ficha ja escolhido, POST /negocios leva contatoId|empresaId, a lista revalida e o Toast 'Negocio criado.' aparece; Convidado nao ve o botao (D-14)"
    requirement: CRM-W1
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/negocios-do-registro.test.tsx (casos a, b - 5 testes)"
        status: pass
    human_judgment: false
  - id: D8
    description: "FichaDeContato e FichaDeEmpresa renderizam a secao Negocios (GET /negocios?contatoId=c1 / ?empresaId=e1) com Novo Negocio; os testes de 07-06..07-10 continuam verdes no mesmo comando (177 testes em 17 arquivos)"
    requirement: CRM-W1
    verification:
      - kind: integration
        ref: "apps/web/src/features/crm/negocios-do-registro.test.tsx (casos c - 2 testes); npx vitest run src/features/crm src/dados/crm"
        status: pass
    human_judgment: false
  - id: D9
    description: "CreateRecordDialog (modelo antigo) removido de create-record-dialog.tsx; CREATE_PARAM, CrmFamily e useCreateRecordDialog mantidos e usados pelas tres listas"
    requirement: CRM-W1
    verification:
      - kind: other
        ref: "grep -c 'export function useCreateRecordDialog' = 1; grep -rn CreateRecordDialog apps/web/src so em comentarios; npm run typecheck, npm run lint (0 erros), npm run build (web) verdes"
        status: pass
    human_judgment: false
  - id: D10
    description: "Aparencia e uso real da ficha de Negocio (paineis, troca de Funil, dialogos de encerramento) e da secao Negocios nas fichas de Contato e Empresa em navegador"
    verification: []
    human_judgment: true
    rationale: "Nenhum next dev real nesta rodada: so teste de componente com fetch falso e build. Registrado em WINDOWS.md (#4); a verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)"
---

# Phase 07 Plan 11: Ficha de Negócio pela api e os Negócios nas fichas de Contato e Empresa Summary

**`/crm/negocios/[negocio]` passa a ler `GET /negocios/:id` e desenhar a ficha nova — edição por `PATCH` só do que mudou, Etapa e Funil por `POST …/mover` (trocar de Funil exige a Etapa do novo), Ganhar/Perder/Reabrir pelo `DialogoDeEncerramento` com as Regras do Funil, ciclo de vida no cabeçalho e arquivado só leitura — com recuo para a `DealScreen` para ids do modelo antigo; as fichas de Contato e de Empresa ganham a seção "Negócios" (`GET /negocios?contatoId|empresaId`) com "Novo Negócio" já com o dono preenchido; e o `CreateRecordDialog` antigo sai do código.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-10T23:07:18Z
- **Completed:** 2026-10-10T23:29:00Z
- **Tasks:** 2 (as duas `tdd="true"`: RED → GREEN, sem REFACTOR)
- **Files modified:** 9 (4 criados, 4 reescritos/editados, `WINDOWS.md`)

## Accomplishments

- `FichaDeNegocio`: `PageHeader` com título, `Pilula` da situação (`--cor-neg-*`), `StateSeal`, meta "Funil · Etapa" e `AcoesDeCicloDeVida`; seção **Dados** (valor na moeda, probabilidade efetiva por `probabilidadeEfetiva` com a `Pilula` "ajustada" quando sobrescrita, data prevista, origem, Proprietário) com "Editar Negócio" que monta o `PATCH` por diferença (`montarEdicaoDeNegocio`, `validarEdicao` antes; "Nada para salvar." quando nada mudou); **Dono** (Empresa OU Contato com link; "Trocar dono" por `Segmentos` + `SeletorDeRegistro`, mandando o outro como `null`); **Etapa** (`Select` → `POST …/mover` com `validarMovimento` antes; "Mudar de Funil" com Funil de destino ativo + Etapa obrigatória, a frase de RN-FUN-15 no botão até a Etapa ser escolhida); **Encerramento** (aberto: Marcar como ganho/perdido; encerrado: motivo, nota, `encerradoEm` e Reabrir — ganho desligado para quem não administra, RN-NEG-10). Arquivado ou na lixeira: tudo só leitura e o cabeçalho só restaura/exclui (RN-NEG-16). O Toast "Negócio criado." de quem cria pelo quadro é lido por `lerChegada` ao chegar.
- A página `[negocio]` religada: `use(params)` + `useNegocio`; 404 da api com o id em `state.deals` → `DealScreen` intacta (D-15; a Lista conversacional segue usando a `DealScreen` embutida); 404 sem registro antigo → "Negócio não encontrado."; outro erro → `EmptyState` com a frase da api.
- `NegociosDoRegistro`: `useNegocios({ contatoId | empresaId, estado: "ativo", limite: 50 })`, linhas com título (link), `Pilula` da situação, "Etapa:"/"Última Etapa:" (nome lido por `useFunil` por linha, uma ida por Funil) e valor; vazio "Nenhum Negócio deste Contato." / "desta Empresa."; "Mostrando 50 de N" acima do limite; "Novo Negócio" (escondido quando `usePodeNoCrm("criar", "negocio")` recusa) abre o `DialogoNovoNegocio` com `valorInicial.contato|empresa`, e ao criar mostra "Negócio criado." com "Abrir Negócio" e revalida a lista.
- `FichaDeContato` (depois de "Empresas") e `FichaDeEmpresa` (depois de "Matriz e filiais") com a seção; os cabeçalhos deixam de dizer que a seção "chega no 07-11".
- `create-record-dialog.tsx` fica só com `CREATE_PARAM`, `CrmFamily` e `useCreateRecordDialog` (`?criar=<família>`): o `CreateRecordDialog` do modelo antigo (store em memória, `createContact`/`createCompany`/`createDeal`) saiu — `grep -rn "CreateRecordDialog" apps/web/src` só achava a própria definição e comentários.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: Ficha nova de Negócio, com a tela antiga como recuo** — RED `a27c92d` (test) — GREEN `47150ed` (feat)
2. **Task 2: Negócios nas fichas de Contato e Empresa, e a saída do diálogo de criação antigo** — RED `2dba106` (test) — GREEN `b71e755` (feat)

**Plan metadata:** commit de docs ao final (SUMMARY, STATE, ROADMAP, WINDOWS).

Sem commit de REFACTOR: nada a limpar depois do GREEN em nenhuma das duas tarefas (o esqueleto do RED da Task 2 foi substituído no próprio GREEN).

## Files Created/Modified

- `apps/web/src/features/crm/ficha-de-negocio.tsx` — `FichaDeNegocio`, `montarEdicaoDeNegocio`, as seções Dados/Dono/Etapa/Encerramento.
- `apps/web/src/features/crm/ficha-de-negocio.test.tsx` — casos (a)–(f) da Task 1 e o recuo D-15 da página (17 testes).
- `apps/web/src/app/(shell)/crm/negocios/[negocio]/page.tsx` — a página religada à api com recuo para `DealScreen`.
- `apps/web/src/features/crm/negocios-do-registro.tsx` — `NegociosDoRegistro`, `NEGOCIOS_DO_REGISTRO`.
- `apps/web/src/features/crm/negocios-do-registro.test.tsx` — casos (a)–(c) da Task 2 (7 testes).
- `apps/web/src/features/crm/ficha-de-contato.tsx`, `apps/web/src/features/crm/ficha-de-empresa.tsx` — a seção "Negócios" e o comentário de cabeçalho.
- `apps/web/src/features/crm/create-record-dialog.tsx` — sem o `CreateRecordDialog`; cabeçalho reescrito.
- `.planning/WINDOWS.md` — janela `unrun-verify` #4 (ficha de Negócio e seção Negócios não exercitadas em navegador real).

## Decisions Made

As de `key-decisions` no cabeçalho. As que mais pesam: (1) o `PATCH` leva só a diferença — a api recebe exatamente o que a pessoa mudou, e o teste (c) prova `{ valor: "2500.00" }` sem mais nada; (2) trocar de Funil é um painel da seção Etapa, não um diálogo, e o botão carrega a frase do domínio (RN-FUN-15) até a Etapa do Funil novo existir — a mesma `validarMovimento` que o serviço aplica; (3) criar pela ficha do dono não navega: quem está na ficha de um Contato quer ver o Negócio na lista dele, e o Toast oferece "Abrir Negócio" para quem quer ir.

## Deviations from Plan

None - plan executed exactly as written.

### Registros (não são correções de código)

1. **Evidência de RED.** Task 1: alvo "(a) mostra título, Aberto, Funil e Etapa…" (o prefixo "(a) " fica fora do `-t`, que é regex), isolado com `--reporter=tap-flat`, falhando em `expected 'Negócio não encontrado.…' to contain 'Vendas · '` — a rota ainda montava a `DealScreen` antiga; classificador `RED_EVIDENCE_OK` (`target_test_failed`, 17 testes, 1 falha, os demais SKIP). Na rodada completa do RED, 16 dos 17 falhavam; o único que passava era "404 com id do modelo antigo abre a DealScreen" — comportamento que a página antiga já tinha. Task 2: alvo "(a) busca GET /negocios?contatoId=c1…" (`-t 'busca GET'`, sem o `?` que é metacaractere), com um esqueleto de `NegociosDoRegistro` que só renderiza "pendente" para o import resolver (como em 07-10), falhando em `expected 'pendente' to contain 'Proposta Alfa'`; `RED_EVIDENCE_OK` (7 testes, 1 falha, 6 SKIP); 7/7 falhavam na rodada completa. Os registros ficaram em `.planning/red-tmp/` (dentro do projeto, como o classificador exige) e foram apagados antes de cada commit; o `red.sh` usado mora no scratchpad do orquestrador, em `07-11/`.
2. **Testes das fichas antigas.** `ficha-de-contato.test.tsx` responde o mesmo `{ ok, dados }` para toda URL, então `GET /negocios?…` recebe um objeto sem `itens`; `NegociosDoRegistro` confere `Array.isArray(data.itens)` e mostra o vazio. Os 177 testes de `src/features/crm src/dados/crm` passaram sem mudar nenhum teste anterior.
3. **Requisitos.** `CRM-W1` e `CRM-W2` não foram marcados: `requirements.ready-ids` devolveu 0/2 (07-12 declara `CRM-W1`, 07-13 declara os dois). Marcam quando o último plano declarante fechar.
4. **Guarda de branch protegida.** Como em 07-01..07-10, os commits foram feitos em `main` por decisão do orquestrador (`branching_strategy: none`).
5. **Verificação além do plano:** `npm run build` (web) passou após o GREEN da Task 2 (`/crm/negocios/[negocio]` compilada como rota dinâmica); a suíte inteira de `apps/api` não foi rodada (`lote-contas-a-pagar.test.ts` falha fora do escopo, como registrado em 07-09/07-10).

## Issues Encountered

None. As duas tarefas passaram no primeiro GREEN; `tsc`, `eslint` (0 erros, 3 avisos pré-existentes fora de `features/crm`), `verificar:tokens` (0 falhas) e o build verdes.

## Known Gaps

- **"Mostrando 50 de N"** na seção Negócios da ficha só aparece acima de 50 Negócios do registro; nenhum teste exercita o caso — é uma linha condicional sobre `total > itens.length`.
- **Toast de chegada** ("Negócio criado." vindo do quadro por `marcarChegada`) é lido por `lerChegada(pathname)` na montagem da ficha; o teste não o cobre porque `lerDuracao` lê CSS que o jsdom não tem.
- **Trocar o dono de Empresa para Contato** segue o mesmo caminho do caso testado (Contato → Empresa), com `{ contatoId, empresaId: null }`.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: as telas ficam dentro do limite "resposta da api → DOM" do threat model do plano. T-07-34 (XSS) está coberto por renderização só como texto React e links de rota fixa + id, sem `dangerouslySetInnerHTML` (verificado por leitura nos dois arquivos novos); T-07-35 (recuo) só abre a `DealScreen` quando o id existe em `state.deals` que a sessão já recebeu por `GET /estado`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Todas as telas do CRM (Contatos, Empresas, Funis, Negócios — listas, fichas, formulários, quadro, lixeira) leem e gravam pela api; o modelo antigo só aparece como recuo para ids antigos (`FichaDeContatoLegado`, `FichaDeEmpresaLegado`, `DealScreen`).
- 07-12 (migrar `--seco`, e2e, docs do `CONTEXT.md`) encontra a ficha de Negócio em `features/crm/ficha-de-negocio.tsx` e a seção em `negocios-do-registro.tsx`; `DealScreen` continua intacta para a Lista conversacional.
- Verificação visual da ficha de Negócio e da seção Negócios fica para o fim da fase — janela `unrun-verify` #4 em `WINDOWS.md`.
- Sem bloqueios.

---
*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Completed: 2026-10-10*

## Self-Check: PASSED

- Os 5 arquivos de codigo listados existem no disco.
- Os 4 commits de tarefa (`a27c92d`, `47150ed`, `2dba106`, `b71e755`) sao ancestrais de HEAD; `commits: 4` medido por `git rev-list --count 9934b55..HEAD`.
- Criterios de aceitacao reexecutados: casos (a)-(f) + recuo D-15 (17 testes) e (a)-(c) (7 testes) verdes; 177 testes em `src/dados/crm src/features/crm`; `FichaDeNegocio` (3) e `DealScreen` (4) na page; `NegociosDoRegistro` nas duas fichas (3 cada); `useCreateRecordDialog` (1); `npm run typecheck`, `npm run lint` (0 erros, 3 avisos pre-existentes), `npm run verificar:tokens` (0 falhas) e `npm run build` (web) verdes.
