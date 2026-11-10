---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 31
subsystem: dominio
tags: [seed, crm-antigo, semearCrmAntigo, tdd, ucr-11, d-15-13, tres-camadas]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "bootstrap:crm-demo (15-29), que carrega nas tabelas novas, com os ids antigos, o CRM que o seed construia"
provides:
  - "buildSeed() sem Contato, Empresa, Vinculo, Funil, Negocio, Canal nem Conversa 1:1, sem a Pasta Meus negocios e sem as Listas espelho; so as duas Conversas de Grupo (F14-D-05)"
  - "semearCrmAntigo(estado) em packages/dominio/src/seed-crm-antigo.ts: o construtor antigo, conferido contra o seed anterior, so para testes de codigo que sai"
  - "as referencias por id (Vinculos de Tarefa, Proveniencia com nome, cliente de Contas a receber cnt_cr_*, Participacoes e Canal de Grupo, ancoras e escopos de Funil) continuam no seed"
affects: [15-32, 15-33, 15-41, 15-42, 15-43]

plan_head_before: b1c61019d64158f8cfec1076134d3278367362d8
plan_head_after: 6825c12e5d19a0d02fd16d58c6b85ad4aa6c426e
commits: 6

actuals:
  tokens: 80000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "o construtor do modelo que sai fica num arquivo so de teste (semearCrmAntigo), devolve o proprio estado para caber em semearCrmAntigo(buildSeed()), e a guarda sem-crm-antigo o lista como congelado"
    - "a fidelidade do construtor movido foi medida contra uma foto do seed anterior: mesmas colecoes, mesmos ids e dados (so a ordem de views, lists, tasks e links e o numero dos ids de nextId diferem)"
    - "provas negativas do modelo antigo montam o registro antigo no proprio arranjo (testes/crm-antigo-de-teste.ts na web), em vez de herda-lo do seed"

key-files:
  created:
    - packages/dominio/src/seed-crm-antigo.ts
    - packages/dominio/src/seed-sem-crm-antigo.test.ts
    - apps/api/src/testes/canal-antigo.ts
    - apps/web/src/testes/crm-antigo-de-teste.ts
    - apps/web/src/features/estrutura/tarefa-conversacional-de-teste.ts
  modified:
    - packages/dominio/src/seed.ts
    - packages/dominio/src/seed-comercial.ts
    - packages/dominio/src/seed-pos-venda.ts
    - packages/dominio/src/seed-produto.ts
    - packages/dominio/src/seed-ferramentas.ts
    - packages/dominio/src/seed-contas-a-receber.ts
    - packages/dominio/src/sem-crm-antigo.test.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/bootstrap/CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "semearCrmAntigo devolve o estado (o plano o escreve como semearCrmAntigo(buildSeed()))"
  - "o atalho Caixa de entrada do Espaco Comercial fica no seed: nao e CRM, e a Pasta e as Listas espelho que saem"
  - "as Participacoes de Grupo e a Proveniencia da Pos-venda guardam o que antes liam do Contato (numero de WhatsApp calculado pela mesma formula, nome escrito), sem ler colecao do CRM"
  - "ferramentas.test.ts usa semearCrmAntigo por divida registrada (WINDOWS): reescrever as 933 linhas passou do escopo"

requirements-completed: [UCR-11]

