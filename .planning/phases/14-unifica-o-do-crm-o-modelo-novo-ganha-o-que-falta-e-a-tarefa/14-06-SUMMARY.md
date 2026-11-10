---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 06
subsystem: api
tags: [crm, contatos, notas, identificadores, transferencia, do-con-12, inv-con-01, vitest, postgres]

requires:
  - phase: 14-01
    provides: tabela `plataforma.contato_notas` (011) e o estado `mesclado` do Contato
  - phase: 14-04
    provides: helper `escrita` de Contatos que recusa o Contato absorvido (`CONTATO_MESCLADO`)
  - phase: 14-05
    provides: a ordem de travas (Contatos em ordem de id) que a transferência segue
provides:
  - "`GET`/`POST /contatos/:id/notas` com autor sempre o Membro da sessão"
  - "`POST /contatos/:id/identificadores/:identificadorId/transferir` (3.2.3, DO-CON-12)"
  - "`@n1/dominio/crm/notas` (`NotaDoContato`, `NovaNota`, `validarNovaNota`, `recusaDeNotaNoContato`)"
  - "`validarTransferenciaDeIdentificador` em `@n1/dominio/crm/contatos`"
affects: [14-09, 14-11, 14-13, 14-14, fase-15, fase-16]

actuals:
  tokens: 15970
  tasks: 2
  commits: 4
plan_head_before: d2c663280d004a87828e1782478784af0d055a92
plan_head_after: d3bac7bfb00b4357c390030769e9e91c3e939eef
commits: 4

tech-stack:
  added: []
  patterns:
    - "gesto entre dois Contatos trava em ordem de id: `escrita` ganhou o parâmetro `tambem`, que trava o de id menor antes da origem"
    - "RED com esqueleto: módulo novo nasce com stub que aceita tudo, para o alvo executar e falhar na asserção (importar módulo inexistente seria INVALID_RED)"

key-files:
  created:
    - packages/dominio/src/crm/notas.ts
    - packages/dominio/src/crm/notas.test.ts
    - apps/api/src/repositorios/crm/notas.ts
    - apps/api/src/servicos/crm/notas.ts
    - apps/api/src/servicos/crm/notas.test.ts
    - apps/api/src/rotas/crm/notas.ts
    - apps/api/src/rotas/crm/notas.test.ts
  modified:
    - packages/dominio/src/crm/contatos.ts
    - packages/dominio/src/crm/contatos.test.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/repositorios/crm/contatos.ts
    - apps/api/src/servicos/crm/contatos.ts
    - apps/api/src/servicos/crm/contatos.test.ts
    - apps/api/src/rotas/crm/contatos.ts
    - apps/api/src/rotas/crm/contatos.test.ts
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "O Convidado lê as notas (a matriz de `podeNoCrm` deixa `ler` a todo Membro ativo ou suspenso) mas é 403 ao escrever, antes de ler o Contato; a frase do plano 'Convidado é 403 antes de ler' vale para `adicionar` e para `transferirIdentificador`."
  - "A origem de uma transferência pode estar `ativo`, `arquivado` ou na lixeira (o plano só recusa `mesclado`); o destino `arquivado` recebe, como já recebe Negócio."
  - "O código de recusa de `validarTransferenciaDeIdentificador` é sempre 409 `TRANSFERENCIA_RECUSADA` com o `campo` do domínio (`paraContatoId` ou `nome`), inclusive a de INV-CON-01."
  - "`escrita` travou o destino por `tambem`: o de id menor antes da origem, o de id maior dentro do corpo, mantendo a ordem ascendente."

patterns-established:
  - "Nota e transferência não gravam Registro de Atividade nem avançam a revisão do Espaço (mesma linha de mover/atribuir, 14-05)."

requirements-completed: [UNI-10, UNI-06]

