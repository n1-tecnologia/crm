---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 03
subsystem: api
tags: [postgres, transacao, unidade-de-trabalho, gesto-misto, vitest, fastify]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: 011 aplicada em banco local (conversas_na_lixeira_em_ck, mesclado) e as guardas de D-06
  - phase: 13-grava-o-em-menos-idas-e-voltas-ao-banco
    provides: o caminho de duas idas de executar() (que o gesto com aoConfirmar deixa)
provides:
  - opcao lerDoCrm(cliente, state) em executar(), com parametro de tipo L e 4o argumento de aoConfirmar
  - executarGestoMisto, GestoMisto e DesfechoDoGestoMisto (servicos/crm/gesto-misto.ts)
  - recortarResposta (rotas/resposta-recortada.ts), extraido de POST /operacoes/:nome
  - secao "O gesto misto (Fase 14, 3.2.1)" em persistencia/CONTEXT.md
affects: [14-09, 14-13, 14-14, 14-17]

tech-stack:
  added: []
  patterns:
    - "recusa como valor: lerDoCrm devolve ResultadoCrm, a operacao devolve fail(), e a recusa volta com status e frase; excecao so para o que a pre-checagem nao pegou"
    - "SQLSTATE como rede: 23505/23503/23514 dentro de gravarNoCrm viram 409 pela tabela de frases do servico, sem o nome do constraint"
    - "prova do tudo ou nada contando registros, conversas e revisao do Espaco antes e depois"

key-files:
  created:
    - apps/api/src/servicos/crm/gesto-misto.ts
    - apps/api/src/servicos/crm/gesto-misto.test.ts
    - apps/api/src/rotas/resposta-recortada.ts
  modified:
    - apps/api/src/persistencia/unidade-de-trabalho.ts
    - apps/api/src/persistencia/unidade-de-trabalho.test.ts
    - apps/api/src/persistencia/CONTEXT.md
    - apps/api/src/rotas/operacoes.ts

key-decisions:
  - "lerDoCrm recebe tambem o state hidratado (ja com os Canais projetados): a troca de Canal da Tarefa acha o Contato pelo Vinculo antes de ler o CRM."
  - "gravarNoCrm pode devolver ResultadoCrm<void> com ok:false: vira uma excecao interna (RecusaDentroDoGesto) que desfaz a transacao e volta como valor."
  - "O tempo de lerDoCrm soma em hidratarMs; MedicaoDaExecucao nao ganhou campo."
  - "Nenhum serviço novo sobe a revisao do Espaco por fora: a trava do Espaco ja e a primeira e executar() sobe a revisao."

patterns-established:
  - "Gesto com aoConfirmar sai do caminho de duas idas da Fase 13 (aceito para gestos raros, aparece em idasEVoltas)."
  - "Teste de gesto misto: Espaco do seed, Canal por semearCanal, Contato pelo repositorio; contar tabelas antes e depois."

requirements-completed: [UNI-04]

coverage:
  - id: D1
    description: "executar() ganha lerDoCrm no mesmo cliente, depois da trava, da hidratacao e dos Canais projetados e antes da operacao; o lido chega a operacao e a aoConfirmar; sem a opcao nada muda"
    requirement: UNI-04
    verification:
      - kind: unit
        ref: "apps/api/src/persistencia/unidade-de-trabalho.test.ts#lerDoCrm (Fase 14)"
        status: pass
      - kind: unit
        ref: "apps/api/src/persistencia/unidade-de-trabalho-trava.test.ts; regime-dos-chamadores.test.ts; rotas/operacoes-medicao.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Forcar erro em gravarNoCrm deixa registros, conversas e revisao do Espaco como estavam; recusa do CRM, da operacao e de gravarNoCrm volta como valor; 23505 vira 409 com a frase, sem o nome do constraint"
    requirement: UNI-04
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/gesto-misto.test.ts (7 casos, Postgres 16 descartavel)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A resposta de POST /operacoes/:nome continua igual depois de o recorte por Membro sair para resposta-recortada.ts"
    requirement: UNI-04
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes.test.ts e estado.test.ts contra Postgres local (60 testes, nenhum pulado)"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/operacoes-medicao.test.ts; operacoes-suspenso.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "O custo do gesto com aoConfirmar (perde as duas idas da Fase 13) esta documentado e aceito em persistencia/CONTEXT.md"
    requirement: UNI-04
    verification:
      - kind: command
        ref: "grep -c 'O gesto misto' apps/api/src/persistencia/CONTEXT.md == 1"
        status: pass
    human_judgment: false

actuals:
  tokens: 21000
  tasks: 2
  commits: 4
plan_head_before: df76bad3867ca472129bb479fd120475cdab7c91
plan_head_after: b4e5daf67c39f0665518ebd00069626b3156f1ed
commits: 4

duration: 14min
completed: 2026-11-04
status: complete
---

# Phase 14 Plan 03: O gesto misto — tabelas do CRM e registros no mesmo commit Summary

**`executar()` ganhou `lerDoCrm` e nasceu `executarGestoMisto`: um gesto grava nas tabelas do CRM e em `plataforma.registros` na mesma transação, com a recusa como valor e o SQLSTATE traduzido em 409 com frase, provado tudo ou nada contra Postgres 16 descartável.**

## Performance

- **Duration:** 14 min
- **Tasks:** 2
- **Files modified:** 7 (3 criados, 4 alterados)

## Accomplishments