coverage:
  - id: D1
    description: "buildSeed() nasce sem as oito colecoes do CRM antigo, so com as duas Conversas de Grupo, sem a Pasta Meus negocios e sem Listas, Tarefas e Visoes espelho; duas chamadas devolvem estados iguais"
    requirement: UCR-11
    verification:
      - kind: unit
        ref: "packages/dominio/src/seed-sem-crm-antigo.test.ts#buildSeed() sem o CRM antigo (15-31, UCR-11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "As referencias por id que o seed guarda (Vinculos, Proveniencia, cliente de Contas a receber, Participacoes, Canal de Grupo) continuam, e semearCrmAntigo reconstroi o CRM antigo com as contagens da fixture do 15-28 e prova que cada id citado existe, que a Conversa de cada Tarefa de Pos-venda e do Contato dela e que o numero das Participacoes e o do Contato"
    requirement: UCR-11
    verification:
      - kind: unit
        ref: "packages/dominio/src/seed-sem-crm-antigo.test.ts#semearCrmAntigo(buildSeed())"
        status: pass
    human_judgment: false
  - id: D3
    description: "Os ids preservados acham o registro depois do bootstrap:crm-demo: a prova dos Vinculos agora le a fixture congelada (64 links) e exige procurados > 0"
    requirement: UCR-11
    verification:
      - kind: integration
        ref: "apps/api/src/bootstrap/crm-demo.test.ts#todo Vínculo do seed para Contato, Empresa, Negócio ou Conversa que o demo carrega acha o registro nas tabelas"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dominio (129 arquivos, 2464 testes), api e web passam com o seed novo; os dois testes da api que falharam no gate completo passam rodados sozinhos"
    requirement: UCR-11
    verification:
      - kind: other
        ref: "npm run check em Postgres 16 novo com as duas URLs explicitas (ver Verificacao)"
        status: pass
    human_judgment: false
  - id: D5
    description: "O que o dono ve a mais ou a menos num estado semeado do zero (Automacao de Lista espelho inoperante, Flow sem envios, Reunioes sumidas do seed do produto) e aceitavel"
    verification: []
    human_judgment: true
    rationale: "Sao deviations abertas em .planning/WINDOWS.md; nenhuma tela foi aberta sobre um Espaco semeado sem o CRM."

duration: 31min
completed: 2026-11-06
---

# Phase 15 Plan 31: O seed sem o CRM antigo Summary

**`buildSeed()` nasce sem Contatos, Empresas, Funis, Negócios, Canais, Conversas 1:1, sem a Pasta "Meus negócios" e sem as Listas espelho; o construtor antigo, conferido contra o seed anterior, mora em `seed-crm-antigo.ts` (`semearCrmAntigo`) só para testes de código que sai, e as três camadas passam.**

## Performance

- **Duração:** ~31 min de relógio (20:26 a 20:57 UTC), mais a espera dos gates em Docker.
- **Tarefas:** 3 (a 1 é o traçador, TDD: 1 RED + 1 GREEN; as tarefas 2 e 3 ajustam testes).
- **Arquivos:** 5 criados, 59 alterados no total (`git diff --stat`: 2861 inserções, 1852 remoções).

## Accomplishments

- **Traçador (Task 1).** `seed.ts` perdeu Funis, Empresas, Contatos, Negócios, Canais (e os modelos de mensagem), Conversas, a atividade derivada deles e `applyEspelhoComercial`; `seed-comercial.ts` ficou só com `MEUS_NEGOCIOS_ID` (a Estrutura ainda protege a Pasta até o 15-41). O código removido foi para `semearCrmAntigo(estado)`: as mesmas linhas de construção, mais o que os outros seeds faziam sobre o CRM (os quatro clientes de Contas a receber, `groupsEnabled` no Canal, a Tag "Em grupo de alunos" nos Contatos, os Envios de Flow nas Conversas, a Atividade do CRM e o espelho).
- **Fidelidade medida, não presumida.** Antes de mexer, o seed foi despejado em JSON no scratchpad; `semearCrmAntigo(buildSeed())` foi comparado coleção a coleção com a foto (ids de `nextId` normalizados): todas as coleções são iguais como conjunto. Só diferem a ORDEM de `views`, `lists`, `tasks`, `links` e `activity` (o espelho entra no fim) e a posição de uma chave em um objeto.
- **Referências que ficam, calculadas sem ler o CRM.** Pós-venda guarda o nome do Contato na Proveniência; Contas a receber guarda o id e o dono dos quatro clientes (`cnt_cr_*`); as Participações de Grupo usam o número de WhatsApp calculado pela mesma fórmula do seed antigo e o Canal participante usa `chn_wpp` com `+5511987654321`. O teste novo prova, contra o CRM reconstruído, que cada número, nome e Conversa bate com o Contato.
- **Guarda por camada.** No domínio, `seed-crm-antigo.ts` entrou em `CONGELADOS` e os seis `seed*.ts` saíram (grep abaixo). Na api e na web a lista não mudou: nenhum arquivo de produção delas foi migrado aqui.
- **Testes das três camadas.** Domínio 129 arquivos verdes; api e web ajustadas (lista por arquivo abaixo). `crm-demo.test.ts` passou a ler os 64 `links` da fixture congelada e exige `procurados > 0`.

