---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 11
subsystem: crm
tags: [caixa-de-entrada, conversas, estrela, janela-de-resposta, grupo, tdd, ucr-05]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-06: useConversas, marcarConversa, AvatarDoContato, filtro naoLidas e as guardas sem-crm-antigo"
provides:
  - "ConversaNaLista.ultimaRecebidaEm (a recebida mais recente, na mesma consulta da lista)"
  - "InboxColumns: lista, contadores e estrela pelo CRM novo (GET /conversas, PUT /conversas/:id/marcacao)"
  - "filtroDoEscopo, recorteNoCliente, useRecorte, foraDaJanela e ehConversaDeGrupo exportados de inbox-columns.tsx"
  - "contagem do topo da Caixa (page.tsx) pelo total da api mais os Grupos"
affects: [15-24, 15-20, 15-33]

plan_head_before: 86ec7b5d4d85dddd35892a062d0ddd63e7069dcb
plan_head_after: bcc2bfe2cef218dbb9e4d855f9f23f519ae538e5

actuals:
  tokens: 20400
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "estrela otimista com fila de gravacao por Conversa: cada clique parte do valor que o anterior deixou, a recusa desfaz o que a tela mostrava"
    - "recorte no cliente sobre a pagina inteira (200) para o que a api ainda nao filtra, com o total do recorte e nao do Espaco"
    - "um view-model unico (ItemDaCaixa) junta a Conversa das tabelas e a de Grupo do estado antigo numa so lista"

key-files:
  created:
    - apps/api/src/servicos/crm/conversas-lista.test.ts
  modified:
    - packages/dominio/src/crm/conversas.ts
    - apps/api/src/repositorios/crm/conversas.ts
    - apps/web/src/features/crm/inbox-columns.tsx
    - apps/web/src/features/crm/inbox-columns.test.tsx
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/page.tsx
    - apps/web/src/sem-crm-antigo.test.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/CONTEXT.md
    - apps/web/CONTEXT.md

key-decisions:
  - "ultimaRecebidaEm entra so em listar: obter devolve Conversa (nao ConversaNaLista) e e usado em escrita com for update; o campo nao pertence a ele"
  - "Sem Atribuido, Sem Fila e Adiadas sao recortadas na tela sobre a pagina de 200, porque a api nao tem esses filtros (a lista de filtros do plano nao os cobre)"
  - "a estrela da Conversa de Grupo segue pela operacao antiga: o Grupo nao tem linha em plataforma.conversas e um PUT daria 404"
  - "inbox-columns.tsx saiu de CONGELADOS da guarda da web, provado por grep (0 leituras de contacts/channels)"

requirements-completed: []

coverage:
  - deliverable: "ConversaNaLista.ultimaRecebidaEm vem do banco na mesma consulta da lista"
    verification:
      - { kind: test, ref: "apps/api/src/servicos/crm/conversas-lista.test.ts#e o criadoEm da recebida MAIS RECENTE", status: pass }
      - { kind: test, ref: "apps/api/src/servicos/crm/conversas-lista.test.ts#a recebida de outra Conversa nao vaza para o item", status: pass }
    human_judgment: false
  - deliverable: "a lista da Caixa le useConversas e useCanais, com a janela de resposta por capacidadesDoCanal"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/inbox-columns.test.tsx#(1) a (13), (20)", status: pass }
    human_judgment: false
  - deliverable: "a estrela grava por PUT /conversas/:id/marcacao, sem /operacoes, com dois cliques seguidos certos e recusa desfeita"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/inbox-columns.test.tsx#(14), (15), (16)", status: pass }
    human_judgment: false
  - deliverable: "a Conversa de Grupo continua na lista e na contagem do topo (F14-D-05)"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/inbox-columns.test.tsx#(17), (18), (19), (22)", status: pass }
    human_judgment: false
  - deliverable: "a contagem do topo e os contadores das abas vem do total da api"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/inbox-columns.test.tsx#(13), (21)", status: pass }
    human_judgment: false
  - deliverable: "a lista da Caixa fica visualmente igual a anterior (selo do Canal, avatar, pilula de nao lidas, marcadores)"
    verification: []
    human_judgment: true
    rationale: "Os testes provam conteudo e comportamento; que o desenho continue o mesmo na tela e juizo visual (fim da fase, human_verify_mode = end-of-phase)."
---

# Phase 15 Plan 11: Lista da Caixa de Entrada pelo CRM novo Summary

