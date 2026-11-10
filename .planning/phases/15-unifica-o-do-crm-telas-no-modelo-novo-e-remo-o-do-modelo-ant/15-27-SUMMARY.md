---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 27
subsystem: api
tags: [migracao, script-de-dados, registros-crm-antigo, funil, pasta-meus-negocios, docker, tdd, ucr-09]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "011 (registros_crm_antigo, crm_de_para), executar() com lerDoCrm/aoConfirmar, guarda sem-crm-antigo da api, telas ja lendo o CRM novo (15-09..15-26, 15-36, 15-40)"
provides:
  - "npm run migrar:crm-antigo -w @n1/api com --espaco e exatamente um modo: --seco, --guardar, --migrar (--funil=migrar|guardar) ou --verificar"
  - "apps/api/src/migracao-crm/: copiar, conferir e apagar as nove colecoes do CRM antigo de UM Espaco, na transacao de executar(), com rollback provado em Docker"
  - "Funil do CRM antigo para plataforma.funis/etapas (id antigo no Funil, id novo nas Etapas, crm_de_para) sob o lock do padrao do servico de Funis"
  - "Pasta Meus negocios copiada e removida quando todas as Listas estao vazias; relatorio do --seco sem dado pessoal"
affects: [15-28, 15-30, 15-34, 15-35]

plan_head_before: a3422ff767bb8dbd73ebdf6351e72a0c216f96fd
plan_head_after: 3286370fe4bcc5f325b877aa0d8bf9794f951b93
commits: 6

actuals:
  tokens: 31000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "script de dados dentro de UMA executar() travada: lerDoCrm copia e confere, a operacao nao toca nas colecoes antigas, aoConfirmar apaga por SQL"
    - "operacao que devolve fail('nada a fazer') para desfazer sem subir a revisao do Espaco (idempotencia sem escrita)"
    - "conferencia da copia por chave e por conteudo identico (dados e ordem) antes do delete"
    - "emTransacaoSoLeitura: begin read only, o Postgres recusa qualquer escrita (25006)"
    - "CLI testavel: lerArgumentos pura e principal() devolvendo o codigo de saida; so roda como script fora do vitest"

key-files:
  created:
    - apps/api/src/migracao-crm/CONTEXT.md
    - apps/api/src/migracao-crm/colecoes.ts
    - apps/api/src/migracao-crm/formatos-antigos.ts
    - apps/api/src/migracao-crm/guardar.ts
    - apps/api/src/migracao-crm/funil.ts
    - apps/api/src/migracao-crm/funil.test.ts
    - apps/api/src/migracao-crm/pasta-meus-negocios.ts
    - apps/api/src/migracao-crm/pasta-meus-negocios.test.ts
    - apps/api/src/migracao-crm/relatorio.ts
    - apps/api/src/migracao-crm/relatorio.test.ts
    - apps/api/src/migracao-crm/migrar-crm-antigo.ts
    - apps/api/src/migracao-crm/migrar-crm-antigo.test.ts
    - apps/api/src/migracao-crm/migrar.cli.ts
    - apps/api/src/migracao-crm/migrar.cli.test.ts
    - apps/api/src/migracao-crm/fixtures/registros-antigos-minimos.json
  modified:
    - apps/api/package.json
    - apps/api/CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "A conferencia exige copia IDENTICA (dados e ordem) so para o que sai de registros; a Conversa de Grupo, que fica, so exige copia com a mesma chave. Uma copia velha que difere de uma linha reinserida barra o apagar em vez de perder a versao nova"
  - "Repetir diz 'nada a fazer' devolvendo fail() da operacao: executar() desfaz sem subir a revisao, entao os navegadores abertos nao se re-hidratam a toa"
  - "As recusas (Funil sem decisao, registros alem do Funil) saem do lerDoCrm ANTES da cópia: nada é escrito, nem a copia"
  - "Pasta achada so pelo id do seed (fld_meus_negocios), nunca pelo nome: uma Pasta que alguem criou com o mesmo nome nao e tocada"
  - "Etapa no crm_de_para: colecao_antiga='funnels/stages', id_antigo='<funil>/<etapa>' (o id da Etapa so e unico dentro do Funil); --verificar confere a origem pelo Funil"
  - "O Funil preferido como padrao e o defaultFunnelId antigo, se ainda estiver gravado na entidade do Espaco; senao o primeiro elegivel pela ordem"
  - "migrar.cli.ts so executa fora do vitest (process.env.VITEST): vite-node nao deixa o script em argv[1], entao nao da para detectar 'sou o ponto de entrada'"