## Task Commits

1. **Task 1 (tracer):** RED `eecc688` (test: 9 casos, 4 vermelhos; esqueleto de `semearCrmAntigo`) -> GREEN `cefea70` (feat: seed sem CRM antigo, construtor isolado, guarda, seed-produto/seed-ia)
2. **Task 2:** `2449ab6` (test: testes do domínio no seed novo)
3. **Task 3:** `e343d6e` (test: api e web), `57f1b7c` (cor crua do auxiliar da web, achada pelo `verificar:tokens` do gate), `6825c12` (comentário do auxiliar da web, achado pela guarda `sem-crm-antigo` do gate; CONTEXT da api)

**Metadados do plano:** commit `docs(15-31)` seguinte (SUMMARY e WINDOWS.md), depois o de STATE/ROADMAP.

## TDD Gate Compliance

`test(15-31)` (`eecc688`) precede `feat(15-31)` (`cefea70`). `workflow.tdd_mode` é `false`: `gsd_run check tdd-red-evidence` não foi usado e a saída do vitest foi lida à mão.

- **RED** (`eecc688`): 4 de 9 falharam pela asserção contra o seed ainda cheio (coleções com 39 Contatos, 23 Conversas, a Pasta presente, estados diferentes). Avaliação semântica: o alvo executou e falhou no comportamento planejado. **Os outros 5 já passavam**: os casos de `semearCrmAntigo(buildSeed())` passam com o esqueleto porque o seed ainda tinha o CRM, e os de "referências ficam" e "Grupo fica" são de proteção, não de descoberta. Está dito aqui, não escondido.
- **GREEN** (`cefea70`): 11 de 11 verdes depois de ligar o construtor. Nenhum REFACTOR separado.
- As tarefas 2 e 3 são ajuste de testes (os que falhavam no seed novo já estavam vermelhos antes do commit da tarefa 2).

## Arquivos de teste tocados e a regra aplicada

**Domínio** (regra do plano: `semearCrmAntigo(buildSeed())` para código que sai; os demais montam o que usam):

| Arquivo | Regra |
|---|---|
| `operations/{contacts,conversations,deals,canais,capacidades-do-canal}.test.ts`, `derive-conversacional-antigo.test.ts` | `state = semearCrmAntigo(buildSeed())` (15-32 / 15-42 os apagam) |
| `operations/operations.test.ts` | `estadoComCrmAntigo()` no `beforeEach` dos 27 blocos de operação antiga; "Espelho comercial" apagado; "Volumes do seed" reescrito para o seed novo, com um caso que prova os limítrofes do CRM no estado reconstruído |
| `operations/ferramentas.test.ts` | `semearCrmAntigo(buildSeed())` **por dívida** (não está na lista do plano; ver desvios) |
| `derive-conversacional.test.ts` | monta o Canal e o par Contato/Negócio mínimos que usa |
| `derive-resumo.test.ts` | a base de tempo sai de um Membro (não do Contato `cnt_31`); o caso das Reuniões passou ao seed completo |
| `leitura-de-widget-do-crm.test.ts`, `operations/ancora-do-chat.test.ts` | põem o Negócio/Contato do modelo antigo que a leitura não pode usar |
| `operations/ia/agentes.test.ts` | ids em vez de registros do seed |
| `operations/ia/automacoes.test.ts`, `seed-ia.test.ts` | os quatro Funis do demo como `funis`; a Automação de Lista espelho é esperada inoperante |
| `operations/contas-a-receber.test.ts`, `recusas-sem-codigo.test.ts`, `restaurar-lista-e-parcelas.test.ts` | clientes do demo por constante |
| `operations/alterar-papel-do-membro.test.ts` | põe um Contato da Júlia |
| `operations/mover-conteiner.test.ts` | os casos A9 montam a Pasta no arranjo |
| `seed-produto.test.ts` | reescrito para o seed novo |
| `derive-visibilidade.test.ts` | **não precisou de edição**: passa com o seed novo (estava na lista do plano) |

