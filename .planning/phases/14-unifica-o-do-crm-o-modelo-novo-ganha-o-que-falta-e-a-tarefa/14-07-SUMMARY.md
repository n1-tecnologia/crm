---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 07
subsystem: api
tags: [crm, conversas, lixeira, estrela, leitura, filtros, caixa-de-entrada, vitest, postgres]
status: complete

requires:
  - phase: 14-01
    provides: `conversas.na_lixeira_em` e a tabela `conversa_marcacoes` (011)
  - phase: 14-05
    provides: a ordem de travas Contato antes de Conversa e o molde dos gestos de Conversa
provides:
  - "`POST /conversas/:id/lixeira` e `/restaurar`, com `Conversa.naLixeiraEm` no tipo, no repositório e na resposta"
  - "`PUT /conversas/:id/marcacao`: estrela e leitura do próprio Membro da sessão"
  - "`GET /conversas` com `atribuidoId`, `filaId`, `comEstrela` e `q`; cada item traz `contatoNome`, `estrela` e `naoLidas`"
  - "`validarLixeira`, `validarRestauracao`, `validarMarcacao`, `ConversaNaLista`, `MarcacaoDaConversa`, `EdicaoDeMarcacao` em `@n1/dominio/crm/conversas`"
  - "`criarRepositorioDeMarcacoesPg` (`obter` e `gravar` por upsert)"
affects: [14-09, 14-14, 15]

actuals:
  tokens: 40000
  tasks: 2
  commits: 4
plan_head_before: 51caaccb7254cf0b6a037d53106e4f2fa6def5c8
plan_head_after: aa64f436ac15be87ca715d4d544094c8a0c5d446
commits: 4

tech-stack:
  added: []
  patterns:
    - "marcação por Membro: o Membro vai como parâmetro do serviço (sempre `membro.id` da sessão) e o corpo `.strict()` não tem campo de Membro; sem linha, a marcação é o padrão"
    - "busca literal por `position(lower($n) in lower(titulo)) > 0`: sem LIKE, então `%` e `_` do cliente não são curingas"
    - "upsert que só muda os campos enviados: `coalesce($n, coluna)` em vez de montar o SQL por campo"

key-files:
  created:
    - apps/api/src/repositorios/crm/marcacoes.ts
  modified:
    - packages/dominio/src/crm/conversas.ts
    - packages/dominio/src/crm/conversas.test.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/repositorios/crm/conversas.ts
    - apps/api/src/servicos/crm/conversas.ts
    - apps/api/src/servicos/crm/conversas.test.ts
    - apps/api/src/rotas/crm/conversas.ts
    - apps/api/src/rotas/crm/conversas.test.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "`comEstrela=false` filtra as que o Membro NÃO marcou (igualdade); sem o parâmetro, as duas. O plano só dizia `\"true\" | \"false\"` virar boolean."
  - "`contatoNome` usa a mesma regra da lista de Contatos: nome e sobrenome, senão o e-mail principal, senão o telefone principal, senão \"Contato sem nome\"; `null` só se o Contato não for achado neste Espaço."
  - "`PUT /marcacao` devolve a marcação inteira depois da edição (`{ estrela, lidaAte }`), não a Conversa."
  - "Restaurar trava o Contato antes da Conversa (mesma ordem de `mover`), para não dar deadlock com a mesclagem (14-09)."
  - "Mandar para a lixeira uma Conversa que já está lá é 409 (`validarLixeira`), para não reescrever `na_lixeira_em`."

patterns-established:
  - "`ConversaNaLista` é a Conversa mais o que depende de quem olha (estrela, naoLidas) e do Contato (nome): a Caixa nova lê tudo de `GET /conversas`."

requirements-completed: [UNI-09]

coverage:
  - id: D1
    description: "Conversa resolvida vai para a lixeira gravando `na_lixeira_em`, some de `estado=ativo` e aparece em `estado=na_lixeira`; restaurar volta para `ativo` e zera a data"
    requirement: UNI-09
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#lixeira e restaurar (3.2.6)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lixeira recusa Conversa aberta ou pendente e a que já está lá; restaurar recusa a que não está na lixeira e a de Contato na lixeira; Convidado 403; outro Espaço 404"
    requirement: UNI-09
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#lixeira e restaurar (3.2.6)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A estrela e o ponto de leitura são do Membro: X marca e Y não vê; `naoLidas` conta as recebidas depois do `lidaAte` de cada Membro; marcar um campo não apaga o outro"
    requirement: UNI-09
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#marcação por Membro e listagem com filtros (3.2.6)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Filtros `atribuidoId`, `filaId`, `comEstrela` e `q` (sem diferenciar maiúscula, literal: `%`, `_` e aspas não quebram nem viram curinga) e `contatoNome` montado como na ficha"
    requirement: UNI-09
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#marcação por Membro e listagem com filtros (3.2.6)"
        status: pass
    human_judgment: false
  - id: D5
    description: "As rotas: lixeira e restaurar sem `body`; `PUT /marcacao` com corpo `.strict()` (`{}`, `membroId`, `workspaceId`, `lidaAte` inválida dão 400 sem chamar o serviço); filtros novos da querystring"
    requirement: UNI-09
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/conversas.test.ts"
        status: pass
    human_judgment: false