requirements-completed: []

coverage:
  - id: D1
    description: "--guardar copia byte a byte as nove colecoes para registros_crm_antigo, confere e so entao apaga as oito colecoes e as Conversas sem Grupo; a Conversa de Grupo fica; a revisao sobe 1; nada nasce no CRM novo; outro Espaco fica intacto"
    requirement: UCR-09
    verification:
      - kind: integration
        ref: "apps/api/src/migracao-crm/migrar-crm-antigo.test.ts#guardar o CRM antigo de um Espaço (15-27 Task 1, D-15-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Contagem divergente e excecao injetada depois de inserirFunis desfazem o Espaco inteiro (registros, registros_crm_antigo, crm_de_para, funis, etapas, revisao iguais) e repetir diz nada a fazer"
    requirement: UCR-09
    verification:
      - kind: integration
        ref: "migrar-crm-antigo.test.ts#contagem forçada a divergir; #interrupção: uma exceção no aoConfirmar logo depois de inserir o Funil; #repetir o --migrar diz que não há nada a fazer"
        status: pass
    human_judgment: false
  - id: D3
    description: "--seco abre begin read only (25006 em qualquer escrita), nao escreve e nao imprime dado pessoal; relatorio lista contagens, Funil com Etapas, referencias, Pasta e o que cada modo faria"
    requirement: UCR-09
    verification:
      - kind: integration
        ref: "migrar-crm-antigo.test.ts#--seco: o relatório só lê; relatorio.test.ts#não imprime campo pessoal"
        status: pass
    human_judgment: false
  - id: D4
    description: "--migrar --funil=migrar|guardar: Funil com id antigo e padrao so se o Espaco nao tem padrao, Etapas com id novo e crm_de_para, nome em uso nao migra, recusa antes de escrever (sem --funil e com registros alem do Funil)"
    requirement: UCR-09
    verification:
      - kind: integration
        ref: "migrar-crm-antigo.test.ts#o Funil: --migrar --funil=migrar|guardar; funil.test.ts#planejarFunis"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pasta Meus negocios copiada e removida com Listas e Visualizacoes quando todas as Listas estao vazias; com Tarefa nada sai e o resultado lista a Lista e a contagem"
    requirement: UCR-09
    verification:
      - kind: integration
        ref: "migrar-crm-antigo.test.ts#a Pasta \"Meus negócios\" (15-27 Task 2, D-15-14); pasta-meus-negocios.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "--verificar (oito colecoes fora de registros, so Grupo em conversations, de-para sem orfa, contagem guardada) e a CLI (um modo por vez, --funil so com --migrar, host e Espaco impressos antes de escrever, saida 0/1/2)"
    requirement: UCR-09
    verification:
      - kind: integration
        ref: "migrar-crm-antigo.test.ts#--verificar: a pós-condição do corte; migrar.cli.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "O texto do relatorio e do CONTEXT.md para o dono ler no corte (clareza, o que decidir)"
    verification: []
    human_judgment: true
    rationale: "Os testes provam o conteudo e a ausencia de dado pessoal, nao se o texto e claro para quem decide o Funil; o dono le o --seco real no corte."

duration: ~35min
completed: 2026-11-06
---

# Phase 15 Plan 27: Script migrar:crm-antigo Summary

**`migrar:crm-antigo` guarda o CRM antigo de um Espaço (copia, confere e só então apaga, tudo numa `executar()` com rollback provado em Docker), decide o Funil (`--funil=migrar|guardar`), limpa a Pasta "Meus negócios" e confere o resultado com `--verificar`, sem nunca imprimir dado pessoal.**