coverage:
  - id: D1
    description: "POST /contatos/:id/notas grava uma linha em contato_notas com autor_id igual ao Membro da sessão; GET devolve as notas da mais recente para a mais antiga, paginadas, com total"
    requirement: UNI-10
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/notas.test.ts#(a) e (b)"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/crm/notas.test.ts#POST grava pelo serviço com o Membro da sessão"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nota só com espaços é 400 campo conteudo; Contato mesclado ou na lixeira recusa com 409 NOTA_RECUSADA; Contato de outro Espaço é 404; Convidado é 403 ao escrever; corpo com autorId é 400"
    requirement: UNI-10
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/notas.test.ts#(c) a (g)"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/crm/notas.test.ts#POST com autorId (T-14-13)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Transferir o Identificador passa o número ao destino (principal só se o destino não tem do tipo), promove o mais antigo do mesmo tipo na origem, o detentor passa a ser o destino e as Conversas passadas ficam com a origem"
    requirement: UNI-06
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/contatos.test.ts#transferirIdentificador (a) a (d)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A transferência recusa o mesmo Contato, destino mesclado ou na lixeira ou cheio, origem mesclada e a origem que ficaria sem nome nem Identificador; outro Espaço é 404; Convidado é 403; corpo com principal é 400"
    requirement: UNI-06
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/contatos.test.ts#transferirIdentificador (e) a (j)"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/crm/contatos.test.ts#validarTransferenciaDeIdentificador"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/crm/contatos.test.ts#(k) transferir"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-11-04
status: complete
---

# Phase 14 Plan 06: Notas do Contato e transferência de Identificador na api Summary

**`GET`/`POST /contatos/:id/notas` com autor sempre o Membro da sessão e `POST .../identificadores/:identificadorId/transferir`, que passa o número a outro Contato sem levar as Conversas passadas e sem deixar a origem sem nome nem Identificador, tudo com a regra no domínio e provado contra Postgres 16 descartável.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-11-04T18:04:18Z
- **Completed:** 2026-11-04T18:14:00Z
- **Tasks:** 2 (cada uma com RED e GREEN)
- **Files modified:** 17 (7 criados, 10 alterados)

## Accomplishments

- Notas do Contato nas tabelas (3.2.7): `crm/notas.ts` no domínio, repositório de `contato_notas`, serviço e rotas. O autor vem de `membro.id`; o corpo `.strict()` recusa `autorId`, `contatoId` e `workspaceId`. O Contato é lido travado, de modo que a mesclagem (14-09) e a nota não se cruzam.
- Transferência de Identificador (3.2.3): o número chega ao destino principal só se ele não tem principal do tipo; na origem o mais antigo do mesmo tipo é promovido, como em `removerIdentificador`. `detentorDoIdentificador` passa a devolver o destino, e a Conversa aberta antes continua no Contato de origem (DO-CON-12). INV-CON-01 passou a valer também aqui, o que o modelo antigo não fazia.
- Recusas completas e traduzidas: 409 `NOTA_RECUSADA`, 409 `TRANSFERENCIA_RECUSADA` (com `campo`), 409 `CONTATO_MESCLADO` (origem), 404 para qualquer Contato ou Identificador de outro Espaço, 403 ao Convidado.
- `rotas/CONTEXT.md` e `packages/dominio/CONTEXT.md` registram as três rotas e as duas regras.

## Task Commits

1. **Task 1 RED:** `9f1768a` (test) notas do Contato, com falha esperada
2. **Task 1 GREEN:** `ed3ac9b` (feat) notas do Contato nas tabelas, com `GET` e `POST /contatos/:id/notas`
3. **Task 2 RED:** `05bc8b4` (test) transferir Identificador, com falha esperada
4. **Task 2 GREEN:** `d3bac7b` (feat) transferir Identificador sem levar as Conversas

**Plan metadata:** commit de docs que fecha o plano (SUMMARY, STATE, ROADMAP).

## TDD Gate Compliance

