---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 28
subsystem: api
tags: [migracao, mapeador, crm-de-para, fixture-do-seed, docker, tdd, ucr-09]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "script migrar:crm-antigo do 15-27 (guardar, Funil com crm_de_para funnels/stages, --seco, --verificar), tabelas 007/008/011/012"
provides:
  - "mapeador puro planejarMigracao: linhas antigas -> linhas das tabelas novas + crm_de_para + relatorio de nao migrados"
  - "inserirPlano: um insert em lote por tabela (jsonb_to_recordset, colunas explicitas) na ordem das FKs, dentro da executar() do Espaco"
  - "--migrar leva Contatos, Empresas, vinculos, Negocios, Canais, Conversas e Mensagens com ids antigos preservados; a recusa 'alem do Funil' do 15-27 saiu"
  - "secao 'Linhas nas tabelas novas' e 'Nao migrados' (so colecao e id, por categoria) no --seco e no resumo do --migrar"
  - "fixture congelada crm-antigo-do-seed.json (buildSeed() sintetico de antes da 3.5.3) e o teste de integracao da fixture inteira"
affects: [15-29, 15-30, 15-34, 15-35]

plan_head_before: cfa70fe0c3726b2da20e49da6f6add127cd3d62e
plan_head_after: 97ddc3f1040de55daaf024481043a603e099a5a1
commits: 8

actuals:
  tokens: 44000
  tasks: 3
  commits: 8

tech-stack:
  added: []
  patterns:
    - "mapeador PURO com a decisao das constraints do banco (admin da Empresa, lixeira, mesclado, unicidade) antes do insert: o que o banco recusaria vai para o relatorio em vez de derrubar o commit do Espaco"
    - "insert em lote por jsonb_to_recordset com lista de colunas de constantes e valores so por parametro; chunk de 500; ordem por posicao (a seq da Mensagem e uma identity)"
    - "id antigo vira id novo (Contato, Empresa, Funil, Negocio, Canal, Conversa, Mensagem); id novo so onde a chave nao e unica (Etapa, Identificador, vinculo) com linha em crm_de_para"
    - "o Negocio carrega o id ANTIGO da Etapa e o inserirPlano o troca pelo id novo lido de crm_de_para (funnels/stages)"

key-files:
  created:
    - apps/api/src/migracao-crm/mapeador.ts
    - apps/api/src/migracao-crm/mapeador.test.ts
    - apps/api/src/migracao-crm/inserir.ts
    - apps/api/src/migracao-crm/crm-novo.ts
    - apps/api/src/migracao-crm/nao-migrados.ts
    - apps/api/src/migracao-crm/migrar-entidades.test.ts
    - apps/api/src/migracao-crm/fixtures/crm-antigo-do-seed.json
  modified:
    - apps/api/src/migracao-crm/formatos-antigos.ts
    - apps/api/src/migracao-crm/migrar-crm-antigo.ts
    - apps/api/src/migracao-crm/migrar-crm-antigo.test.ts
    - apps/api/src/migracao-crm/funil.ts
    - apps/api/src/migracao-crm/relatorio.ts
    - apps/api/src/migracao-crm/relatorio.test.ts
    - apps/api/src/migracao-crm/migrar.cli.ts
    - apps/api/src/migracao-crm/CONTEXT.md
    - apps/api/CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "O id antigo e o id novo para Contato, Empresa, Funil, Negocio, Canal, Conversa e Mensagem: e o que faz Vinculo de Tarefa, provenance, escopo e canaisDeAtendimento (em registros, nao reescritos) acharem o registro. Identificador, vinculo Contato-Empresa e Etapa ganham id novo e uma linha de crm_de_para"
  - "O mapeador decide as constraints do banco ANTES do insert: Empresa fora da lixeira sem vinculo admin vigente nao migra (nem os Negocios dela); na lixeira migra, porque a 007 so exige admin fora dela"
  - "Negocio so migra para um Funil e uma Etapa que passam a existir; com --funil=guardar nenhum Negocio migra (nao ha Funil) e o relatorio diz"
  - "Valor de Identificador que a regra canonica nova recusa e preservado (aparado) em vez de perdido; o canonico novo do WhatsApp tem o + (5511970000000 vira +5511970000000)"
  - "Contato mesclado cujo sobrevivente nao migra entra arquivado (a FK de mesclado nao e adiavel); Conversa de Contato mesclado nao e redirecionada ao sobrevivente"
  - "Conversa na lixeira mantem o Atribuido (a lixeira do servico novo tambem nao o limpa); a mais recente vence a colisao de par, e uma aberta que o CRM novo ja tem no par vence todas as antigas"
  - "Mensagem de Flow migra sem o Flow e o relatorio avisa (Flow fica no modelo antigo)"
  - "Campos personalizados de Contato e Empresa entram em campos_adicionais com o id da Definicao como chave; valor em lista e campo arquivado ficam de fora (relatorio campo-nao-simples)"