**A lista da Caixa de Entrada, os contadores das abas, o topo da página e a estrela leem e gravam só `plataforma.conversas` (`GET /conversas`, `PUT /conversas/:id/marcacao`), com a janela de resposta calculada de `ultimaRecebidaEm` que a própria lista traz, e a Conversa de Grupo do estado antigo continua visível.**

## Performance

- **Tasks:** 2 (1 tracer, 1 auto), as duas `tdd="true"`
- **Files:** 1 criado, 9 modificados
- **Commits:** 5 (2 RED, 2 GREEN, 1 docs), medidos de `plan_head_before`
- **Duração:** cerca de 15 min

## Accomplishments

- **Traçador (Task 1):** `ConversaNaLista.ultimaRecebidaEm: string | null` no domínio; na api, um subselect `max(m.criado_em)` das `recebida` na consulta de `listar`. `conversas-lista.test.ts` (banco local) prova que é a recebida mais recente mesmo com uma enviada depois dela, `null` sem recebida, e que a recebida de outra Conversa não vaza. Na web, a coluna "Minhas" passou a ler `useConversas({ atribuidoId })`, o Canal de `useCanais` e o rosto de `AvatarDoContato`.
- **Demais colunas (Task 2):** todo escopo, aba, estado, Canal e Fila viram filtro da api (`atribuidoId`, `naoLidas`, `comEstrela`, `situacao`, `canalId`, `filaId`). Os contadores das abas são o `total` de duas consultas de uma linha; "Selecionar tudo · N de M" usa o `total` da api, não o tamanho da página.
- **Estrela:** `marcarConversa(id, { estrela })`, uma gravação por vez por Conversa (fila de promessas em `useRef`) e cada clique parte do valor que o anterior mostrou. A recusa da api desfaz a marcação exibida; o cache só é invalidado no sucesso (já era assim em `marcarConversa`). Nada vai para `/operacoes/`.
- **Grupo (F14-D-05):** as Conversas de `state.conversations` com `groupIdentifier` entram na mesma lista (mesmas regras de escopo, estado, Canal, Fila e aba), na contagem das abas e na do topo. A estrela delas segue pela operação antiga.
- **Topo (`page.tsx`):** "aguardando resposta" = total da api das `aberta` + `pendente` (escopo aplicado) + Grupos não resolvidos; enquanto carrega, mostra só o título do escopo em vez de "nenhuma".
- **Guarda:** `features/crm/inbox-columns.tsx` saiu de `CONGELADOS` em `apps/web/src/sem-crm-antigo.test.ts`; `grep -cE "\b(state|data|s)\.(contacts|channels)\b"` nos dois arquivos da Caixa = 0.

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (traçador) | `842c7e2` | `3c28d04` |
| 2 | `0c6b45a` | `bdf0f7c` (+ docs `bcc2bfe`) |

Avaliação do RED: na Task 1, `conversas-lista.test.ts` falhou na asserção (`expected undefined to be null`; o campo não existia) e os 3 casos novos da web falharam por não encontrar o item (a lista ainda vinha de `state.conversations`). Na Task 2, 14 dos 22 casos falharam em asserções reais (item ausente, `PUT` nunca enviado, texto do topo diferente); os que já passavam são regressões do que existia (o atalho de Configurações, o Canal não oficial sem janela, o texto como texto, a estrela do Grupo). O primeiro RED da Task 2 mostrou um erro do próprio teste (`method: "GET"` explícito em `chamarCrm` e o `mutate` global de SWR que não alcança o cache isolado do teste); corrigi o teste antes do GREEN e o RED continuou falhando pelos motivos certos. Sem REFACTOR separado.

## Verificação

Tudo contra Postgres 16 local em Docker (`crm-n1-pg-1511`, porta 55711, migrações 001 a 012 aplicadas), com as duas URLs explícitas; o contêiner foi parado no fim.