- **RED Task 1** (`9f1768a`): 4 de 5 testes do domínio e 20 de 21 do serviço e das rotas falharam (o que passou é o `401` sem Authorization e o "aceita nota no teto" do esqueleto que aceita tudo). Avaliação semântica: cada falha é a ausência planejada do comportamento (o serviço esqueleto devolvia 404 "Ainda não implementado" onde o teste esperava sucesso ou o código de recusa; as rotas não existiam e davam 404 onde o teste esperava 200, 201 ou 400). Alvo executou; nenhuma falha de carga, sintaxe ou fixture. O módulo novo nasceu com esqueleto no RED porque importar um módulo inexistente seria falha de carga (INVALID_RED).
- **RED Task 2** (`05bc8b4`): 5 de 22 testes do domínio, os 10 da transferência no serviço ((a) a (j)) e os 6 de transferir nas rotas falharam; os demais testes dos três arquivos (62) seguiram passando. Mesma avaliação semântica.
- **GREEN** (`ed3ac9b`, `d3bac7b`): domínio 116 arquivos, 2260 testes; api 166 arquivos, 1849 testes passando, contra Postgres 16 migrado até a 011.
- **REFACTOR:** nenhum commit.
- O classificador `check tdd-red-evidence` não foi rodado: o vitest não persiste TAP/JUnit neste repositório (mesma situação do 14-04); a evidência é o relatório da execução.

## Files Created/Modified

- `packages/dominio/src/crm/notas.ts` - `NotaDoContato`, `NovaNota`, `validarNovaNota`, `recusaDeNotaNoContato`.
- `packages/dominio/src/crm/contatos.ts` - `validarTransferenciaDeIdentificador`.
- `apps/api/src/repositorios/crm/notas.ts` - `inserir` e `listar` paginado de `contato_notas`.
- `apps/api/src/repositorios/crm/contatos.ts` - `moverIdentificador`.
- `apps/api/src/servicos/crm/notas.ts` - `ServicoDeNotas`, código `NOTA_RECUSADA`.
- `apps/api/src/servicos/crm/contatos.ts` - `transferirIdentificador`, código `TRANSFERENCIA_RECUSADA`, parâmetro `tambem` em `escrita`.
- `apps/api/src/rotas/crm/notas.ts` - `rotasDeNotas`.
- `apps/api/src/rotas/crm/contatos.ts` - a rota de transferir.
- `apps/api/src/rotas/crm/index.ts` - `OpcoesDeCrm.notas` e o registro de `rotasDeNotas`.
- Testes: `notas.test.ts` nas três camadas e acréscimos em `contatos.test.ts` do domínio, do serviço e das rotas.
- `apps/api/src/rotas/CONTEXT.md`, `packages/dominio/CONTEXT.md` - as rotas e as regras novas.

## Decisions Made

- Convidado: lê notas, é 403 ao escrever (a matriz de `podeNoCrm` já era assim; o plano diz "403 antes de ler" e isso vale para as escritas).
- A origem de uma transferência não precisa estar `ativo` (arquivado e lixeira passam; só `mesclado` é recusado), porque o plano só lista essa recusa.
- Toda recusa de `validarTransferenciaDeIdentificador` vira 409 `TRANSFERENCIA_RECUSADA` com o `campo` do domínio, também a de INV-CON-01 (`campo: "nome"`), em vez do `CONTATO_SEM_NOME_NEM_IDENTIFICADOR` de `removerIdentificador`.
- Nota e transferência não gravam Registro de Atividade nem avançam a revisão do Espaço.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Trava dos dois Contatos em ordem de id**
- **Found during:** Task 2
- **Issue:** o plano manda "travar origem e destino com `obter(..., { travar: true })` em ordem de id", mas o helper `escrita` trava só a origem; travar o destino depois dela, sem ordem, abre deadlock entre duas transferências opostas e com a mesclagem (14-09).
- **Fix:** `escrita` ganhou o parâmetro opcional `tambem` (o outro Contato do gesto): se o id dele é menor que o da origem, é travado antes; senão o corpo o trava depois da origem. A ordem é sempre ascendente.
- **Files modified:** `apps/api/src/servicos/crm/contatos.ts`
- **Verification:** a suíte de Contatos (101 testes, junto de Conversas) passa; o deadlock em si não tem teste, a ordem é por construção.
- **Committed in:** `d3bac7b`