requirements-completed: []

coverage:
  - id: D1
    description: "O mapeador converte Contato, Identificador, Empresa, vinculo, Negocio, Canal, Conversa e Mensagem para as linhas das tabelas novas respeitando as constraints da 007/008/011, com de-para por registro"
    requirement: UCR-09
    verification:
      - kind: unit
        ref: "apps/api/src/migracao-crm/mapeador.test.ts (44 casos, sem banco)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A fixture inteira do seed migra num Espaco de Docker sem erro de commit; as contagens sao as da fixture menos os nao migrados; o Negocio aponta para a Etapa nova do mesmo nome; a qualificacao leva o id do Catalogo; Canal, Conversa, Contato, Empresa e Negocio mantem o id antigo"
    requirement: UCR-09
    verification:
      - kind: integration
        ref: "apps/api/src/migracao-crm/migrar-entidades.test.ts#fixture inteira: migra sem erro de commit; #o Negocio aponta para a Etapa NOVA; #a Mensagem recebida ganha migrado:<id>"
        status: pass
    human_judgment: false
  - id: D3
    description: "Todo Vinculo de Tarefa do seed que aponta para Contato, Negocio ou Conversa migrados acha o id nas tabelas novas (WINDOWS 22, 32, 42, 49, 50, 52)"
    requirement: UCR-09
    verification:
      - kind: integration
        ref: "apps/api/src/migracao-crm/migrar-entidades.test.ts#fixture inteira: todo Vinculo de Tarefa do seed ... acha o id"
        status: pass
    human_judgment: false
  - id: D4
    description: "Repetir o --migrar deixa as mesmas contagens nas tabelas novas e em crm_de_para; uma excecao depois de inserirPlano desfaz registros, registros_crm_antigo, crm_de_para e as tabelas novas"
    requirement: UCR-09
    verification:
      - kind: integration
        ref: "apps/api/src/migracao-crm/migrar-entidades.test.ts#repetir; #interrupcao"
        status: pass
    human_judgment: false
  - id: D5
    description: "O relatorio 'Nao migrados' (--seco e resumo do --migrar) lista por categoria a contagem e os ids, sem dado pessoal, e o --seco nao escreve"
    requirement: UCR-09
    verification:
      - kind: unit
        ref: "apps/api/src/migracao-crm/relatorio.test.ts#a secao Nao migrados"
        status: pass
      - kind: integration
        ref: "apps/api/src/migracao-crm/migrar-entidades.test.ts#--seco mostra o que o --migrar leva"
        status: pass
    human_judgment: false
  - id: D6
    description: "O texto do relatorio e a decisao do dono sobre aceitar o que fica de fora (temperatura, Tags, Canal do chat do site e LinkedIn, Negocio de Empresa sem admin...)"
    verification: []
    human_judgment: true
    rationale: "Os testes provam o conteudo e a ausencia de dado pessoal, nao se a lista de nao migrados e aceitavel para cada Espaco; o dono le o --seco de cada Espaco antes do corte (15-34/15-35)."

duration: ~32min
completed: 2026-11-06
---

# Phase 15 Plan 28: Mapeador de entidades do migrar:crm-antigo Summary

**O `--migrar` do `migrar:crm-antigo` agora leva Contatos, Empresas, vínculos, Negócios, Canais, Conversas e Mensagens do CRM antigo para as tabelas novas com os ids antigos preservados, mandando para um relatório de "não migrados" (só coleção e id) tudo o que o banco novo recusaria ou não tem onde guardar, e a fixture inteira do seed migra em Docker, repetível e com volta atrás provada.**

## Performance

- **Duration:** ~32 min (16:14 a 16:46, horário local; o início não foi gravado no relógio, estimado pelos arquivos lidos e pelos commits)
- **Tasks:** 3 (TDD: 3 RED + 3 GREEN, mais um commit só de teste e um de CONTEXT.md)
- **Files:** 7 criados e 10 alterados (mais este SUMMARY)

