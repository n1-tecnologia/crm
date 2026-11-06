---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 14
subsystem: crm
tags: [notificacoes, busca, lixeira, selo, swr, tdd, ucr-07]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-06: hooks dados/crm/conversas (useConversas, restaurarConversa) e a guarda sem-crm-antigo com CONGELADOS; 15-13: fichas sem recuo"
provides:
  - "notificacoesDoMembro(state, membro, agora, conversasAtribuidas): as Conversas atribuidas vem por argumento ({ itens, total }); nada le state.conversations; NotificacoesDoMembro.conversasTotal"
  - "useNotificacoesDoMembro (features/shell/use-notificacoes.ts): duas consultas GET /conversas (aberta, pendente) do Membro da sessao, o total da api entra no selo; usado pelo painel do trilho, pela barra global, por /notificacoes e pelo panorama do robo"
  - "Busca (/buscar) de Contatos, Empresas, Negocios e Conversas por GET /<recurso>?q= (2+ caracteres, limite 10), arquivados e lixeira so com a opcao marcada"
  - "Lixeira (/configuracoes/lixeira) lista estado=na_lixeira das quatro rotas e restaura por POST /<recurso>/:id/restaurar"
affects: [15-18, 15-23, 15-33, 15-43]

plan_head_before: 75a10bce1d31183eef936ec96191f7792ffb5933
plan_head_after: bd8889b9496b6d3670539dea25ef15de9a5ffbee

actuals:
  tokens: 24164
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "hook de derivacao que junta store e api: o derivado puro do dominio recebe a parte do CRM por argumento (itens + total), e o hook a monta"
    - "useContatos/useEmpresas/useConversas aceitam { pausado } como useNegocios, para consulta opcional (arquivados e lixeira na Busca)"
    - "restauracao por rota com guarda de reentrada (ref + Button carregando): o segundo clique espera a resposta; a recusa da api vai ao aviso e nao invalida a lista"

key-files:
  created:
    - apps/web/src/features/shell/use-notificacoes.ts
    - apps/web/src/features/shell/use-notificacoes.test.tsx
    - apps/web/src/features/shell/busca-e-lixeira-do-crm.test.tsx
  modified:
    - packages/dominio/src/derive.ts
    - packages/dominio/src/operations/operations.test.ts
    - packages/dominio/src/operations/mencao-na-descricao.test.ts
    - packages/dominio/src/operations/tags-e-observadores.test.ts
    - packages/dominio/CONTEXT.md
    - apps/web/src/features/shell/app-shell.tsx
    - apps/web/src/features/shell/barra-global.tsx
    - apps/web/src/features/inicio/panorama-do-robo.ts
    - apps/web/src/app/(shell)/notificacoes/page.tsx
    - apps/web/src/app/(shell)/notificacoes/notificacoes.test.tsx
    - apps/web/src/app/(shell)/buscar/page.tsx
    - apps/web/src/app/(shell)/configuracoes/lixeira/page.tsx
    - apps/web/src/dados/crm/contatos.ts
    - apps/web/src/dados/crm/empresas.ts
    - apps/web/src/dados/crm/conversas.ts
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md

key-decisions:
  - "O selo soma o total de GET /conversas por situacao (aberta + pendente), nao o tamanho da pagina de 20; sem resposta da api nenhuma Conversa entra (o selo nao inventa numero)"
  - "NotificacoesDoMembro ganha conversasTotal alem de conversas (a pagina listada): a secao de Notificacoes e o robo mostram o total, a lista mostra ate 20"
  - "Busca e Lixeira nao tem 'atualizadoEm' real de envio a lixeira para Contato, Empresa e Negocio: 'Enviado em' e a contagem usam atualizadoEm (registro parado na lixeira); Conversa usa naLixeiraEm"
  - "Empresa restaurada da lixeira exige admin: a Lixeira chama restaurarEmpresa(id) sem corpo e, na recusa EMPRESA_SEM_ADMIN, manda abrir a ficha (onde o dialogo de admin ja existe)"