## Performance

- **Duration:** ~35 min (início não registrado no relógio; estimado pelos horários dos testes e commits)
- **Completed:** 2026-11-06
- **Tasks:** 3 (TDD: 3 RED + 3 GREEN)
- **Files:** 15 criados e 3 alterados (mais este SUMMARY)

## Accomplishments

- **Guardar sem perda (D-15-01/02, F14-D-03).** `lerDoCrm` copia as nove coleções para `registros_crm_antigo` (`on conflict do nothing`) e confere (chave e conteúdo idêntico) antes de qualquer `delete`; a `operacao` não toca nas nove coleções; `aoConfirmar` apaga por SQL as oito coleções e as Conversas sem Grupo. A Conversa de Grupo é copiada e **fica** em `registros`. Repetir diz "nada a fazer" e nem a revisão sobe.
- **Volta atrás provada em Docker.** Contagem forçada a divergir (gancho apaga uma linha da cópia) e exceção injetada no `aoConfirmar` depois de `inserirFunis`: nos dois casos `registros`, `registros_crm_antigo`, `crm_de_para`, `funis`, `etapas`, `contatos` e a revisão ficam iguais ao antes.
- **Funil (D-15-04).** `planejarFunis` (puro) decide o que migra, o que não (`nome em uso`, `id já existe`, `sem Etapa`, `sem nome`, `Etapas com nome repetido`) e qual nasce padrão; `inserirFunis` insere sob o `pg_advisory_xact_lock(hashtext('funil-padrao:'||ws))` do serviço, reconferindo o padrão. Funil com id antigo; Etapas com id novo e `crm_de_para`.
- **Pasta "Meus negócios" (D-15-14).** Copiada e removida (com Listas e Visualizações) só se todas as Listas estão vazias; com Tarefa em qualquer Lista nada sai e o resultado lista a Lista e a contagem.
- **`--seco` só de leitura.** `begin read only` (insert dentro dele falha com `25006`), relatório com contagens, Funil com Etapas, referências ao Funil, Pasta e o que cada modo faria; teste com campos pessoais na entrada prova que nada pessoal chega ao texto.
- **`--verificar` e a CLI.** Quatro conferências em `begin read only`; `lerArgumentos` exportada e testada (um modo por vez, `--funil` só com `--migrar`, formato `ws_…`); `principal()` devolve 0/1/2 e imprime host (sem usuário nem senha) e Espaço antes de escrever.

## Task Commits

1. **Task 1 (tracer):** RED `6268281` (test) → GREEN `e3cdcc2` (feat)
2. **Task 2:** RED `dc09aef` (test) → GREEN `657c5f4` (feat)
3. **Task 3:** RED `e97cb28` (test) → GREEN `3286370` (feat)

**Plan metadata:** commit `docs(15-27)` seguinte (SUMMARY e WINDOWS.md), depois o de STATE/ROADMAP.

## TDD Gate Compliance

Os seis commits têm a ordem `test(15-27)` → `feat(15-27)` por tarefa; nenhum REFACTOR separado. Os REDs levam esqueletos das funções (retornos neutros) para que os testes executem e falhem pelas asserções, e não por falha de carga.

- **RED 1** (`6268281`): 5 de 7 casos falharam pela asserção do comportamento planejado (`resolved` em vez de `rejects`, contagens de `registros` e da cópia, `nadaAFazer`); os 2 que passaram (Espaço alheio intacto, Espaço sem CRM antigo) são guardas que valem no esqueleto. Avaliação semântica: o alvo executou e falhou no ponto planejado.
- **RED 2** (`dc09aef`): 34 de 47 falharam por asserção (texto vazio do relatório, `funis`/`crm_de_para` vazios, Pasta intacta, `25006` não levantado). Passaram no esqueleto só as guardas vacuosas (privacidade com texto vazio, `planejarPasta` sem a Pasta, "Pasta de outro Espaço intacta"); elas ficam significativas no GREEN. O esqueleto de `emTransacaoSoLeitura` não abria `begin read only`, então o caso do `25006` gravou um Espaço de lixo no Docker, apagado à mão (Docker local, nada em produção).
- **RED 3** (`e97cb28`): 21 de 23 casos novos falharam por asserção; "o `--verificar` só lê" e "depois do `--migrar` a verificação passa" passaram no esqueleto (`ok: true`) e viram guarda real no GREEN (o segundo exige tratar `funnels/stages`).
- O classificador `gsd_run check tdd-red-evidence` não foi usado: `workflow.tdd_mode` está `false` neste projeto; a saída do vitest foi lida e avaliada à mão.

