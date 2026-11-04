---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 01
subsystem: database
tags: [postgres, migracao, crm, contatos, mesclagem, vitest, nextjs]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: tabelas `plataforma.contatos`, `contato_identificadores`, `crm_toque_atualizado_em()`
  - phase: 08-canais-conversas-mensagens
    provides: `plataforma.conversas` com `conversas_lixeira_ck`
  - phase: 09-seguranca-dos-dados
    provides: bloco que desliga RLS e `banco:conceder`
provides:
  - migração `011-crm-o-que-faltava.sql` (mesclado, consentimentos, notas, marcações da Conversa, lixeira da Conversa, `crm_de_para`, `registros_crm_antigo`)
  - tipo `EstadoDoContato` e `Contato.mescladoEmId` / `mescladoEm` no domínio
  - repositório de Contatos lendo as colunas novas; `GET /contatos/:id` devolve o `mesclado`
  - página do Contato que leva o absorvido ao sobrevivente
  - guardas de D-06 (domínio e api) e prova automática da 011
affects: [14-02, 14-04, 14-09, 14-15, 14-16, 15-unificacao-telas]

actuals:
  tokens: 14400
  tasks: 2
  commits: 3
plan_head_before: 606cee8893e91b936e90da1cfc21c6b3419ef861
plan_head_after: 22d299b3784d6c9207d9951346cf6f5acc4ac4af
commits: 3

tech-stack:
  added: []
  patterns:
    - "migração idempotente: `drop constraint if exists` antes de cada `add constraint`, `create ... if not exists`"
    - "guarda por leitura de código-fonte que congela uma lista e só deixa encolher (sem-listas-espelho)"
    - "banco descartável `m011_<8>` com 001-010 aplicadas, 011 executada pelo texto"

key-files:
  created:
    - apps/api/migracoes/011-crm-o-que-faltava.sql
    - apps/api/src/persistencia/migracao-011.test.ts
    - packages/dominio/src/sem-listas-espelho.test.ts
    - apps/api/src/sem-listas-espelho.test.ts
  modified:
    - packages/dominio/src/crm/contatos.ts
    - packages/dominio/src/crm/negocios.ts
    - apps/api/src/repositorios/crm/contatos.ts
    - apps/api/src/servicos/crm/contatos.test.ts
    - apps/api/src/testes/banco-crm.ts
    - apps/api/src/persistencia/CONTEXT.md
    - apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx
    - apps/web/src/features/crm/ficha-de-contato.tsx
    - apps/web/src/features/crm/ciclo-de-vida.tsx

key-decisions:
  - "`NegocioDetalhado.contato.estado` passou a `EstadoDoContato`: o Contato de um Negócio pode ser `mesclado`, e o tipo antigo (`EstadoCrm`) mentia."
  - "`seloDoEstado` aceita `EstadoDoContato` (devolve `mesclado` como chave do selo); a ficha de Contato retorna `null` para `mesclado` DEPOIS dos hooks, porque a página redireciona antes."
  - "`ContatoResumo.estado` fica `EstadoCrm` e `listar` devolve `filtro.estado`: uma lista nunca traz `mesclado`."
  - "As guardas de D-06 varrem o TEXTO inteiro (comentário incluso) por `funilDaLista|iniciar-conversa`; é o que reproduz exatamente as listas congeladas do plano."

patterns-established:
  - "Conversa na lixeira por SQL nos testes exige `na_lixeira_em = now()` (constraint `conversas_na_lixeira_em_ck`)."
  - "Constraints da 011 com nome fixo, que os serviços seguintes traduzem em frase: contatos_mesclado_ck, contatos_mesclado_em_fk, contato_consentimentos_{canal,decisao,origem}_ck, contato_notas_conteudo_ck, conversas_na_lixeira_em_ck."

requirements-completed: [UNI-01, UNI-02]