**API:** `persistencia/canais-projetados.test.ts` (`semearCrmAntigo`, como o plano manda); `e2e/canais-fluxo.test.ts` e `rotas/operacoes-canais-da-lista.test.ts` (montam o Canal antigo por `testes/canal-antigo.ts`); `seguranca/matriz-de-papeis.test.ts` e `rotas/operacoes.test.ts` (Contatos do vazamento, `contatosDoVazamento` em `testes/espaco-de-vazamento.ts`; **fora da lista do plano**); `bootstrap/crm-demo.test.ts` (fonte dos Vínculos). `persistencia/unidade-de-trabalho-em-lote.test.ts` **não precisou de edição**.

**Web:** `shell/{arvore-arrastavel,arvore-menu}.test.tsx` e `estrutura/mover-conteiner-dialog.test.tsx` (casos A9 montam a Pasta e uma Lista); `crm/{paginas-de-contato,paginas-de-empresa,ficha-de-negocio,pagina-da-conversa}.test.tsx`, `shell/{busca-e-lixeira-do-crm,membro-sucessao-no-crm,membros-sucessao-no-crm,use-notificacoes}.test.tsx`, `inicio/inicio-no-crm-novo.test.tsx`, `notificacoes/notificacoes.test.tsx`, `paineis/painel-no-crm-novo.test.tsx` e `ferramentas/ferramentas-no-crm-novo.test.tsx` (provas negativas: montam o registro antigo por `testes/crm-antigo-de-teste.ts`); `estrutura/{tarefa-completa-gestos,tarefa-completa-resumo,pagina-da-lista-visualizacoes}.test.tsx` (montam a Tarefa/Lista espelho por `tarefa-conversacional-de-teste.ts`). `crm/{conectar-canal,conectar-provedor}.test.tsx` **não precisaram de edição**. `grep -rl semearCrmAntigo apps/web/src` = 0.

## Verificação

Num Postgres 16 NOVO (`crm-n1-pg-1531`, porta 55731, migrações 001-012), duas URLs explícitas; o contêiner foi removido em cada rodada.