- `lerDoCrm(cliente, state)` roda no mesmo `PoolClient` entre a projeção dos Canais e a operação; o que devolve chega à `operacao` (2º argumento) e a `aoConfirmar` (4º). Os chamadores de hoje compilam e rodam sem mudança; a medição não ganhou campo.
- `executarGestoMisto(workspaceId, { lerDoCrm, operacao, gravarNoCrm }, frases)` devolve `ResultadoCrm<{ valor, resultado, depois }>`. A recusa de `lerDoCrm` vira `fail` para `executar()` desfazer limpo; a de `gravarNoCrm` vira exceção interna que desfaz e volta como valor; conflito de `executar()` é 409 `CONFLITO`; recusa do domínio é 409 `RECUSA_DO_DOMINIO` com o campo.
- Sete casos contra Postgres local: sucesso (conversa e Lista entram, revisão sobe 1), erro em `gravarNoCrm` (inclusive depois de a Conversa entrar: some), recusa do domínio, recusa do CRM (404), `23505` de Conversa aberta no par (409 `CONVERSA_JA_ABERTA` sem o nome do índice) e recusa tardia.
- `recortarResposta` extraído de `rotas/operacoes.ts` com o mesmo corpo; `operacoes.test.ts` e `estado.test.ts` passam contra o banco, sem pulados.
- `persistencia/CONTEXT.md` ganhou "O gesto misto (Fase 14, 3.2.1)": ordem das travas, recusa como valor, SQLSTATE como rede e o custo aceito de sair do caminho de duas idas.

## Task Commits

1. **Task 1: `lerDoCrm` em `executar()`**
   - `b9064b6` (test) RED: seis casos do `describe` "lerDoCrm (Fase 14)", cinco falhando
   - `9c763eb` (feat) GREEN: parâmetro `L`, opção `lerDoCrm`, 4º argumento de `aoConfirmar`, seção do `CONTEXT.md`
2. **Task 2: `executarGestoMisto` e `recortarResposta`**
   - `ba3877e` (test) RED: o teste contra Postgres falha sem o módulo
   - `b4e5daf` (feat) GREEN: `gesto-misto.ts`, `resposta-recortada.ts` e `operacoes.ts` chamando o recorte

## Decisions Made

Ver `key-decisions` no frontmatter. Nenhuma saiu do que o plano pedia.

## Deviations from Plan

None - plan executed exactly as written.

O plano não manda mexer em `repositorios/crm/conversas.ts`, e não mexi: a pesquisa cogitava `inserir` aceitar `id?` (ids gerados antes da operação); nenhum caso do 14-03 precisa disso. Quem precisar (14-13/14-14, que passam `conversaId` em `referencias`) acrescenta no seu plano.

## Issues Encountered

None.

## Verification

- `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run`: 127 arquivos passam, 39 pulados (os que exigem Postgres local), 1241 testes passam, 0 falhas.
- Contra Postgres 16 de Docker (`crm-n1-pg-1403`, porta 55603, removido ao fim): `gesto-misto.test.ts` (7), `operacoes.test.ts`, `estado.test.ts`, `unidade-de-trabalho-concorrencia.test.ts`: 60 passam, nenhum pulado.
- `npx tsc --noEmit` em `apps/api`: limpo. Guardas D-06 (`apps/api/src/sem-listas-espelho.test.ts`) passam; os literais proibidos não aparecem nos arquivos novos.
- Critérios de aceitação: `lerDoCrm` em `unidade-de-trabalho.ts` 3 linhas (>= 3), `O gesto misto` em `CONTEXT.md` 1, `lerDoCrm` dentro de `MedicaoDaExecucao` 0, `avancarRevisaoDoEspaco` em `gesto-misto.ts` 0, `recortarResposta` em `operacoes.ts` 2, as duas exportações presentes.

## Known Stubs

None.

## Threat Flags

None. T-14-06 (corrida entre pré-checagem e escrita): `lerDoCrm` é onde se trava com `for update` em ordem de id, e o teste de `23505` prova o 409 e que nada ficou. T-14-07 (resposta sem recorte): `recortarResposta` é o mesmo código de `POST /operacoes`, extraído. T-14-08 (exceção como fluxo): recusa é valor, documentado no `CONTEXT.md`.

## Next Phase Readiness

Para 14-09 (mesclar) e 14-13/14-14 (rotas da Tarefa conversacional):

- A porta é `executarGestoMisto`; o serviço escreve o seu `lerDoCrm` (travando linhas do CRM em ordem de id e conferindo lixeira e `mesclado`), a `operacao` pura e o `gravarNoCrm`, e passa a tabela `frases` com os constraints que a escrita pode bater. A rota devolve `recortarResposta(desfecho.resultado, desfecho.depois, membro.id)` para o mesmo recorte de `POST /operacoes`.
- `gravarNoCrm` roda em `aoConfirmar`, DEPOIS das escritas de `registros`: um gesto com ele paga mais idas (aparece em `idasEVoltas`), aceito.
- A recusa de `gravarNoCrm` destrói a conexão do pool (como qualquer exceção do bloco): prefira pré-checar em `lerDoCrm`.
- Pergunta em aberto OQ5 (confirmar com o dono): nos gestos mistos a Atividade da parte `registros` continua sendo gravada pela operação pura; o CRM novo não tem Registro de Atividade próprio.

## Self-Check: PASSED

- Arquivos criados existem: `gesto-misto.ts`, `gesto-misto.test.ts`, `resposta-recortada.ts`.
- Commits `b9064b6`, `9c763eb`, `ba3877e`, `b4e5daf` são ancestrais de `HEAD`.