requirements-completed: [UCR-07]

coverage:
  - deliverable: "Selo global, painel do trilho, /notificacoes e panorama contam as Conversas atribuidas pelo total da api"
    verification:
      - { kind: test, ref: "packages/dominio/src/operations/operations.test.ts#15-14: as Conversas atribuidas vem do argumento / o total da api conta, nao a pagina / Conversas do modelo antigo nao entram", status: pass }
      - { kind: test, ref: "apps/web/src/features/shell/use-notificacoes.test.tsx", status: pass }
      - { kind: test, ref: "apps/web/src/app/(shell)/notificacoes/notificacoes.test.tsx#Conversas atribuidas a voce (15-14)", status: pass }
    human_judgment: false
  - deliverable: "Busca de Contatos, Empresas, Negocios e Conversas por ?q= (2+ caracteres), com Contato novo achado pelo nome"
    verification:
      - { kind: test, ref: "apps/web/src/features/shell/busca-e-lixeira-do-crm.test.tsx#Busca", status: pass }
    human_judgment: false
  - deliverable: "Lixeira lista e restaura Contato, Empresa, Negocio e Conversa pelas rotas; segunda restauracao e dois cliques tratados"
    verification:
      - { kind: test, ref: "apps/web/src/features/shell/busca-e-lixeira-do-crm.test.tsx#Lixeira", status: pass }
    human_judgment: false
  - deliverable: "Aparencia e leitura das telas (secao de Conversas em Notificacoes, selos 'na lixeira' na Busca, aviso de recusa)"
    verification: []
    human_judgment: true
    rationale: "Os testes conferem texto, links e chamadas; que o resultado fique legivel no navegador real e juizo visual e fica para a conferencia de fim de fase."
---

# Phase 15 Plan 14: Busca, Lixeira e Notificações (selo global) no modelo novo Summary

**O selo global, a página de Notificações, a Busca e a Lixeira deixaram de ler Contatos, Empresas, Negócios e Conversas do store: `notificacoesDoMembro` recebe as Conversas atribuídas por argumento (o `total` da api conta), o hook `useNotificacoesDoMembro` o alimenta nos quatro lugares, e Busca e Lixeira falam com as rotas REST.**

## Performance

- **Duração:** cerca de 18 min (início por volta de 08:32, fim 08:50, horário local)
- **Tasks:** 3 (1 traçador, 2 auto), todas `tdd="true"`
- **Arquivos:** 3 criados, 17 modificados
- **Commits:** 7 (3 RED + 3 GREEN + 1 de documentação), medidos de `plan_head_before`

## Accomplishments