## Accomplishments

- **Mapeador puro (`mapeador.ts`).** `planejarMigracao(linhasAntigas, crmNovoDoEspaco, { gerarId, funisMigrados })` devolve as linhas por tabela (com o nome das colunas), o `crm_de_para` e os não migrados. As constraints são decididas ali, não no `commit`: Empresa sem vínculo `admin` vigente sai (e os Negócios dela), Contato mesclado depois do sobrevivente, Conversa na lixeira entra `resolvida` com `na_lixeira_em`, uma Conversa não resolvida por par Contato+Canal, Canal único por nome e conta entre os ativos, Identificador único, Mensagem recebida com `migrado:<id>` e ator `integration` do Canal, enviada com `status_entrega`, interna sem id externo, resposta só para Mensagem anterior da mesma Conversa.
- **Ids preservados.** O id antigo é o id novo (Contato, Empresa, Funil, Negócio, Canal, Conversa, Mensagem). O Identificador, o vínculo Contato-Empresa e a Etapa têm id novo e uma linha de `crm_de_para`; a Etapa do Negócio é trocada pelo id novo da linha `funnels/stages` (15-27) no `inserirPlano`. O Catálogo vai como id em `contatos.qualificacao` e `origem`.
- **`inserir.ts`.** Um `insert ... select` por tabela com `jsonb_to_recordset`, colunas de constantes e valores só por parâmetro (T-15-69), em pedaços de 500, na ordem das FKs; `jsonb` nulo passa por `nullif(..., 'null'::jsonb)` para não satisfazer `mensagens_conteudo_ck` por engano.
- **Fixture do seed e prova em Docker.** `crm-antigo-do-seed.json` (39 Contatos, 12 Empresas, 30 vínculos, 1 Empresa-Empresa, 1 "distinto de", 4 Funis, 19 Negócios, 5 Canais, 23 Conversas e 64 `links`) migra inteira: 39 Contatos, 75 Identificadores, 12 Empresas, 24 Identificadores de Empresa, 30 vínculos, 23 Etapas (4 Funis), 19 Negócios, 3 Canais, 16 Conversas, 62 Mensagens, 45 consentimentos e 280 linhas de `crm_de_para`; `--verificar` responde ok.
- **Relatório de não migrados.** `--seco` e o resumo do `--migrar` ganham "Linhas nas tabelas novas" e "Não migrados (continuam só em registros_crm_antigo)": 160 itens em 16 categorias no seed (35 temperaturas, 25 Tags, 32 Identificadores sem destino, 27 marcas de Empresa principal, 19 Negócios com detalhes perdidos, 2 Canais e 5 Conversas sem destino, 4 Mensagens de Flow sem o Flow...), até 20 ids por categoria.
- **Os avisos do WINDOWS.** Marcados corrigidos com prova de teste: #22, #32, #42, #49, #50 e #52 (ver abaixo).

## Task Commits

1. **Task 1 (tracer):** RED `534b7e6` (test) -> GREEN `3b858fd` (feat)
2. **Task 2:** RED `7ee3701` (test) -> GREEN `60dfe6f` (feat)
3. **Task 3:** RED `2b9f25b` (test) -> GREEN `c6ad9b3` (feat)
4. Extras: `23c724e` docs (CONTEXT.md do `migracao-crm` e da api), `97ddc3f` test (prova dos ids de Contato, Empresa e Negócio)

**Plan metadata:** commit `docs(15-28)` seguinte (SUMMARY e WINDOWS.md), depois o de STATE/ROADMAP.

## TDD Gate Compliance

Os seis commits têm a ordem `test(15-28)` -> `feat(15-28)` por tarefa; nenhum REFACTOR separado. O classificador `gsd_run check tdd-red-evidence` não foi usado (`workflow.tdd_mode` é `false`); a saída do vitest foi lida e avaliada à mão.

