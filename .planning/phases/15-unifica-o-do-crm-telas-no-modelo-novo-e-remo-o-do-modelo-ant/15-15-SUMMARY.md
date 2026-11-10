---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 15
subsystem: crm
tags: [reuniao, negocio, contato, empresa, atividade, notas, tdd, ucr-06, ucr-03]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-04 (crm_atividades), 15-06 (AvatarDoContato, guarda sem-crm-antigo), 15-13 (fichas sem recuo), 15-37 e 15-09 (GET /atividades com cursor composto, useAtividades)"
provides:
  - "A Reuniao (/crm/reunioes/[reuniao]) le o lead do CRM novo: Negocio, Funil e Etapa (useNegocio), Contato (useContato) e Empresa (useEmpresa), achados pelo Vinculo da Tarefa em state.links"
  - "A nota da call vai para POST /contatos/:id/notas (adicionarNotaAoContato + validarNovaNota); a recusa da api aparece na tela e o texto fica"
  - "'Tudo que ja aconteceu' junta state.activity da Tarefa com useAtividades do Negocio e do Contato, sem repetir id, a mais recente primeiro"
  - "useAtividades aceita alvo indefinido (pausa a leitura): o hook pode ficar antes de um retorno antecipado"
affects: [15-26, 15-33, 15-40, 15-43]

plan_head_before: 6ae6fc6e402495cfc190cbcd4a54d678d8e99661
plan_head_after: a5f0aec3d25bda17ca55c06b04c4c81bb796137e

actuals:
  tokens: 12950
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Hooks de leitura por HTTP antes do retorno antecipado da pagina, com id indefinido quando ainda nao ha alvo (SWR chave nula)"
    - "Negocio na lixeira, 403 e 404 tratados como ausente: estado vazio, sem erro"
    - "Escrita que gera Atividade no servidor revalida o prefixo /atividades no sucesso"

key-files:
  created:
    - apps/web/src/features/crm/reuniao.test.tsx
  modified:
    - apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx
    - apps/web/src/dados/crm/atividades.ts
    - apps/web/src/dados/crm/atividades.test.ts
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md

key-decisions:
  - "O Funil e a Etapa vem do proprio NegocioDetalhado (GET /negocios/:id ja traz os nomes), nao de useFunil: um pedido a menos, efeito visivel nenhum (o plano citava useFunil)"
  - "Negocio na lixeira conta como ausente (estado vazio 'Esta Reuniao nao tem Negocio.'); arquivado continua visivel; 403 e 404 da api viram o mesmo estado vazio"
  - "Diagnostico, Roteiro, Temperatura, LinkedIn e TikTok saem da Reuniao: plataforma.negocios nao guarda Campos personalizados e o Contato novo so tem os Identificadores telefone, email, whatsapp e instagram. Registrado em WINDOWS.md #29"
  - "O retrato do palco sao as iniciais (AvatarDoContato grande): o modelo novo nao tem arquivo de foto"
  - "O painel 'Anotacoes e atividades' aparece sempre que ha Negocio; o campo de nota so quando ha Contato (Negocio da Empresa sem Contato ainda mostra o historico)"

patterns-established:
  - "Revalidar /atividades depois de uma escrita que o servidor registra na linha do tempo (a chave nao e invalidada pelas mutacoes de dados/crm/*)"

requirements-completed: [UCR-06, UCR-03]

coverage:
  - deliverable: "A Reuniao mostra Negocio, Etapa, Funil, Contato e Empresa lidos da api, nada do state.deals"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/reuniao.test.tsx#mostra o Negocio, a Etapa e o Funil, o Contato e a Empresa lidos pela api, nada do state.deals", status: pass }
      - { kind: command, ref: "grep -cE 'state\\.(deals|contacts|companies|funnels)' page.tsx == 0", status: pass }
    human_judgment: false
  - deliverable: "A nota da call vai para POST /contatos/:id/notas, sem operacao antiga; a recusa aparece e o texto fica"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/reuniao.test.tsx#a nota da call vai para POST /contatos/:id/notas e nenhuma operacao sai para /operacoes", status: pass }
      - { kind: test, ref: "apps/web/src/features/crm/reuniao.test.tsx#a recusa da api aparece na tela e o texto digitado fica", status: pass }
      - { kind: command, ref: "grep -c addContactNote page.tsx == 0", status: pass }
    human_judgment: false
  - deliverable: "Tudo que ja aconteceu junta state.activity e GET /atividades (Negocio e Contato), ordenado, sem repetir id; salvar a nota revalida /atividades"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/reuniao.test.tsx#mostra a Atividade antiga da Tarefa e a do Contato vinda da api, a mais recente primeiro", status: pass }
      - { kind: test, ref: "apps/web/src/features/crm/reuniao.test.tsx#nao repete a mesma Atividade que as duas fontes devolvem", status: pass }
      - { kind: test, ref: "apps/web/src/features/crm/reuniao.test.tsx#salvar a nota revalida as Atividades", status: pass }
    human_judgment: false
  - deliverable: "Borda UCR-06: sem Vinculo, Negocio na lixeira ou 403 mostram o estado vazio sem erro; Negocio da Empresa sem Contato mostra a Empresa"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/reuniao.test.tsx (grupo 'sem Negocio, com Negocio na lixeira ou fora de alcance', 4 casos)", status: pass }
    human_judgment: false
  - deliverable: "A Reuniao com o desenho certo na tela real (palco, dossie, linha do tempo) e a leitura de um lead de verdade"
    verification: []
    human_judgment: true
    rationale: "So teste de componente com fetch falso e seed; o aspecto e a ordem da tela com dados reais nao foram vistos em navegador (human_verify_mode = end-of-phase)"