coverage:
  - id: D1
    description: "A 011 aplica num Postgres 16 novo, é idempotente e uma falha no meio, pelo migrar() real, não deixa linha em plataforma.migracoes nem a tabela contato_notas"
    requirement: UNI-02
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/migracao-011.test.ts#(e) rodar o texto duas vezes seguidas não falha e não muda o dado; #(f) pelo migrar()"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cada restrição da 011 (mesclado, consentimento, nota, lixeira da Conversa) recusa o que deve, com o nome da constraint"
    requirement: UNI-02
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/migracao-011.test.ts#(a) a (d)"
        status: pass
    human_judgment: false
  - id: D3
    description: "As cinco tabelas novas ficam sem RLS; a 011 não cria coluna de Grupo nem de Flow (D-05) e não altera plataforma.registros (D-03)"
    requirement: UNI-02
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/migracao-011.test.ts#(g), (h), (i)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Traçador: um Contato mesclado sai de obter com estado mesclado e mescladoEmId, não aparece entre os ativos, e a página do absorvido leva ao sobrevivente"
    requirement: UNI-02
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/contatos.test.ts#traçador (011)"
        status: pass
      - kind: automated_ui
        ref: "apps/web/src/features/crm/ficha-de-contato.test.tsx#(k) Contato mesclado"
        status: pass
    human_judgment: false
  - id: D5
    description: "Guardas de D-06: nada novo, em domínio ou api, cita funilDaLista nem iniciar-conversa fora das listas congeladas"
    requirement: UNI-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/sem-listas-espelho.test.ts; apps/api/src/sem-listas-espelho.test.ts"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-04
status: complete
---

# Phase 14 Plan 01: A migração 011 e o Contato mesclado do banco à tela Summary

**Migração `011` idempotente (mesclado, consentimentos, notas, marcações e lixeira da Conversa, `crm_de_para`, `registros_crm_antigo`) provada num Postgres 16 descartável, com o estado `mesclado` do Contato atravessando banco, api e tela e guardas que impedem Grupo, Flow e Listas espelho de entrar.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-04T17:25:26Z
- **Completed:** 2026-11-04T17:33:00Z
- **Tasks:** 2
- **Files modified:** 17 (4 criados, 13 alterados)

## Accomplishments

- A 011 aplica num Postgres 16 novo e sobre um banco com 001 a 010 já registradas; nada de `plataforma.registros` muda e as duas tabelas de cópia nascem vazias (D-03).
- Traçador de ponta a ponta: um Contato `mesclado` sai de `obter` com `estado: "mesclado"` e `mescladoEmId`, não é listado entre os ativos, e `/crm/contatos/<absorvido>` chama `router.replace` para o sobrevivente sem desenhar a ficha.
- `migracao-011.test.ts` (10 testes) prova cada restrição, o backfill da lixeira, a idempotência, a falha no meio pelo `migrar()` real, o desligamento de RLS e a ausência das três colunas de Grupo/Flow.
- Duas guardas de D-06 (domínio e api), com mutação de controle: um arquivo novo que cite `funilDaLista` as faz falhar com a mensagem do plano.

## Task Commits

1. **Task 1: Traçador (011 + domínio + repositório + página)**
   - `aa5cff6` (test) RED: o traçador falha com `column "mesclado_em_id" does not exist`
   - `d450a2d` (feat) GREEN: 011, `EstadoDoContato`, repositório e página
2. **Task 2: A 011 provada por inteiro e as guardas de D-06** - `22d299b` (test)

**Plan metadata:** commit de docs que fecha o plano (SUMMARY, STATE, ROADMAP).

## TDD Gate Compliance

- **RED** (`aa5cff6`): o teste `traçador (011)` rodado contra um Postgres 16 com 001 a 010 (011 removida da pasta por instantes) falhou no `update ... mesclado_em_id` com `column "mesclado_em_id" does not exist`. Avaliação semântica: a falha é a ausência planejada da coluna, o alvo executou; não é erro de carga, fixture nem sintaxe. O classificador `check tdd-red-evidence` não foi rodado (o repositório não persiste o relatório em TAP/JUnit nesse formato); a evidência é o relatório do vitest colado acima.
- **GREEN** (`d450a2d`): 011 aplicada, o mesmo teste e `src/rotas/crm/contatos.test.ts` passam (53 testes).
- **Task 2** (`22d299b`): os testes de prova da 011 foram escritos depois da 011 existir (Task 1 a criou), então não houve RED separado para eles; a mutação de controle das guardas de D-06 e o caso (f) (falha no meio) mostram que os testes mordem. Nenhum commit `refactor`.

