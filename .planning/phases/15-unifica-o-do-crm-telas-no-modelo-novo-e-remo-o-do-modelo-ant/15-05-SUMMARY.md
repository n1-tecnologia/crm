---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 05
subsystem: crm
tags: [resumo-da-tarefa, empresa, qualificacao, conversa, mesclar, funil-vazio, tdd, ucr-04]
status: complete

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "POST /tarefas-conversacionais/resumo (14-13), cartao/tabela/ficha lendo o resumo (14-15), dialogo Mesclar com... (14-09)"
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-02: filtro de lixeira de Conversa no resumo"
provides:
  - "ResumoDaTarefaConversacional com empresa, qualificacaoId e conversa { situacao, estado, atribuido } (D-15-05), numa consulta so"
  - "cartao, linha da tabela e ficha da Tarefa conversacional mostrando Empresa, qualificacao (rotulo do Catalogo), estado da Conversa e Atribuido"
  - "Mesclar com... exige digitar o nome do absorvido (D-15-10)"
  - "criar Negocio pela Tarefa sem Funil mostra 'Crie seu primeiro Funil' com link para /crm/funis (D-15-13)"
affects: [15-06, 15-15, 15-37]

plan_head_before: e4b9e34524343af20a62005ccf2f73e3fb23b24c
plan_head_after: e99d8068de1f460cb193181a99473c7b491d9221

actuals:
  tokens: 15100
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "left join lateral com order by admin desc, criado_em, id limit 1 para escolher uma Empresa de forma deterministica"
    - "o resumo devolve ids (qualificacao, Atribuido) e a web resolve o rotulo/nome no store (catalog, members, agents)"
    - "confirmacao por nome digitado em gesto irreversivel (comparacao sem caixa e sem espacos nas pontas)"

key-files:
  created: []
  modified:
    - packages/dominio/src/crm/resumo-da-tarefa.ts
    - apps/api/src/repositorios/crm/tarefas-conversacionais.ts
    - apps/api/src/servicos/crm/tarefas-conversacionais.test.ts
    - apps/api/src/rotas/crm/tarefas-conversacionais.test.ts
    - apps/web/src/dados/crm/tarefas-conversacionais.ts
    - apps/web/src/dados/crm/tarefas-conversacionais.test.ts
    - apps/web/src/features/estrutura/cartao-conversacional.tsx
    - apps/web/src/features/estrutura/cartao-conversacional.test.tsx
    - apps/web/src/features/estrutura/tabela-de-tarefas.tsx
    - apps/web/src/features/estrutura/tarefa-completa.tsx
    - apps/web/src/features/estrutura/tarefa-completa-resumo.test.tsx
    - apps/web/src/features/estrutura/tarefa-completa-gestos.test.tsx
    - apps/web/src/features/crm/mesclar-contato-dialog.tsx
    - apps/web/src/features/crm/ficha-de-contato.test.tsx

key-decisions:
  - "Empresa do cartao = vinculo vigente (fim is null) com admin mais antigo; sem admin, o vigente mais antigo; Empresa na lixeira passa a vez (suposicao A6, a confirmar com o dono: a 007 nao tem vinculo principal)"
  - "Atribuido e qualificacao saem do resumo como ids; a web resolve nome/rotulo em state.members, state.agents e state.catalog"
  - "A temperatura do Contato nao volta (D-15-06)"
  - "Na tabela a Empresa e a qualificacao entram na celula do Contato e o estado da Conversa na celula do Canal, sem coluna nova"

requirements-completed: [UCR-04]