- **RED 1** (`534b7e6`): 10 de 12 casos falharam pela asserção (Contatos e Identificadores vazios, `ErroDeUso` de "além do Funil" no teste de Docker); os 2 que passaram são guardas vacuosas (contagem da fixture; relatório só com coleção e id). Os esqueletos de `planejarMigracao` e `inserirPlano` devolviam retornos neutros para o teste executar. Avaliação semântica: o alvo executou e falhou no comportamento planejado.
- **RED 2** (`7ee3701`): 37 de 56 falharam por asserção (arrays vazios no lugar das linhas, seção "Não migrados" ausente); 19 passaram (os 8 do RED 1 e os do relatório que já valiam). Um caso (`cv_lixo`) falhou com `TypeError` ao ler `na_lixeira_em` de uma linha inexistente: a falha continua sendo "a Conversa não foi mapeada".
- **RED 3** (`2b9f25b`): 10 de 39 falharam, todos porque o `--migrar` ainda lançava `Este Espaço tem registros do CRM antigo além do Funil` (a recusa provisória do 15-27 que a Task 3 manda tirar) ou porque o `--seco` ainda não tinha a seção; a lógica de inserção, já escrita na Task 2, foi provada no GREEN.

## Verificação

Num contêiner Postgres 16 NOVO (`crm-n1-pg-1528`, porta 55728, migrações 001-012 aplicadas, depois parado e removido):

- `vitest run src/migracao-crm/ src/persistencia/regime-dos-chamadores.test.ts src/sem-crm-antigo.test.ts src/sem-listas-espelho.test.ts`: **10 arquivos, 138 testes, 0 pulados, 0 falhas** (modo `verbose` conferido: nenhum "skipped").
- `DATABASE_URL= DATABASE_URL_MIGRACAO= vitest run mapeador.test.ts relatorio.test.ts` (sem banco): 56 testes passam. `tsc --noEmit` em `apps/api`: 0.
- Critérios de aceite por grep: fixture não vazia; `@n1/dominio/types` ou `/seed` na pasta: 0; `na_lixeira_em` em `mapeador.ts`: 3; `migrado:`: 1; `temperatura` no teste do mapeador: 4; `use --guardar` em `migrar-crm-antigo.ts`: 0.
- Uma amostra de ponta a ponta (script descartável no diretório da sessão, só contra a porta 55728): `--seco`, `--migrar --funil=migrar` e `--verificar` na fixture inteira imprimiram o relatório com as contagens acima e `ok`.
- O lint é só do `@n1/web` (não há ESLint na api) e a web não foi tocada. Nenhum `npm run build`. Disco com 44 GiB livres no fim. Nenhum `.env` lido, nenhum comando contra banco real, nenhum `supabase_*` tocado.

### Como a fixture foi gerada (T-15-71)

Um script descartável, fora do repositório (no diretório da sessão), importou `buildSeed()` de `packages/dominio/src/seed.ts` e gravou `{ colecao, id, dados, ordem }` das nove coleções e de `links`. Data: 2026-11-06T19:23:28Z (UTC), sobre o commit `cfa70fe`. Comando: `vite-node <script> -- <caminho do JSON>` a partir de `apps/api`. O gerador **não** foi commitado e nada veio de `~/n1-ensaio` nem de produção.

## Decisions Made

Ver `key-decisions` no cabeçalho. As que mais pesam no corte: a Empresa sem admin sai com os Negócios dela; o `--funil=guardar` não migra Negócio algum; e o `--migrar` não é desfazível (D-15-02), então o dono lê o "Não migrados" do `--seco` de cada Espaço antes de escrever.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste do 15-27 contradizia a nova regra**
- **Found during:** Task 3 (RED)
- **Issue:** `migrar-crm-antigo.test.ts` tinha "--migrar ... além do Funil: recusa e manda usar --guardar", o oposto do que este plano manda fazer.
- **Fix:** o caso virou "não recusa mais: migra o que cabe e relata o resto" (Contatos migram; a Empresa sintética mínima, sem nome, vai para o relatório).
- **Files modified:** `apps/api/src/migracao-crm/migrar-crm-antigo.test.ts`
- **Committed in:** `2b9f25b`

**2. [Rule 2 - Missing critical] Defesas que o JSON livre exige**
- **Found during:** Task 2
- **Issue:** o JSON de `registros` pode trazer data impossível (`2026-02-30`), valor negativo, `jsonb` nulo, `end` de vínculo ilegível, id repetido ou já existente no CRM novo; qualquer um derrubaria o `commit` do Espaço.
- **Fix:** leitura defensiva (`dia`, `instante`, valor e probabilidade limitados, `nullif(...,'null'::jsonb)`, `end` preenchido sempre encerra o vínculo), pré-validação de ids e unicidades contra o CRM novo (`crm-novo.ts`), e `id-ja-existe` no relatório.
- **Files modified:** `mapeador.ts`, `crm-novo.ts`, `inserir.ts`
- **Committed in:** `3b858fd`, `60dfe6f`