## Files Created/Modified

- `apps/api/migracoes/011-crm-o-que-faltava.sql` - a migração nova da Fase 14.
- `apps/api/src/persistencia/migracao-011.test.ts` - prova de restrições, idempotência, falha no meio, RLS, sem Grupo/Flow, registros intocados.
- `packages/dominio/src/crm/contatos.ts` - `EstadoDoContato`, `ESTADOS_DO_CONTATO`, `Contato.mescladoEmId`/`mescladoEm`.
- `packages/dominio/src/crm/negocios.ts` - `NegocioDetalhado.contato.estado` como `EstadoDoContato`.
- `apps/api/src/repositorios/crm/contatos.ts` - `COLUNAS`, `LinhaDoBanco` e `linhaParaContato` com as duas colunas.
- `apps/api/src/testes/banco-crm.ts` - `limparEspaco` apaga `crm_de_para` e `registros_crm_antigo`.
- `apps/api/src/persistencia/CONTEXT.md` - parágrafo da 011.
- `apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx` - redireciona o `mesclado` ao sobrevivente.
- `apps/web/src/features/crm/{ficha-de-contato,ciclo-de-vida}.tsx` - estreitam o estado novo.
- `packages/dominio/src/sem-listas-espelho.test.ts`, `apps/api/src/sem-listas-espelho.test.ts` - guardas de D-06.

## Decisions Made

- Ver `key-decisions`. A mais pesada para os próximos planos: `NegocioDetalhado.contato.estado` ficou `EstadoDoContato`, e `conferirContato` (negocios.ts) ainda só recusa `na_lixeira`; aceitaria `mesclado`/`arquivado` (Pitfall 6 da pesquisa). Isso é do plano 14-04, como o 14-01 já dizia.
- As guardas de D-06 contam o texto inteiro, comentário incluso. Quem precisar *explicar* em comentário que algo não depende das Listas espelho deve evitar escrever o nome literal `funilDaLista` ou o caminho `iniciar-conversa`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste existente punha Conversa na lixeira por SQL sem `na_lixeira_em`**
- **Found during:** Task 2 (rodando `src/servicos/crm` e `src/rotas/crm` contra o Postgres local)
- **Issue:** `servicos/crm/mensagens.test.ts:182` fazia `update conversas set estado = 'na_lixeira'`; com `conversas_na_lixeira_em_ck` da 011 isso viola a constraint.
- **Fix:** o `update` do teste passou a gravar `na_lixeira_em = now()`.
- **Files modified:** `apps/api/src/servicos/crm/mensagens.test.ts`
- **Verification:** `mensagens.test.ts` 12/12 passando; `servicos/crm` + `rotas/crm` 254/254 antes da correção exceto esse 1.
- **Committed in:** `22d299b`

**2. [Rule 3 - Blocking] Fixtures tipadas de `Contato` e `NegocioDetalhado` pediam os campos novos**
- **Found during:** Task 1 (`tsc --noEmit` na api e na web)
- **Issue:** `rotas/crm/contatos.test.ts`, `ficha-de-contato.test.tsx` e `negocios-do-registro.test.tsx` montam `Contato` literal sem `mescladoEmId`/`mescladoEm`; `NegocioDetalhado.contato.estado` (`EstadoCrm`) não recebia `EstadoDoContato` do repositório.
- **Fix:** campos `null` nas fixtures; `negocios.ts` do domínio passou o estado do Contato embutido a `EstadoDoContato`.
- **Files modified:** `apps/api/src/rotas/crm/contatos.test.ts`, `apps/web/src/features/crm/ficha-de-contato.test.tsx`, `apps/web/src/features/crm/negocios-do-registro.test.tsx`, `packages/dominio/src/crm/negocios.ts`
- **Committed in:** `d450a2d`