- `npm run check` (`<automated>` da Task 3), 2ª rodada: typecheck e lint ok (2 avisos antigos, de `ia/conhecimento/rotulos.ts` e `shell/app-shell.tsx`); `verificar:tokens` ok; `verificar:contratos` pulou (repositório irmão ausente); **domínio 129 arquivos, 2464 testes, todos verdes**; **web 1297 de 1298** (a falha era a guarda `sem-crm-antigo` achando um comentário do meu auxiliar; corrigido e a guarda rodada de novo: 3 arquivos, 11 testes verdes); **api 2428 de 2430**, com 2 falhas de baseline.
- A 1ª rodada do `npm run check` parou em `verificar:tokens` (cor crua no auxiliar da web); corrigido em `57f1b7c`.
- **Flakes provados rodando sozinhos:** `outbox-worker.test.ts` (caso k), arquivo isolado num contêiner NOVO: 15 de 15. `automacoes/invocar-agente.test.ts` (caso m, "timeout três vezes"), isolado: 108 de 108 (é teste de tempo, sem banco). Nenhum dos dois toca o seed.
- `<automated>` da Task 1: `vitest run seed-sem-crm-antigo sem-crm-antigo seed-produto seed-ia` + `tsc --noEmit`: verdes. `<automated>` da Task 2: suíte do domínio inteira + `tsc`: verdes.
- Aceite por grep: `grep -l semearCrmAntigo` nos seis `seed*.ts` = 0; `export function semearCrmAntigo` em `seed-crm-antigo.ts` = 1; nos seis testes "reescritos" do domínio = 0; em `apps/web/src` = 0; nenhum arquivo de produção o importa (os 12 arquivos que o citam são testes, o próprio construtor e o CONTEXT).
- Guarda do domínio, prova de que os arquivos migrados não casam mais com a regex: um script com a mesma regex sobre `seed.ts`, `seed-comercial.ts`, `seed-contas-a-receber.ts`, `seed-ferramentas.ts`, `seed-pos-venda.ts` e `seed-produto.ts` devolveu `false` nos seis.
- Nenhum `.env` lido, nenhum `npm run build`, nada contra banco remoto, `~/n1-ensaio` intocado, nenhum contêiner `supabase_*` tocado; `apps/web/.next` já existia e não foi criado por mim.

## Decisions Made

Ver `key-decisions`. A que mais pesa: o seed guarda as referências por id sem ler o CRM (nome escrito, número calculado), e um teste contra o CRM reconstruído prova que elas batem com o Contato.

## Deviations from Plan

**1. [Rule 3 - Blocking] Mais testes quebraram do que a lista do plano.**
- **Found during:** Tasks 2 e 3.
- **Issue:** o seed novo derrubou também `operations/ferramentas.test.ts`, `derive-resumo`, `leitura-de-widget-do-crm`, `ancora-do-chat`, `ia/agentes`, `ia/automacoes`, `contas-a-receber` (domínio); `matriz-de-papeis`, `rotas/operacoes`, `rotas/operacoes-canais-da-lista` (api); e na web as provas negativas e as fichas da Tarefa. O truth do plano previa esse caso ("o executor aplica a mesma regra e registra o arquivo").
- **Fix:** a regra do plano para todos, menos `ferramentas.test.ts`, que usa `semearCrmAntigo` (item 2).
- **Commits:** `2449ab6`, `e343d6e`.

**2. [Rule 4 limitada - dívida registrada] `operations/ferramentas.test.ts` usa `semearCrmAntigo`.** O arquivo (933 linhas, 108 referências ao Canal, Contatos e Conversas do CRM antigo e aos Envios de Flow semeados) é de Grupo/Flow, que ficam até as Sessões 6 e 7; o 15-43 apaga `semearCrmAntigo`. Reescrevê-lo estourava o plano. Linha aberta em WINDOWS.md; o 15-43 precisa dar a ele Canal, Contatos e Conversas próprios antes de apagar o construtor.

**3. O truth "Mensagens de Flow do seed continuam" não pôde ser cumprido ao pé da letra.** Os Envios e Respostas de Flow moravam dentro das Conversas `cnv_5/9/13/17`, que são do CRM 1:1 e saíram. O Flow, as Versões, os Grupos e as Conversas de Grupo ficam; os 4 Envios (4 Mensagens e 2 Registros de Atividade), a Tag "Em grupo de alunos" nos Contatos e o `groupsEnabled` do Canal saíram. `semearCrmAntigo` os refaz. Linha aberta.

**4. O atalho "Caixa de entrada" do Comercial ficou no seed**, o plano só manda sair a Pasta e as Listas espelho. O `applyEspelhoComercial` o criava; ele passou ao `seed.ts`.