- **Traçador (selo e Notificações):** `notificacoesDoMembro(state, membro, agora, conversasAtribuidas)` não lê mais `state.conversations`; `NotificacoesDoMembro.conversas` virou `readonly ConversaNaLista[]` e ganhou `conversasTotal`; o `total` geral soma o `total` da api. `useNotificacoesDoMembro` (novo) faz duas consultas `GET /conversas?atribuidoId=<Membro>&situacao=aberta|pendente&limite=20`, soma os `total`, junta as páginas por `atualizadoEm` e devolve também `carregando`. O painel do trilho (`app-shell`), a barra global, `/notificacoes` e o hook do panorama do robô (`montarPanorama` recebe as notificações prontas) usam o mesmo hook. A seção "Conversas atribuídas a você" lista por `contatoNome` e título, leva a `/crm/caixa-de-entrada/<id>` e diz "Mostrando N de M" quando a página não cobre o total.
- **Busca:** `useBuscaNoCrm` consulta `/contatos`, `/empresas`, `/negocios` e `/conversas` com `q` (termo aparado), `limite: 10` e só com 2+ caracteres; o número do grupo é a soma dos `total`. "Incluir arquivados e na lixeira" liga uma consulta por estado (`arquivado`, `na_lixeira`; Conversa só tem `na_lixeira`) e desligada não vai à rede. Recusa da api aparece num aviso de erro; enquanto carrega, "Buscando…" em vez de "Nada encontrado". Cada item leva à ficha nova ou à Conversa.
- **Lixeira:** quatro `use*` com `estado: "na_lixeira"` e `limite: 200`; restaurar por `restaurarContato`/`restaurarEmpresa`/`restaurarNegocio`/`restaurarConversa`. O botão usa `carregando` e uma `ref` impede a segunda gravação enquanto a primeira não respondeu. Recusa da api (segunda restauração, Empresa sem admin) vai ao aviso e a lista não é relida (a invalidação só roda no sucesso). Tarefas, Espaços, Pastas, Listas, Agentes e Automações seguem do store e das operações de hoje.
- **Guarda:** `buscar/page.tsx`, `notificacoes/page.tsx` e `configuracoes/lixeira/page.tsx` saíram de `CONGELADOS` da web (prova por grep com o regex da guarda: 0 acertos nos três; a guarda segue verde).
- **Dados:** `useContatos`, `useEmpresas` e `useConversas` ganharam `{ pausado }` (como `useNegocios` já tinha), para a consulta opcional da Busca.

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (traçador) | `fce8a7c` | `909dad4` |
| 2 (Busca) | `e7251d0` | `20e8ce4` |
| 3 (Lixeira) | `a8a29c9` | `57a7395` |

Avaliação semântica do RED:

- **Tarefa 1, domínio:** três casos novos/alterados falharam pela asserção planejada (o resultado ainda trazia as Conversas antigas do seed em `conversas` e o `total` ignorava o argumento). **Web:** o módulo `use-notificacoes.ts` não existia; o commit RED leva um esqueleto que lança "não implementado", então os quatro casos executam e falham por ausência da implementação (e não só por import quebrado), a mesma convenção do 15-06.
- **Tarefa 2:** seis dos sete casos falharam porque a página nunca chamava `fetch` (`expected 0 to be greater than 0` e textos da api ausentes); o sétimo (menos de 2 caracteres) já passava e é regressão protegida.
- **Tarefa 3:** oito dos dezesseis casos do arquivo falharam (a Lixeira não consultava a api); o caso "o que não é do CRM segue do store" já passava e é regressão protegida. Plano `type: execute`, então não rodei `check tdd-red-evidence`. Sem REFACTOR separado.

## Verificação

Tudo em jsdom/vitest, sem banco: nenhum Postgres foi necessário e nenhum contêiner foi criado.

- `packages/dominio`: `operations.test.ts`, `mencao-na-descricao.test.ts` e `tags-e-observadores.test.ts` 251/251; suíte inteira 2381/2381; `tsc --noEmit` limpo.
- `apps/web`: suíte inteira 119 arquivos, 1140 testes, todos verdes; os `<automated>` das três tarefas (`use-notificacoes`, `busca-e-lixeira-do-crm`, `sem-crm-antigo`); `tsc --noEmit` limpo; `eslint` nos arquivos tocados sem erros (um aviso de `Target` não usado em `app-shell.tsx`, que já existia antes do plano); `verificar-tokens.mjs` 0 falhas. `apps/api` não foi tocado (`tsc` limpo).
- Critérios de aceitação: `grep -c state.conversations` nas 12 linhas de `notificacoesDoMembro` = 0; os quatro arquivos usam `useNotificacoesDoMembro` (4 de 4); `grep` do regex `(state|data|s).(contacts|companies|deals|conversations)` em `buscar/page.tsx` = 0; `restoreContact|restoreConversation|restoreCompany|restoreDeal` em `lixeira/page.tsx` = 0 e `restaurarConversa` = 2.
- Não rodei `npm test` nem `npm run check` inteiros (regra do projeto).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `useContatos`, `useEmpresas` e `useConversas` precisaram de `{ pausado }`**
- **Found during:** Task 2
- **Issue:** a Busca só pode consultar arquivados e lixeira quando a opção está marcada, e o termo só vale com 2+ caracteres; só `useNegocios` aceitava consulta desligada.
- **Fix:** o mesmo parâmetro opcional (`opcoes.pausado ? null : chave` no SWR) nos outros três hooks. Sem mudança para quem não passa.
- **Files modified:** `apps/web/src/dados/crm/{contatos,empresas,conversas}.ts` (fora de `files_modified`)
- **Commit:** `20e8ce4`