---

# Phase 15 Plan 15: Reuniao no CRM novo Summary

**A Reuniao le o lead do CRM novo (Negocio, Funil e Etapa por `useNegocio`, Contato por `useContato`, Empresa por `useEmpresa`), grava a nota da call em `contato_notas` e mostra "Tudo que ja aconteceu" juntando `state.activity` com `GET /atividades` do Negocio e do Contato.**

## Performance

- **Duracao:** cerca de 10 min (12:33 a 12:43 UTC)
- **Tasks:** 2 (1 tracador, 1 auto), as duas `tdd="true"`
- **Arquivos:** 1 criado, 5 modificados
- **Commits:** 5 (2 RED + 2 GREEN + CONTEXT), medidos de `plan_head_before`

## Accomplishments

- **Tracador:** o Vinculo da Tarefa (`state.links`, tipo `deal`) aponta o id do Negocio e dai em diante tudo e HTTP. `page.tsx` perdeu `state.deals`, `contacts`, `companies`, `funnels`, `fieldDefinitions`, `catalog`, `contactDisplayRole` e `addContactNote`. O Contato sai de `negocio.contatoId`; o cargo, do vinculo vigente (`fim` nulo) do Contato; a Empresa, de `useEmpresa(negocio.empresaId)`. O resumo do Negocio ganhou Funil, Etapa e Empresa com link. O avatar e o retrato do palco sao `AvatarDoContato`.
- **Nota da call:** `validarNovaNota` pre-valida e `adicionarNotaAoContato` grava; o texto so some se gravou, e a frase da recusa da api (403, 400, 409) vai para o Toast de erro. Nenhuma operacao sai para `/operacoes`.
- **Linha do tempo:** `juntarAtividades` une `state.activity` da Tarefa com `useAtividades({deal, N})` e `useAtividades({contact, X})` (cada uma ja junta a fonte antiga do objeto com a rota), sem repetir id e por `at` decrescente. Falha da rota avisa em uma linha e a outra fonte continua a mostra. Salvar a nota chama `invalidarCrm("/atividades")` para a Atividade "Nota registrada no Contato" aparecer.
- **Bordas UCR-06:** sem Vinculo a pagina nem vai a `/negocios`; Negocio `na_lixeira`, 403 e 404 mostram "Esta Reuniao nao tem Negocio." sem alerta; Negocio da Empresa sem Contato mostra "Esta Reuniao nao tem Contato." com o nome da Empresa e ainda lista o historico.
- **`useAtividades(undefined)`:** nao le nada e devolve lista vazia, para o hook ficar antes do retorno antecipado da pagina (regra dos hooks). `useAtividadesDoCrm` ganhou `opcoes.pausado`, como os outros hooks de lista.
- **Guarda `sem-crm-antigo`:** a pagina saiu da lista CONGELADOS da web (prova: o regex nao a casa mais e o teste segue verde).

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (tracador) | `d372ae4` | `5e38ef5` |
| 2 | `6a5d8b0` | `c7bf46e` |

Avaliacao semantica do RED:

- **Tarefa 1:** os tres casos executaram e falharam pela asserção planejada: a pagina antiga, sem o Negocio no `state.deals` (o id e novo), mostrava "Esta Reuniao nao tem Contato." e nao o titulo, a Etapa, o Funil nem o Contato. Os tres alvos rodaram; nao e falha de import nem de fixture.
- **Tarefa 2:** dois dos oito casos novos falharam pela asserção planejada (a Atividade do Contato vinda da api nao aparecia; `invalidarCrm("/atividades")` nao era chamado). Os outros seis ja passavam e sao regressao protegida (sem repeticao de id, que a fonte unica de `state.activity` ja garantia, e as quatro bordas, que o tracador ja entregava).
- Plano `type: execute`, entao nao rodei `gsd check tdd-red-evidence`; a avaliacao e manual, no mesmo padrao dos planos 15-06 e 15-13.

## Verificacao

Tudo em `apps/web` (jsdom, sem banco; nenhum Postgres foi necessario e nenhum conteiner foi criado).

- `npx vitest run src/features/crm/reuniao.test.tsx src/sem-crm-antigo.test.ts` verde, e `npx tsc --noEmit` limpo (os dois `<automated>` do plano).
- `npx vitest run` da web inteira: 123 arquivos, 1176 testes, todos verdes.
- `npx eslint` na pagina, no teste novo e em `dados/crm/atividades*`: sem achados.
- Criterios de aceitacao: `grep -cE "state\.(deals|contacts|companies|funnels)"` = 0; `grep -c addContactNote` = 0; `grep -c useAtividades` = 4 (>= 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Hook de Atividade nao podia ficar antes do retorno antecipado**
- **Found during:** Task 2
- **Issue:** `useAtividades` exigia `{tipo, id}` e sempre ia a api; a pagina chama os hooks antes de `if (!task)` e sem Negocio ainda nao ha id (`objetoId=` vazio daria 400).
- **Fix:** `useAtividades(alvo | undefined)` e `useAtividadesDoCrm(filtro, {pausado})`: sem alvo, chave nula e lista vazia. Caso (f) acrescentado em `atividades.test.ts`.
- **Files modified:** `apps/web/src/dados/crm/atividades.ts`, `apps/web/src/dados/crm/atividades.test.ts`
- **Commit:** `c7bf46e`

**2. [Contrato do plano] `useFunil` nao e usado**
- **Found during:** Task 1
- **Issue:** a truth 3.4.5 cita `useFunil` para a Etapa e o Funil, mas `NegocioDetalhado` (GET /negocios/:id) ja traz `funil.nome` e `etapa.nome`; chamar `useFunil` seria um segundo pedido para o mesmo texto.
- **Fix:** a tela le o payload do Negocio. Efeito visivel nenhum. Registrado e dispensado em WINDOWS.md (#30, waived).

**3. [Contrato do plano] Diagnostico, Roteiro, Temperatura, LinkedIn e TikTok saem da tela**
- **Found during:** Task 1
- **Issue:** o plano troca as leituras mas nao diz o que fazer com o que o modelo novo nao guarda: o Negocio de `plataforma.negocios` nao tem Campos personalizados (`fd_diagnostico`, `fd_criterio`, etc.), o Contato novo nao tem Temperatura e os Identificadores do Contato sao so telefone, email, whatsapp e instagram. O prohibitions do plano (F14-D-04) ja manda nao trazer de volta Historico de Etapas, Tags e varios Contatos.
- **Fix:** o painel "Roteiro da call", o paragrafo "Diagnostico da call", a pilula "Lead quente" e os perfis de LinkedIn e TikTok foram retirados; a pilula agora mostra a Qualificacao do Contato (texto livre) quando existe. Visivel ao usuario, entao esta em aberto em WINDOWS.md #29 para o dono decidir se quer Campos personalizados de Negocio.
- **Files modified:** `apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx`
- **Commit:** `5e38ef5`

**Total deviations:** 3 (1 Rule 2, 2 de contrato do plano). **Impact:** o item 3 muda o que a pessoa ve na call; o resto e interno.

## Known Stubs

Nenhum. O palco de video segue sendo o aviso honesto que ja existia (nao ha chamada de video no produto), nao um stub deste plano.

## Issues Encountered

Nenhum.

## Threat Flags

Nenhum. T-15-38: os hooks chamam a api, que aplica Papel e Espaco; 403 e 404 viram estado vazio (testado). T-15-39: o texto da nota e da Atividade e renderizado como texto React (`ActivityTimeline`), sem `dangerouslySetInnerHTML`; o `href` do Instagram usa `encodeURIComponent` do valor normalizado pelo dominio.

## Next Phase Readiness

Pronto para o proximo plano. A Reuniao nao le mais o CRM antigo; a parte "Meus negocios" da 3.4.5 e dos planos 15-26 e 15-40.

## Self-Check: PASSED