## Verificação

Num contêiner Postgres 16 NOVO (`crm-n1-pg-1527`, porta 55727, migrações 001–012 aplicadas, depois parado):

- `vitest run src/migracao-crm/ src/persistencia/regime-dos-chamadores.test.ts src/sem-crm-antigo.test.ts src/sem-listas-espelho.test.ts`: **8 arquivos, 79 testes, 0 pulados, 0 falhas**.
- `tsc --noEmit` em `apps/api`: 0.
- Critérios de aceite por grep: `on conflict do nothing` em `guardar.ts` (2), `@n1/dominio/types` na pasta (0), `regime` em `migrar-crm-antigo.ts` (0), leitura de coleção antiga pelo `state` (0), `begin read only` (3), `pg_advisory_xact_lock` em `funil.ts` (2), `"migrar:crm-antigo"` em `package.json` (1), flags de modo na CLI (11), `export function lerArgumentos` (1).
- A CLI rodada de verdade (via `npm run`, só contra o Docker local) com `--seco`, `--migrar` recusado, `--guardar` e `--verificar` num Espaço de fumaça: saídas 0/2/0/0, sem o nome sintético no texto. O `lint` é só do `@n1/web` (não há ESLint na api) e a web não foi tocada. Nenhum `npm run build`.

## Decisions Made

Ver `key-decisions` no cabeçalho. A mais importante para o corte: a conferência barra o apagar se a cópia de uma linha que sai não for idêntica à origem, em vez de aceitar uma cópia velha.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Detecção de "sou o script" na CLI**
- **Found during:** Task 3 (CLI)
- **Issue:** `migrar.cli.ts` precisa exportar `lerArgumentos` e ser importável pelo teste sem rodar. O vite-node não deixa o caminho do script em `process.argv[1]`, então não dá para checar "sou o ponto de entrada".
- **Fix:** a CLI só executa quando `process.env.VITEST` não está definida; `principal()` devolve o código de saída e é testada sem processo.
- **Files modified:** `apps/api/src/migracao-crm/migrar.cli.ts`
- **Committed in:** `3286370`

**2. [Rule 2 - Missing critical] Conferência por conteúdo, não só por contagem**
- **Found during:** Task 1
- **Issue:** `count(origem) = count(cópia)` aceitaria uma cópia velha de uma linha reinserida e depois alterada em `registros`, e o `delete` perderia a versão nova.
- **Fix:** `conferirCopia` exige, para o que sai, cópia com `dados` e `ordem` iguais, e para o que fica (Grupo) só a chave.
- **Files modified:** `apps/api/src/migracao-crm/guardar.ts`
- **Committed in:** `e3cdcc2`

### Arquivos além da lista do plano

`funil.test.ts`, `pasta-meus-negocios.test.ts` (planejadores puros, sem banco) e `migrar.cli.test.ts` (a CLI, no lugar de acrescentar tudo ao `migrar-crm-antigo.test.ts`), e a linha em `apps/api/CONTEXT.md` (regra da raiz: atualizar o CONTEXT da camada tocada). Sem custo de escopo.

### Fora do contrato do plano (decisões nossas, registradas)

- O `--guardar` também remove a Pasta "Meus negócios" (o plano só a menciona no `<behavior>` do Task 2, junto do `--migrar`): vale para os dois modos, porque a Pasta deixa de existir na navegação de todo Espaço (D-15-14).
- A etapa do `crm_de_para` usa `colecao_antiga = 'funnels/stages'` e `id_antigo = '<funil>/<etapa>'`; o plano dizia só "id novo para cada Etapa". O 15-28 precisa saber disso.

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 2), mais as decisões acima. **Impact:** nenhuma amplia escopo; a Rule 2 é a que mais protege o dado.