**5. `seed-comercial.ts` não foi apagado**: ficou com `MEUS_NEGOCIOS_ID`, que `estruturas-fixas.ts`, a Estrutura e a web importam; sai com a proteção da Pasta no 15-41. `rehomeMeetings`, de `seed-produto.ts`, saiu (morta sem a Pasta).

**6. Entradas velhas de `CONGELADOS` do domínio ficaram.** Onze arquivos que **outros planos** migraram (`derive-ia.ts`, `operations/ai.ts`, `operations/ferramentas/*`, `operations/financeiro.ts`, `operations/ia/*`, `operations/importacao-contas-a-receber.ts`) já não casam com a regex e continuam listados; o comentário da guarda deixa a metade "a lista só encolhe" para o 15-43. Removi só os seis seeds deste plano.

**Total deviations:** 1 auto-fixed (Rule 3), 1 dívida registrada, 4 decisões nossas. **Impact:** nenhum amplia o escopo do contrato; as consequências visíveis estão nas linhas de WINDOWS.

## Known Stubs

Nenhum. (`semearCrmAntigo` e os auxiliares de teste são dado de teste por desenho, não stub.)

## Linhas em `.planning/WINDOWS.md` (fase 15)

**Resolvida (1):** a #56 (`crm-demo.test.ts`, aberta pelo 15-29) passou a `fixed`: o teste lê os 64 `links` da fixture, confere que todo Vínculo do seed novo está nela e exige `procurados > 0`; prova em `crm-demo.test.ts` (verde na rodada completa da api). **Novas, abertas (4, todas `deviation`):**

- `seed.ts`: a Automação `aut_clo_proposta` (escopo `lst_funil_closer`) e as Ações `criar_tarefa` com alvo `lst_funil_*` apontam para Listas que saíram; num estado novo ela nasce inoperante ("escopo eliminado (Lista)").
- `seed-ferramentas.ts`: Envios de Flow, Tag "Em grupo de alunos" e `groupsEnabled` saíram com o CRM; o demo não liga Grupos no Canal.
- `operations/ferramentas.test.ts`: depende de `semearCrmAntigo`; o 15-43 precisa montar fixture própria.
- `seed-produto.ts`: as Reuniões (`tsk_reuniao_*`, `tsk_call_ref`) saem do seed do produto, e `buildProductSeed()` fica sem Tarefa de hoje para o Thiago.

## Issues Encountered

- A 1ª rodada do gate parou em `verificar:tokens` e a 2ª achou o comentário que citava o campo na guarda da web; ambos corrigidos em commits próprios.
- Uma rodada intermediária da suíte da api rodou com 120 s de espera e foi para o fundo; refeita com reporter JSON para listar os arquivos que falhavam.
- Nada mais: nenhum disco apertado, nenhum contêiner ficou de pé.

## User Setup Required

None - no external service configuration required. Para ver a Caixa e o CRM de demonstração num Espaço novo de desenvolvimento: `bootstrap:crm-demo` (15-29).

## Next Phase Readiness

- Pronto para o 15-32 (apagar as operações antigas): os testes que as exercitam já usam `semearCrmAntigo` e podem ser apagados com elas; falta só decidir o destino das linhas abertas acima.
- `requirements-completed: [UCR-11]`: marcado ao fim do plano se `requirements.ready-ids` confirmar que o 15-29 e este são os únicos que o declaram.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivos criados conferidos no disco (`[ -f ]`): os 5 de `key-files.created`.
- Commits `eecc688`, `cefea70`, `2449ab6`, `e343d6e`, `57f1b7c` e `6825c12` são ancestrais do HEAD; `git log --grep` encontra 1 `test(15-31)` antes do `feat(15-31)`; `git rev-list --count b1c6101..HEAD` = 6.
- O `<verification>` do plano foi reexecutado depois das correções (gates completos e arquivos isolados), como descrito em Verificação.