---

# Phase 14 Plan 07: Lixeira, estrela, leitura por Membro e filtros da Conversa nova Summary

**`POST /conversas/:id/lixeira` e `/restaurar` com `na_lixeira_em`, `PUT /conversas/:id/marcacao` para estrela e leitura do próprio Membro, e `GET /conversas` com filtros por Atribuído, Fila, estrela e título, devolvendo `contatoNome`, `estrela` e `naoLidas` por item.**

## Performance

- **Duration:** cerca de 12 min de relógio
- **Tasks:** 2 (cada uma com commit RED e commit GREEN)
- **Files modified:** 10 (1 criado)

## Accomplishments

- **Lixeira e restaurar (3.2.6).** `Conversa.naLixeiraEm` entrou no tipo, em `COLUNAS_CONVERSA`, em `LinhaDoBancoDeConversa` e em `linhaParaConversa`, juntos. `validarLixeira` só aceita Conversa resolvida e ainda ativa; `validarRestauracao` recusa a que não está na lixeira e a de Contato na lixeira (a frase do modelo antigo, "Restaure o Contato antes"). O repositório grava `estado` e `na_lixeira_em` na mesma escrita (`conversas_na_lixeira_em_ck`). O serviço segue o molde de `mover`: Papel, depois travas (restaurar trava o Contato antes da Conversa), regra pura, escrita.
- **Marcação por Membro.** `repositorios/crm/marcacoes.ts` com `obter` (padrão sem linha) e `gravar` (upsert que só muda o que veio). `marcar` no serviço confere o Papel (`editar`), valida a edição, confere que a Conversa existe NESTE Espaço e grava com `membro.id`. A rota tem corpo `.strict()` sem campo de Membro (T-14-17).
- **`GET /conversas` ampliado.** `left join` com `conversa_marcacoes` do Membro da sessão e com `contatos` (os dois pelo mesmo `workspace_id`, T-14-18); `naoLidas` por subconsulta sobre `mensagens` `recebida` depois do `lida_ate`; filtros novos como fragmentos constantes com `$n`; `q` por `position(lower($n) in lower(titulo))` (T-14-16).
- Documentação: `packages/dominio/CONTEXT.md` e `apps/api/src/rotas/CONTEXT.md`.

## Task Commits

1. **Task 1 RED** — `f3abf69` `test(14-07): lixeira e restaurar da Conversa nova, com falha esperada`
2. **Task 1 GREEN** — `587fc24` `feat(14-07): lixeira e restaurar da Conversa nova, guardando quando foi`
3. **Task 2 RED** — `aa8baa7` `test(14-07): estrela e leitura por Membro e GET /conversas com filtros, com falha esperada`
4. **Task 2 GREEN** — `aa64f43` `feat(14-07): estrela e leitura por Membro e GET /conversas com filtros e contagens`

## Verification

- `packages/dominio`: suíte inteira 2273 testes passam (inclui `crm/conversas.test.ts`, `quem-pode.test.ts` e a guarda D-06); `tsc --noEmit` limpo.
- `apps/api` contra Postgres 16 de Docker migrado até a 011 (porta 55607, contêiner removido ao fim): `servicos/crm/conversas.test.ts`, `rotas/crm/conversas.test.ts`, `servicos/crm/mensagens.test.ts` 91 passam, nenhum pulado; `src/servicos/crm`, `src/rotas/crm` e `src/repositorios/crm` 21 arquivos, 388 testes passam; `src/persistencia` sozinho 20 arquivos, 181 testes passam; `rotas/operacoes.test.ts` e `rotas/estado.test.ts` 48 passam; `tsc --noEmit` limpo.
- `apps/api` inteiro sem banco (`DATABASE_URL=` vazio, como manda a `<verification>`): 128 arquivos passam, 40 pulados (precisam de banco), 1288 testes passam, 0 falhas. Guarda D-06 de `apps/api` passa.
- Não rodei a suíte inteira da api com banco (13 a 17 min, fora do que o plano pede); rodei os conjuntos que a ordem do orquestrador exige.
- Critérios de aceite: `na_lixeira_em` no repositório de Conversas (6), `naLixeiraEm` no domínio (2), rotas de lixeira e restaurar (4 linhas), `conversa_marcacoes` em `marcacoes.ts` (5), `naoLidas` no repositório (2 linhas), rota de marcação (2 linhas), `marcacao` em `rotas/CONTEXT.md` (1 linha), `position(lower` (1).