### Arquivos além da lista do plano

`nao-migrados.ts` (categorias e rótulos), `crm-novo.ts` (leituras por SQL), `funil.ts` (`etapasDosFunisAInserir`), `relatorio.test.ts`, `migrar-crm-antigo.test.ts`, `migrar.cli.ts` (comentário), `CONTEXT.md` do `migracao-crm` e da api. Sem custo de escopo.

### Fora do contrato do plano (decisões nossas, registradas)

- `planejarMigracao` ganhou um terceiro parâmetro `opcoes` (`gerarId` para testes determinísticos e `funisMigrados`); o plano descrevia dois.
- Empresa na lixeira sem admin **migra** (a 007 só exige admin fora da lixeira); o plano dizia só "sem vínculo admin vigente".
- Consentimentos, notas e marcações não têm linha de `crm_de_para` (não têm id antigo).
- Valor de Identificador que a normalização nova recusa é preservado, não vai para o relatório (uma pessoa não some por um telefone mal formado).

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 2), mais as decisões acima. **Impact:** nenhuma amplia escopo; a Rule 2 é a que protege o `commit` do Espaço.

## Known Stubs

Nenhum.

## Linhas em `.planning/WINDOWS.md` (fase 15)

**Corrigidas, com prova de teste (`migrar-entidades.test.ts`):**

- **#22, #32, #42** (links e Vínculos a ids antigos abrem "não encontrado"): o Contato, a Empresa, o Negócio e a Conversa migrados mantêm o id; o teste "todo Vínculo de Tarefa do seed ... acha o id" acha Contato, Negócio e Conversa, e o que não acha está no relatório.
- **#49** (`canaisDeAtendimento` com ids do Canal antigo): o Canal entra com o id antigo (`chn_insta`, `chn_mail`, `chn_wpp`).
- **#50** (recusa "além do Funil"): saiu; o `--migrar` cobre as nove coleções.
- **#52** (nenhum id antigo resolvido): ids de Contato, Empresa, Negócio, Canal e Conversa preservados.

**Segue aberta:** **#51** (Pasta "Meus negócios" com Tarefa; não é deste plano).

**Novas, abertas (3):** (a) o que o `--migrar` não leva (temperatura, Tags, Canal do LinkedIn e do chat do site e as Conversas deles, Negócio de Empresa sem admin, detalhes do Negócio, Flow) com os números do seed; (b) campos personalizados com o id da Definição como chave, Canal migrado desconectado, qualificação e origem como id do Catálogo; (c) `unrun-verify`: os avisos acima só têm efeito em produção depois que o dono rodar o `--migrar` (15-34/15-35); nada foi rodado contra banco real.

## Issues Encountered

- O disco estava com 6,6 GiB no início (limite do aviso: 3 GiB) e subiu para 44 GiB durante a execução; nenhum contêiner ficou de pé.
- Ao gerar a fixture, o primeiro caminho de saída era relativo ao diretório errado; repetido com caminho absoluto. Nada foi gravado fora do repositório além do script descartável.
- Nenhum teste tocou o banco de produção, nenhum `.env` foi lido pelo agente (as duas URLs foram passadas explicitamente em cada comando).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto para o 15-29 (demo de desenvolvimento) e o 15-30 (ensaio), que usam o mapeador e a fixture, e para o corte (15-34/15-35): o `CONTEXT.md` de `apps/api/src/migracao-crm/` diz o que fazer (ler o "Não migrados" do `--seco` de cada Espaço antes de escrever, rodar Espaço por Espaço, `--verificar` em seguida, conferir a contagem de `registros_crm_antigo`).
- `requirements-completed` fica vazio de propósito: UCR-09 é declarado também pelo 15-34 e 15-35 (conferido com `requirements.ready-ids` ao fechar o plano).

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivos criados conferidos no disco (`[ -f ]`): os 7 de `key-files.created`.
- Commits `534b7e6`, `3b858fd`, `7ee3701`, `60dfe6f`, `2b9f25b`, `c6ad9b3`, `23c724e` e `97ddc3f` são ancestrais do HEAD; `git log --grep` encontra 4 `test(15-28)` e 3 `feat(15-28)`.
- Os `<automated>` das três tarefas e o `<verification>` do plano reexecutados num contêiner novo: todos passam.