- `apps/api`: `conversas-lista.test.ts` 2/2 (não pulado); `servicos/crm/conversas.test.ts`, `rotas/crm/conversas.test.ts`, `src/repositorios` e a lista: 118/118; `tsc --noEmit` limpo.
- `packages/dominio`: `tsc --noEmit` limpo.
- `apps/web`: suíte inteira 1098/1098 (114 arquivos), `inbox-columns.test.tsx` 22/22, guarda `sem-crm-antigo` 2/2; `tsc --noEmit` limpo; `eslint` sem achados em `features/crm` e na pasta da Caixa; `verificar:tokens` 0 falhas.
- Critérios de aceitação: `ultimaRecebidaEm` no domínio (1) e na api (1); `useConversas` em `inbox-columns.tsx` (5); `marcarConversa` (2); leituras de `contacts|channels` nos dois arquivos da Caixa = 0.
- Não rodei `npm test` nem `npm run check` inteiros (regra do projeto).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A estrela precisava de fila e de estado otimista para o caso "clicar duas vezes seguidas"**
- **Found during:** Task 2
- **Issue:** sem isso o 2º clique lia a lista velha e mandava o mesmo valor do 1º; duas gravações em paralelo também podem chegar fora de ordem ao servidor.
- **Fix:** estado `marcadas` (valor mostrado enquanto grava) e `filaDeGravacao` por Conversa; o clique seguinte parte do valor otimista e só sai depois da gravação anterior; a recusa limpa o valor otimista.
- **Files modified:** `apps/web/src/features/crm/inbox-columns.tsx`
- **Commit:** `bdf0f7c`

**2. [Rule 1 - Plano diverge do contrato] `ultimaRecebidaEm` só em `listar`, não em `obter`**
- O plano pede o subselect em `listar` e `obter`, mas `obter` devolve `Conversa` (usado em escrita, com `for update`), não `ConversaNaLista`; o campo não pertence a esse tipo. Ficou só em `listar`.

**3. [Visível, aberto em WINDOWS.md] Sem Atribuído, Sem Fila e Adiadas são recortadas na tela**
- O plano lista os filtros da api e não cobre esses três escopos (a coluna "Sem Atribuído" precisa de `atribuido is null`). Em vez de abrir três filtros novos na api fora da lista de arquivos do plano, a tela pede a página inteira (200) e recorta; o total e o "Mostrar mais" desses recortes valem para a página, não para o Espaço. Linha `deviation` aberta em `.planning/WINDOWS.md` (id 18).

**4. [Visível, aberto em WINDOWS.md] A linha da Conversa não mostra mais a prévia da última Mensagem**
- `ConversaNaLista` não traz o texto da última Mensagem; a segunda linha mostra o título quando ele difere do nome do Contato e some quando é igual. Se o dono quiser a prévia de volta, o caminho é somar a última Mensagem ao subselect de `ultimaRecebidaEm`. Linha `deviation` aberta (id 19).

**5. [Escolha do executor] "Carregar mais"**
- O plano diz "por `deslocamento`"; a tela aumenta o `limite` (50, 100, até 200) com "Mostrar mais". Mesma intenção, sem acumular páginas no cliente; para em `LIMITES_CRM.paginaMaxima`.

**6. Arquivos fora da lista `files_modified`**
- `apps/web/src/sem-crm-antigo.test.ts` (uma linha a menos em `CONGELADOS`), os três `CONTEXT.md` (domínio, rotas da api, web) e `.planning/WINDOWS.md`. Nenhum código de produção fora do plano.

**Total deviations:** 1 auto-fixed (Rule 2), 1 contra o contrato do plano (Rule 1), 2 visíveis abertas em WINDOWS.md, 2 escolhas. **Impact:** a Caixa funciona toda pelo CRM novo; os dois itens abertos são limites de página e de prévia, não perda de dado.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: T-15-31 (a lista vem só de `GET /conversas`, que filtra pelo Espaço da sessão; a web não monta filtro de Espaço) e T-15-32 (`contatoNome` e título como texto React; o caso 8 prova que `<img onerror>` vira texto) mitigados como o plano pedia.

## Observações para os planos seguintes

1. `requirements.ready-ids` respondeu 0/1 para UCR-05 (outros planos da fase declaram o requisito e ainda não têm SUMMARY): não marquei `UCR-05` como concluído.
2. O fio e a página da Conversa (`[conversa]/page.tsx`) seguem no modelo antigo: 15-24 (cabeçalho, gestos, coluna do Contato) e 15-20 (fio). Ela ainda usa `InboxColumns`, que não mudou de interface.
3. O Canal do Grupo vem de `useCanais`; um Canal que só exista em `plataforma.registros` (popup legado das Listas) não aparece como selo na linha do Grupo.

## Self-Check: PASSED

Arquivos criados e modificados presentes em disco; os cinco commits da tarefa (`842c7e2`, `3c28d04`, `0c6b45a`, `bdf0f7c`, `bcc2bfe`) são ancestrais de `HEAD`.