coverage:
  - deliverable: "resumo em lote devolve empresa, qualificacaoId e conversa numa consulta so"
    verification:
      - { kind: test, ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#resumo (3.3.3)", status: pass }
    human_judgment: false
  - deliverable: "cartao, tabela e ficha mostram Empresa, qualificacao, estado e Atribuido"
    verification:
      - { kind: test, ref: "apps/web/src/features/estrutura/cartao-conversacional.test.tsx#(g)(h)(i)(j)", status: pass }
      - { kind: test, ref: "apps/web/src/features/estrutura/tarefa-completa-resumo.test.tsx#(e)(f)(g)(h)(i)", status: pass }
    human_judgment: true
    rationale: "A disposicao visual (subtitulo do cartao, linhas do bloco CRM, pilulas na tabela) nao e asserida por teste de layout; conferir na tela."
  - deliverable: "Mesclar com... pede o nome do absorvido"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/ficha-de-contato.test.tsx#(u)(v)(w)", status: pass }
    human_judgment: false
  - deliverable: "Crie seu primeiro Funil no dialogo de criar Negocio"
    verification:
      - { kind: test, ref: "apps/web/src/features/estrutura/tarefa-completa-resumo.test.tsx#(j)(k)", status: pass }
    human_judgment: false
---

# Phase 15 Plan 05: Empresa, qualificacao, estado e Atribuido de volta a Tarefa conversacional Summary

**O resumo em lote da Tarefa conversacional passa a trazer Empresa (vinculo vigente admin mais antigo), id da qualificacao e situacao/estado/Atribuido da Conversa numa consulta so; cartao, tabela e ficha os mostram, "Mesclar com..." exige o nome do absorvido e criar Negocio sem Funil orienta para /crm/funis.**

## Performance

- **Tasks:** 3 (1 tracer, 2 auto), todas `tdd="true"`
- **Files modified:** 14 (nenhum criado)
- **Commits:** 6 (3 RED + 3 GREEN), medidos de `plan_head_before`

## Accomplishments

- **Dominio:** `ResumoDaTarefaConversacional` ganhou `empresa`, `qualificacaoId` e `conversa` (tipos de situacao e estado vindos de `crm/conversas`). Nenhum telefone, e-mail ou texto de Mensagem alem do trecho (prova de chaves exatas no teste de privacidade).
- **SQL (traçador):** um `left join lateral` em `plataforma.contato_empresa` (`fim is null`, `order by ce.admin desc, ce.criado_em, ce.id limit 1`, Empresa fora da lixeira) mais `ef.qualificacao` e as colunas da Conversa `cv`. Segue na mesma consulta do lote: o teste que conta `pool.query` continua dando 1 para 50 Vinculos. Todo `join` leva `workspace_id = $1`.
- **Cartao:** a Empresa vai no subtitulo (icone de predio + nome); pilulas da qualificacao (rotulo do Catalogo, nada se o id nao existe) e do estado da Conversa (Aberta/Pendente/Resolvida).
- **Tabela:** a celula do Contato soma Empresa e qualificacao; a do Canal soma o estado da Conversa.
- **Ficha:** linhas Empresa (link para `/crm/empresas/:id`), Qualificacao, Estado da Conversa e Atribuido ("Sem Atribuido" quando nulo; Membro pelo `displayName`, Agente pelo nome, resolvidos no store).
- **D-15-13:** com `useFunis` vazio o dialogo de criar Negocio mostra o aviso com o link "Crie seu primeiro Funil" (`/crm/funis`) no lugar do seletor e o confirmar fica desligado com "Crie um Funil primeiro.".
- **D-15-10:** campo "Digite o nome do Contato que sera absorvido"; o botao so liga com o nome de exibicao do absorvido (sem caixa, sem espacos nas pontas); trocar o absorvido limpa o campo.

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 | `cf796db` (9 casos do servico falham: Empresa, qualificacao, Conversa, chaves; 1 de componente) | `3e44730` |
| 2 | `c6a274e` (7 falham: rotulo do Catalogo, estado, Atribuido, Empresa na ficha, aviso de Funil) | `fc068bd` |
| 3 | `435893a` ((u), (v) e (w) falham: sem o campo do nome) | `e99d806` |

Semantic assessment do RED: em cada commit o alvo executou e falhou na asserção planejada (`expected undefined`, `Unable to find an element with the text ...`, `Unable to find a label ...`), nao por import, sintaxe nem fixture. O plano e `type: execute` com tarefas `tdd="true"`, entao nao rodei `gsd check tdd-red-evidence`; a avaliacao acima e manual. Sem REFACTOR separado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixtures de Empresa precisam de Contato admin no mesmo commit**
- **Found during:** Task 1 (GREEN)
- **Issue:** a 007 tem um constraint trigger deferido (`empresas_exige_admin`): inserir uma Empresa sem vinculo admin vigente na mesma transacao falha no commit. Meus helpers de teste inseriam Empresa e vinculo em statements separados.
- **Fix:** helper `empresa()` cria Empresa e o vinculo admin numa transacao; Empresas "so com vinculo comum" ganham um Contato admin a parte.
- **Files modified:** `apps/api/src/servicos/crm/tarefas-conversacionais.test.ts`
- **Commit:** `3e44730`

**2. [Rule 3 - Blocking] Fixtures de outros testes quebravam o tsc com os campos novos obrigatorios**
- **Found during:** Task 1
- **Fix:** `empresa: null, qualificacaoId: null, conversa: null` nas fixtures de `rotas/crm/tarefas-conversacionais.test.ts`, `dados/crm/tarefas-conversacionais.test.ts`, `tarefa-completa-gestos.test.tsx` e `tarefa-completa-resumo.test.tsx`, e em `resumoVazio` (web).
- **Commit:** `3e44730`

**3. Helper de rotulo/nome e pilulas em `cartao-conversacional.tsx`**: `rotuloDaQualificacao`, `nomeDoAtribuido`, `PilulaDaQualificacao`, `PilulaDoEstadoDaConversa` ficaram no arquivo do cartao (ja compartilhado com a tabela e a ficha) em vez de um arquivo novo; nao estava na lista `files_modified`, mas nao cria arquivo.

**Total deviations:** 2 auto-fixed (Rule 3), 0 arquitetural. **Impact:** so testes; nenhum desvio de escopo.

## Flags para o dono

1. **Empresa do cartao (suposicao A6):** a 007 nao tem "vinculo principal". Adotei o vigente `admin` mais antigo (sem admin, o vigente mais antigo). Se o dono quiser outra regra (por exemplo a Empresa mais recente), muda so o `order by` do lateral.
2. **Qualificacao e texto livre no modelo novo:** `contatos.qualificacao` e `text` livre (007). O resumo devolve esse valor como `qualificacaoId` e a tela so mostra rotulo quando ele e id de item de Catalogo `qualificacao` (como o plano pediu). Contatos criados pela ficha nova com texto livre nao mostram pilula; os migrados do modelo antigo (script da Fase 15) mostram, se o script gravar o id. Vale confirmar essa convencao no plano do script.
3. **`conversa.estado` e sempre `ativo`** no resumo: o join ja exclui Conversa na lixeira (15-02), entao o campo existe por contrato mas o estado `na_lixeira` nunca sai.

## Threat Model

- T-15-15 (IN-05, accept): o resumo continua aceitando ids sem relacao com Tarefas visiveis; agora devolve tambem Empresa e Atribuido. Escopo por `workspace_id` da sessao mantido; aberto por D-15-07.
- T-15-16 (mitigate): todo join novo leva `workspace_id = $1`; caso de teste "Empresa (T-15-16)" com Espaco vizinho: `empresa: null` e o nome nao vaza no JSON.
- T-15-17 (mitigate): confirmacao por nome digitado; a rota continua exigindo `editar`.

## Known Stubs

None.

## Verification

- `apps/api`: `tarefas-conversacionais.test.ts` (servico, banco local) 48/48; `rotas/crm/tarefas-conversacionais.test.ts` 71/71 sem banco; `servicos/crm + rotas/crm + repositorios/crm` 29 arquivos, 592 testes verdes no Postgres 16 local (porta 55705, migracoes 001-012 aplicadas).
- `apps/web`: suite inteira 108 arquivos, 1046 testes verdes; `eslint` limpo em `features/crm`, `features/estrutura` e `dados/crm`.
- `packages/dominio`: 122 arquivos, 2333 testes verdes.
- `tsc --noEmit` nos tres workspaces: 0.
- Criterios de aceite: `contato_empresa` e `fim is null` no repositorio, `empresa` no dominio, `qualificacaoId` no cartao (6), `atribuido` na ficha (2), "Crie seu primeiro Funil" na ficha (1), `temperatur` no cartao (0), "Digite o nome do Contato" no dialogo (2).
- Container `crm-n1-pg-1505` parado; `crm-n1-pg-13` (outra fase) intocado.

## Next Phase Readiness

Pronto para 15-06. O resumo ja carrega os campos que as telas da Fase 15 vao reaproveitar; WR-03/WR-04/IN-05 seguem abertos (D-15-07).

## Self-Check: PASSED