**2. [Rule 2 - Missing] Aviso de recusa e estado "carregando" na Busca e na Lixeira**
- **Found during:** Tasks 2 e 3
- **Issue:** sem isso, uma recusa 403 da api ou o carregamento pareciam "Nada encontrado" / "A lixeira está vazia", o que esconde a falha. A Lixeira também precisa dizer quando passa do teto da página (200 por tipo).
- **Fix:** `Toast` de erro com a mensagem da api, "Buscando…" / "Lendo a lixeira…" e uma nota "Há mais N registro(s)…" quando o `total` passa da página.
- **Commits:** `20e8ce4`, `57a7395`

**3. Arquivos fora da lista `files_modified`**
- `notificacoes.test.tsx` (agora com `fetch` e sessão falsos, mais dois casos da seção de Conversas), `sem-crm-antigo.test.ts` (três arquivos saíram de `CONGELADOS`), `apps/web/CONTEXT.md` e `packages/dominio/CONTEXT.md` (a regra mudou). Só testes e documentação.

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 2) mais arquivos fora da lista; 0 arquiteturais.

### Comportamento visível que muda (registrado em `.planning/WINDOWS.md`, fase 15, `deviation`, abertas)

1. **Busca de Conversa só pelo título.** O modelo antigo também olhava o texto das Mensagens; `GET /conversas?q=` não. Abrir o filtro na api se o dono quiser a busca por conteúdo.
2. **Panorama do robô do Início** ainda conta "Conversas abertas do Espaço", Contatos e Negócios de `state.conversations/contacts/deals`; só as Conversas atribuídas à pessoa e o selo vêm da api. Fica para o plano do Início (15-18/15-23, que também citam `panorama-do-robo`).
3. A linha 22 (15-13: links para ids antigos em Busca, Lixeira, Notificações, `/crm/meus-negocios` e Caixa de Entrada) fica **aberta**: este plano resolveu Busca, Lixeira e Notificações, mas `/crm/meus-negocios` e a Caixa de Entrada ainda produzem esses links.

Também vale saber (não é desvio de contrato): "Enviado em" e a contagem de dias da Lixeira usam `atualizadoEm` para Contato, Empresa e Negócio, porque o resumo da lista não traz o instante em que foram à lixeira (Conversa traz `naLixeiraEm`). Não existe expurgo automático dessas famílias no modelo novo; a contagem é informativa, como já era.

## Known Stubs

Nenhum. O esqueleto do RED de `use-notificacoes.ts` foi substituído no GREEN (nenhum "não implementado" restante).

## Threat Flags

Nenhum. T-15-36 (Busca revelando registro sem permissão) mitigado: Contato, Empresa, Negócio e Conversa só vêm das rotas, que aplicam Papel e Espaço, e há teste de que o registro antigo do seed não aparece quando a api não o devolve. T-15-37 (busca a cada tecla) mitigado: consulta só com 2+ caracteres (hook `pausado`) e `keepPreviousData` do SWR.

## Next Phase Readiness

Pronto para o próximo plano. O selo, o painel do trilho, a página de Notificações e o robô já leem o mesmo hook; `/crm/meus-negocios`, a Caixa de Entrada e o resto do panorama do Início seguem nos planos próprios.

## Self-Check: PASSED

Os três arquivos criados existem em disco e os sete commits (`fce8a7c`, `909dad4`, `e7251d0`, `20e8ce4`, `a8a29c9`, `57a7395`, `bd8889b`) são ancestrais de `HEAD`.