**3. [Rule 2 - Missing critical] Teste da página do Contato mesclado**
- **Found during:** Task 1
- **Issue:** a mudança web (redirecionar o absorvido) não tinha teste; o plano só pedia o teste de api.
- **Fix:** caso `(k)` em `ficha-de-contato.test.tsx` (o `useRouter` do mock virou espiável via `vi.hoisted`).
- **Files modified:** `apps/web/src/features/crm/ficha-de-contato.test.tsx`
- **Verification:** 11/11 no arquivo; `apps/web` `src/features/crm` 159/159.
- **Committed in:** `d450a2d`

### Arquivos fora de `files_modified`

Além dos três acima: `negocios.ts` (domínio), `rotas/crm/contatos.test.ts`, `ficha-de-contato.test.tsx`, `negocios-do-registro.test.tsx`, `ciclo-de-vida.tsx` e `mensagens.test.ts`. Todos por causa do tipo novo ou da constraint nova; nenhum muda comportamento além do planejado.

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical)
**Impact on plan:** nenhuma muda o escopo. O ponto de atenção é o item 1: qualquer plano seguinte que ponha Conversa na lixeira por SQL ou por repositório precisa gravar `na_lixeira_em` junto.

## Issues Encountered

- O RED foi obtido movendo a 011 para fora da pasta por instantes (fora do repositório, no scratchpad) e devolvendo-a; o arquivo nunca foi staged nesse intervalo.
- `npm run lint` mostra 2 avisos preexistentes em `features/ia/conhecimento/rotulos.ts` e `features/shell/app-shell.tsx`, sem relação com este plano.

## Verification

- `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run`: 127 arquivos passando, 38 pulados (sem banco), 1235 testes passando; `npx tsc --noEmit` ok.
- Com Postgres 16 descartável (`crm-n1-pg-1401`, porta 55601): `migracao-011.test.ts`, `migrar-seco.test.ts` e `servicos/crm/contatos.test.ts`, 27/27; `servicos/crm` + `rotas/crm` 254/254 com a correção do item 1.
- `packages/dominio`: `tsc` ok, 2200 testes passando. `apps/web`: `tsc` ok, `npm run lint` 0 erros, `verificar:tokens` ok, `src/features/crm` 159/159.
- Não rodada: a suíte inteira de `apps/api` com banco (13 a 17 min, `lote-contas-a-pagar (d)` falha por rede conhecida) e o `next build`.
- O contêiner `crm-n1-pg-1401` foi removido ao fim.

## User Setup Required

None - no external service configuration required. A 011 só vai a produção no deploy da Fase 15 (D-01); antes, `npm run migrar -w @n1/api -- --seco` lista o que seria aplicado, e depois `npm run banco:conceder`.

## Next Phase Readiness

- Pronto: as tabelas e constraints da 011 têm os nomes que os planos 14-02 em diante usam (ver `<interfaces>` do plano).
- A fazer nos próximos planos: `conferirContato` e `empresas.ts:222` ainda só recusam `na_lixeira` (14-04); `restaurar`/`arquivar`/`excluirPermanentemente` ainda não recusam `mesclado` (14-04); `FRASES_DE_CONTATOS` ainda não traduz `contatos_mesclado_em_fk` nem as `contato_consentimentos_*`.
- `limparEspaco` já cobre as tabelas novas.

## Self-Check: PASSED

- Arquivos criados existem (011, `migracao-011.test.ts`, as duas `sem-listas-espelho.test.ts`).
- Commits `aa5cff6`, `d450a2d` e `22d299b` presentes na branch.
- Critérios de aceite das duas tasks conferidos por `grep`; `git diff --stat` das migrações 001 a 010 vazio.

---
*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Completed: 2026-11-04*