**2. [Rule 2 - Missing Critical] Teto de Identificadores do destino**
- **Found during:** Task 2
- **Issue:** a transferência pode estourar `LIMITES_CRM.identificadoresMaximo` (20) do destino, limite que `adicionarIdentificador` impõe e a transferência contornaria.
- **Fix:** o serviço recusa com 409 `TRANSFERENCIA_RECUSADA` (campo `paraContatoId`) quando o destino já tem 20.
- **Files modified:** `apps/api/src/servicos/crm/contatos.ts`, caso (i) de `contatos.test.ts`
- **Verification:** o caso (i) cria um destino com 20 e-mails e confere o 409.
- **Committed in:** `d3bac7b`

**3. [Rule 3 - Blocking] Esqueletos no RED**
- **Found during:** Task 1 e Task 2
- **Issue:** módulos novos (`notas.ts` nas três camadas) e a função de domínio não existem antes do GREEN; um teste que os importa falha por carga, que é INVALID_RED.
- **Fix:** o commit RED leva um esqueleto (serviço e rota sem comportamento, domínio que aceita tudo), para o alvo executar e falhar na asserção planejada.
- **Files modified:** os mesmos arquivos do GREEN
- **Committed in:** `9f1768a`, `05bc8b4`

---

**Total deviations:** 3 (2 Rule 2, 1 Rule 3)
**Impact on plan:** as duas adições são correção de integridade; nenhuma muda contrato público além de um `tambem` opcional interno a `escrita`.

## Issues Encountered

- `timeout` não existe no macOS: o primeiro comando de verificação do plano rodou vazio; a suíte completa da api foi rodada de novo sem ele.
- O `lint` do monorepo é só do `web` (`npm run lint`); este plano não toca `apps/web`, então `tsc --noEmit` de `packages/dominio` e `apps/api` foi o gate de tipos.

## Verification

- `packages/dominio`: `vitest run` 116 arquivos, 2260 testes, `tsc --noEmit` limpo.
- `apps/api` com Postgres 16 descartável migrado até a 011 (porta 55606, removido ao fim): `vitest run` completo, 166 arquivos passando e 2 pulados, 1849 testes passando, 21 pulados (os pulados já existiam; os testes deste plano rodaram, não foram pulados), `tsc --noEmit` limpo. Isso inclui TODOS os arquivos de `src/persistencia/`, `rotas/operacoes.test.ts` e `rotas/estado.test.ts`.
- Guardas D-06 (`sem-listas-espelho.test.ts` do domínio e da api): passam.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. T-14-13 (autor forjado) mitigado e testado nas rotas e no serviço; T-14-14 (IDOR) mitigado por `workspace_id = $1` em todo `where` e testado ("outro Espaço é 404"); T-14-15 (conteúdo em log) mitigado: o serviço nunca loga `conteudo` e nada de nota entra em `GET /estado`.

## Next Phase Readiness

- A ficha nova (14-11) pode chamar `GET`/`POST /contatos/:id/notas` e `POST .../transferir`; a Caixa da Fase 15 escreve notas pela mesma rota (3.4.2, 3.4.5).
- Para o 14-09 (mesclagem): a ordem de travas já está em `escrita` (`tambem`); ao absorver, as notas do absorvido não são movidas por este plano (a regra de mesclagem decide o que fazer com `contato_notas`).
- Para quem usar `ServicoDeContatos` em teste: todo serviço falso precisa implementar `transferirIdentificador` (só `rotas/crm/contatos.test.ts` tinha um e já foi ajustado).
- Em aberto (OQ8, a confirmar): a Reunião e o fio da Conversa passam a escrever nestas notas na Fase 15.

## Self-Check: PASSED

Arquivos criados presentes; commits `9f1768a`, `ed3ac9b`, `05bc8b4`, `d3bac7b` presentes na branch; contêiner `crm-n1-pg-1406` removido.

---
*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Completed: 2026-11-04*