## Known Stubs

Nenhum.

## Linhas abertas em `.planning/WINDOWS.md` (kind `deviation`, fase 15)

- **#50 `migrar-crm-antigo.ts`:** o `--migrar` só cobre o Funil e recusa o Espaço com Contatos, Empresas, Vínculos, Negócios, Canais ou Conversas comuns ("use --guardar"); o mapeador é o 15-28. A decisão do Funil vale antes da primeira escrita.
- **#51 `pasta-meus-negocios.ts`:** a Pasta com Tarefa em qualquer Lista não sai (esperado nos 17 Espaços de teste) e o script não reescreve referências de fora às Listas que remove; no `ws_n1` a Pasta provavelmente nem existe.
- **#52 `funil.ts`:** nenhum id antigo é reescrito e nenhum link/Vínculo/`canaisDeAtendimento` para Negócio, Contato ou Canal antigo é resolvido por este plano.

### O que este plano resolve dos avisos citados: nenhum (e o que o 15-28 precisa fazer)

Nenhum dos avisos #22, #32, #42 e #49 (15-40) é marcado como corrigido. Este plano só **guarda** as linhas antigas com o id original em `registros_crm_antigo` e leva Funil/Etapas ao CRM novo, então:

| Aviso | Por que segue aberto | O que o 15-28 precisa fazer |
|---|---|---|
| #22, #32, #42 (links e Vínculos a ids antigos abrem "não encontrado") | O Negócio, o Contato e a Conversa antigos não existem nas tabelas novas; os ids só ficam recuperáveis na cópia | Preservar o id antigo como id novo ao inserir Contato, Negócio e Conversa (as colunas `id` são `text`), para os links/Vínculos de `registros` voltarem a casar sem reescrita |
| #49 (15-40: `canaisDeAtendimento` com ids do Canal antigo mostra "sem canais") | O Canal antigo não vira linha de `plataforma.canais` | Inserir o Canal com o id antigo (ou gravar o de-para em `crm_de_para` e reescrever `canaisDeAtendimento`); no `ws_n1` a lista de Canais antiga é vazia |
| Etapa do Negócio | O Negócio ainda não migra | Trocar o `stageId` antigo pelo `id_novo` da linha `('funnels/stages', '<funil>/<etapa>')` de `crm_de_para` |
| Catálogo | Não é deste plano | Gravar o id do Catálogo na qualificação do Contato (15-05) |

## Issues Encountered

- O caso do `25006` no RED 2 deixou um Espaço de lixo no Docker (o esqueleto não abria transação só de leitura); apagado à mão, só no contêiner local.
- Nenhum teste tocou o banco de produção, nenhum `.env` foi lido pelo agente (a `carregarEnv()` do código só preenche variáveis que faltam, e todos os comandos passaram as duas URLs do Docker). O disco tinha 6,9 GiB livres no fim; nenhum `build`; o contêiner foi parado e nenhum `supabase_*` foi tocado.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto para o 15-28 (mapeador de entidades, que tira a recusa "além do Funil") e para o ensaio (15-30) e o corte (15-34/15-35), que rodam o `--seco`, guardam a contagem por coleção e conferem com a de `--verificar`.
- Antes do corte, o dono lê o `--seco` do `ws_n1` e decide `--funil=migrar` ou `--funil=guardar`; o relatório lista o Funil, as Etapas, o que aponta para ele e a Pasta.
- `requirements-completed` fica vazio de propósito: UCR-09 é declarado também pelo 15-28, 15-34 e 15-35, e `requirements.ready-ids` respondeu 0/1.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivos criados conferidos no disco (`[ -f ]`): os 15 de `key-files.created`.
- Commits `6268281`, `e3cdcc2`, `dc09aef`, `657c5f4`, `e97cb28` e `3286370` são ancestrais do HEAD.
- Acceptance criteria das três tarefas e o `<verification>` do plano reexecutados num contêiner novo: todos passam.