## Deviations from Plan

None - plan executed exactly as written, com um ajuste de teste e três escolhas dentro do que o plano deixa aberto:

- A linha de comportamento do plano diz que "com `content-type: json` e corpo vazio não quebra (rota sem `body`)". Não é o que o Fastify 5 faz: ele recusa JSON de corpo vazio com 400 mesmo sem `body` no schema (`FST_ERR_CTP_EMPTY_JSON_BODY`; o comentário de `rotas/crm/conversas.ts` já dizia isso). O teste de rota cobre o que vale: sem corpo e sem content-type dá 200, e `{}` com content-type json também dá 200.
- `comEstrela=false` filtra as não marcadas (igualdade), ver key-decisions.
- `PUT /marcacao` devolve a marcação, não a Conversa.
- `contatoNome` segue a regra da lista de Contatos (e-mail principal, depois telefone principal), não só o "Identificador principal" genérico.

## Issues Encountered

- `src/persistencia/outbox-worker.test.ts` (casos h, i, j, k) falha quando roda no mesmo lote que `rotas/operacoes.test.ts` e `rotas/estado.test.ts` contra o mesmo banco (as duas suítes de rota enfileiram o outbox global que o worker reivindica). Sozinho (15 testes) e com `src/persistencia` inteiro (20 arquivos) passa; `operacoes` e `estado` sozinhos também passam. Interferência de isolamento já existente: este plano não toca `persistencia/`, `operacoes` nem `estado`. Não corrigi, fora do escopo; quem montar o gate cumulativo deve rodar os três grupos separados.

## Known Stubs

None.

## Threat Flags

None. A superfície nova é a das três rotas já cobertas por T-14-16 (SQL por `q` e filtros: fragmentos constantes e `$n`, teste com `%`, `_` e aspas), T-14-17 (marcação em nome de outro Membro: `membro.id` da sessão, corpo `.strict()`, teste "Y não vê a estrela de X") e T-14-18 (`contatoNome` entre Espaços: `workspace_id` dos dois lados do `join`).

## Notas para os próximos planos

- `ServicoDeConversas` ganhou `enviarParaLixeira`, `restaurar` e `marcar`, e `listar` passou a devolver `Pagina<ConversaNaLista>`: todo serviço falso de Conversas em teste de outro plano precisa dos três métodos novos (os testes de rota já foram ajustados). O repositório `listar` ganhou o 3º argumento `membroId`.
- `Conversa.naLixeiraEm` é campo novo e obrigatório no tipo: qualquer literal de `Conversa` fora do repositório precisa dele (nenhum existe hoje fora dos testes, que usam `as`).
- A mesclagem (14-09) que mover Conversas de um Contato absorvido não precisa tocar em `conversa_marcacoes`: a marcação é da Conversa e do Membro, não do Contato. Conversa na lixeira de um Contato absorvido segue lá; restaurar confere o Contato da Conversa, então depois da mesclagem ele é o sobrevivente.
- Lixeira, restaurar e marcação NÃO gravam Registro de Atividade nem avançam a revisão do Espaço (mesma escolha de mover e atribuir, OQ5). `mensagens.leituras_internas` da 008 não é escrita por nada novo.
- A Caixa antiga segue no modelo antigo (`trashConversation`, `restoreConversation`, `toggleConversationStar`, `markConversationRead`) até a Fase 15; Rascunhos da Conversa ficam fora (Sessão 16).

## Self-Check: PASSED

- `apps/api/src/repositorios/crm/marcacoes.ts` existe e está rastreado; os arquivos de `key-files.modified` estão no histórico dos 4 commits.
- Commits `f3abf69`, `587fc24`, `aa8baa7`, `aa64f43` presentes (`git rev-list --count` desde `plan_head_before` = 4).
- Contêiner `crm-n1-pg-1407` removido; `crm-n1-pg-13` não foi tocado.
