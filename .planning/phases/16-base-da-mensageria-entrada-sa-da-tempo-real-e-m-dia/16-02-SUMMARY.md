---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 02
subsystem: api
tags: [mensageria, provedor, cofre, vitest, tdd, fastify]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`RecebidaDoProvedor` e `receberMensagem` (16-01): o tipo do evento de entrada, que `EventoDoProvedor` compõe"
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "cofre de credenciais (`guardarCredencial`/`lerCredencial`, `plataforma.credenciais`)"
provides:
  - "`ProvedorDeMensageria` e os tipos que o cercam (`EventoDoProvedor`, `EnvioAoProvedor`, `ResultadoDoEnvio`, `CanalParaProvedor`, `ErroDeProvedor`, `CABECALHO_DO_SEGREDO`)"
  - "`provedorDoCanal`/`canalParaProvedor`/`registroPadrao`: provedor de teste só para Canal simulado; Canal real sem implementação lança `PROVEDOR_INDISPONIVEL`"
  - "provedor de teste (`criarProvedorDeTeste`/`provedorDeTeste`): sem rede, segredo por Canal do cofre, depósito de mídia em memória"
  - "`descreverContratoDoProvedor(nome, fabrica)`: conjunto de contrato reutilizável"
  - "`npm run canal:segredo-de-teste -w @n1/api -- --canal <id>`"
affects: [16-03, 16-04, 16-05, 16-09, 16-10, 16-11, 16-12, 16-13]

actuals:
  tokens: 14300
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "interface de provedor com contrato de testes reutilizável: cada provedor novo só liga a sua `fabrica` a `descreverContratoDoProvedor`"
    - "CLI testável: regra e `principal(argv, deps)` num arquivo, `.cli.ts` só liga ambiente, pool e saída; `principal` devolve o código, nunca chama `process.exit`"
    - "o segredo do webhook por Canal mora no cofre (`donoTipo: canal`, `tipo: webhook_segredo`), nunca numa constante"

key-files:
  created:
    - apps/api/src/mensageria/provedor.ts
    - apps/api/src/mensageria/registro.ts
    - apps/api/src/mensageria/registro.test.ts
    - apps/api/src/mensageria/provedores/teste.ts
    - apps/api/src/mensageria/contrato-do-provedor.ts
    - apps/api/src/mensageria/provedor.test.ts
    - apps/api/src/mensageria/CONTEXT.md
    - apps/api/src/bootstrap/canal-segredo-de-teste.ts
    - apps/api/src/bootstrap/canal-segredo-de-teste.cli.ts
    - apps/api/src/bootstrap/canal-segredo-de-teste.test.ts
  modified:
    - apps/api/package.json

key-decisions:
  - "`verificarChamada(chamada, canal)` recebe o `CanalParaProvedor` (emenda da 3.6.1, D-16-06): conferir a instância do corpo exige a credencial do Canal."
  - "`provedorDoCanal` devolve o provedor de teste só com `conexaoSimulada = true`; e `enviar` do de teste recusa Canal real por conta própria (defesa em profundidade, MSG-05)."
  - "Corpo do provedor de teste: `{ eventos: [...] }` com no mínimo um evento, zod `.strict()`; vazio ou com campo extra vira `ignorado: formato_invalido`."
  - "`canal:segredo-de-teste` acha o Canal só por id e recusa o id que existe em dois Espaços em vez de adivinhar; seleciona `for update` para o Canal não deixar de ser simulado entre a conferência e o INSERT."
  - "O comando não recusa banco remoto: ele existe também para gerar o segredo de um Canal simulado de demonstração em produção (diferente do `bootstrap:crm-demo`)."

patterns-established:
  - "Nada de segredo fixo de teste: cada Canal simulado tem o seu no cofre e o provedor de teste recusa a chamada sem ele."
  - "Contrato de provedor: (a) segredo, (b) texto em E.164, (c) corpo inválido sem exceção, (d) envio, (e) teto de mídia, (f) nenhum segredo em resultado ou erro."

requirements-completed: [MSG-05]

coverage:
  - id: D1
    description: "O provedor de teste só serve Canal simulado: Canal real sem implementação lança PROVEDOR_INDISPONIVEL, nunca cai no de teste, e um Canal que deixa de ser simulado o perde"
    requirement: MSG-05
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/registro.test.ts#provedorDoCanal (D-16-03) — sem banco"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/registro.test.ts#Canal que deixou de ser simulado perde o provedor de teste"
        status: pass
      - kind: unit
        ref: "apps/api/src/mensageria/registro.test.ts#Canal real nunca é dado como enviado pelo provedor de teste (MSG-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O segredo do webhook de cada Canal simulado vem do cofre e o provedor de teste recusa a chamada sem ele ou com outro valor (comparação em tempo constante, sem segredo fixo)"
    requirement: MSG-05
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/registro.test.ts#Canal simulado com segredo no cofre: segredoDoWebhook vem do cofre e o provedor é o de teste"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/registro.test.ts#Canal simulado sem segredo no cofre: o provedor de teste recusa qualquer chamada"
        status: pass
      - kind: unit
        ref: "apps/api/src/mensageria/registro.test.ts#provedor de teste: verificarChamada — sem banco"
        status: pass
    human_judgment: false
  - id: D3
    description: "Conjunto de contrato reutilizável do provedor, rodando no CI contra o de teste; mutações (aceita qualquer segredo, erro vaza credencial, corpo inválido lança) o derrubam"
    requirement: MSG-05
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedor.test.ts#contrato do provedor: teste"
        status: pass
    human_judgment: false
  - id: D4
    description: "`canal:segredo-de-teste` gera o segredo só para Canal simulado, guarda no cofre revogando o anterior e o mostra uma vez; recusa Canal real, inexistente ou ambíguo"
    requirement: MSG-05
    verification:
      - kind: integration
        ref: "apps/api/src/bootstrap/canal-segredo-de-teste.test.ts"
        status: pass
      - kind: other
        ref: "npm run canal:segredo-de-teste -w @n1/api -- --canal <id> contra o Postgres de Docker (exit 0 simulado, exit 2 real e sem argumento)"
        status: pass
    human_judgment: false

plan_head_before: eaf6da31ad01165390d80d065bd6587a795e6396
plan_head_after: 8c9b555c8434558f2e33da047bee6cd3fc621431

duration: 7min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 02: Interface de provedor de mensageria e provedor de teste Summary

**`ProvedorDeMensageria` como interface única, registro que só entrega o provedor de teste a Canal simulado (Canal real sem implementação lança `PROVEDOR_INDISPONIVEL`), provedor de teste sem rede com o segredo do webhook de cada Canal no cofre, conjunto de contrato reutilizável e o comando `canal:segredo-de-teste`.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-09T17:17:09Z
- **Completed:** 2026-11-09T17:24:00Z
- **Tasks:** 3
- **Files modified:** 11 (10 criados, 1 alterado)

## Accomplishments

- `mensageria/provedor.ts`: a interface e os tipos que 16-03, 16-04, 16-09 e 16-11 consomem; `EventoDoProvedor` compõe `RecebidaDoProvedor` do domínio (16-01) e ganha `status`, `conexao` e `ignorado`. Nenhum pacote novo.
- `registro.ts` + `provedores/teste.ts`: `provedorDoCanal` devolve o de teste só com `conexaoSimulada = true`; `canalParaProvedor` lê o segredo do webhook (e a credencial do Canal real) do cofre. O de teste compara o cabeçalho `x-n1-webhook-segredo` em tempo constante (sha-256 + `timingSafeEqual`), nunca faz rede, e `enviar` recusa Canal real por conta própria.
- `contrato-do-provedor.ts` + `provedor.test.ts`: seis casos que valem para qualquer provedor; verifiquei três mutações no provedor de teste (aceita qualquer segredo, erro com a credencial, corpo inválido que lança) e o contrato derrubou cada uma.
- `canal:segredo-de-teste`: 64 hex no cofre, uma credencial ativa por Canal, saída com caminho, cabeçalho e `curl`; rodado de verdade contra o Postgres de Docker (exit 0 para o simulado, 2 para o real e para argumento ausente).
- `mensageria/CONTEXT.md`: a pasta nova, a regra D-16-03, o cabeçalho do segredo, a regra de log e o mapa dos arquivos dos planos seguintes.

## Task Commits

1. **Task 1 (traçador), RED** - `722e0c1` (test): tipos completos, registro e provedor de teste como esqueletos; 10 de 13 testes falham por asserção.
2. **Task 1, GREEN** - `c6c07fa` (feat): registro e provedor de teste; 15 testes passando contra o Postgres local.
3. **Task 2** - `c5e4665` (test): conjunto de contrato, `provedor.test.ts` (10 testes) e `CONTEXT.md`.
4. **Task 3, RED** - `d2f16a3` (test): esqueleto do comando; 10 de 10 falham por asserção.
5. **Task 3, GREEN** - `8c9b555` (feat): comando, `.cli.ts` e script npm.

**Plan metadata:** commit `docs(16-02)` seguinte (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `apps/api/src/mensageria/provedor.ts` - interface, tipos, `ErroDeProvedor`, `CABECALHO_DO_SEGREDO`, `TIPO_DO_SEGREDO_DO_WEBHOOK`
- `apps/api/src/mensageria/registro.ts` - `registroPadrao`, `provedorDoCanal`, `canalParaProvedor`
- `apps/api/src/mensageria/provedores/teste.ts` - `criarProvedorDeTeste`, `provedorDeTeste`
- `apps/api/src/mensageria/contrato-do-provedor.ts` - `descreverContratoDoProvedor`, `FabricaDoContrato`
- `apps/api/src/mensageria/registro.test.ts` (15 testes, 4 com banco) e `provedor.test.ts` (10)
- `apps/api/src/mensageria/CONTEXT.md` - a pasta nova
- `apps/api/src/bootstrap/canal-segredo-de-teste.ts`, `.cli.ts`, `.test.ts` (10 testes, 7 com banco)
- `apps/api/package.json` - só o script `canal:segredo-de-teste` (dependências inalteradas)

## Decisions Made

Ver `key-decisions`. Em resumo: `verificarChamada` recebe o `CanalParaProvedor`; o provedor de teste se defende sozinho de Canal real; o comando acha o Canal só por id e não adivinha entre Espaços.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `enviar` do provedor de teste recusa Canal real**
- **Found during:** Task 1
- **Issue:** a prohibition de MSG-05 ("uma Mensagem de um Canal real nunca é dada como enviada pelo provedor de teste") só estava garantida por `provedorDoCanal`; quem chamasse o provedor de teste direto, ou um registro mal montado, a quebraria em silêncio.
- **Fix:** `enviar` devolve `{ ok: false, transitorio: false, codigo: "PROVEDOR_INDISPONIVEL" }` quando `canal.canal.conexaoSimulada` é falso, sem gravar em `enviados`.
- **Files modified:** `apps/api/src/mensageria/provedores/teste.ts`, `registro.test.ts` (dois testes)
- **Verification:** `registro.test.ts#Canal real nunca é dado como enviado pelo provedor de teste (MSG-05)`
- **Committed in:** `c6c07fa`

**2. [Rule 1 - Bug] Teste de Canal arquivado e simulado não é construível**
- **Found during:** Task 3
- **Issue:** o teste que arquivava um Canal simulado violava `canais_arquivado_desconectado_ck` e depois `canais_simulada_ck` (008): um Canal arquivado é sempre desconectado e, portanto, nunca simulado. A ramificação "arquivado" do comando é inalcançável por dados válidos.
- **Fix:** o teste arquiva zerando `conexao_simulada` (como o serviço faz) e espera a recusa de Canal real; a ramificação de arquivado fica como defesa em profundidade, com comentário.
- **Files modified:** `apps/api/src/bootstrap/canal-segredo-de-teste.test.ts`, `canal-segredo-de-teste.ts`
- **Committed in:** `8c9b555`

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 1)
**Impact on plan:** nenhuma muda o contrato do `<interfaces>`. Sem scope creep.

## TDD Gate Compliance

- **Task 1:** RED `722e0c1` (tipos completos, esqueletos que devolvem `registro.teste` sempre, `false` e `[]`): 10 falhas por asserção do comportamento e 3 passes que já eram verdade no esqueleto; o Postgres rodou e nenhum bloco ficou pulado. GREEN `c6c07fa`: 15 passando. Avaliação semântica: o alvo executou e falhou na asserção planejada; não usei `gsd_run check tdd-red-evidence` porque o plano é `type: execute` e `workflow.tdd_mode` é `false`.
- **Task 2:** não há RED separado. A tarefa É o conjunto de testes e o provedor que ele exercita já existia (Task 1), então o teste passa de primeira ("unexpected green" por construção). Para provar que o contrato enxerga defeitos, apliquei três mutações temporárias em `provedores/teste.ts` e reverti cada uma (`git checkout -- <arquivo>`): `verificarChamada` aceitando tudo, erro de mídia com a credencial na mensagem, corpo inválido lançando. Cada uma derrubou exatamente um caso do contrato.
- **Task 3:** RED `d2f16a3`: 10 de 10 falhando por asserção contra o esqueleto (`lerArgumentos` devolvia `{ canal: "" }`, `principal` devolvia 1); GREEN `8c9b555`: 10 passando.
- **REFACTOR:** não houve.

## Issues Encountered

- Nenhum bloqueio. Um teste de Canal arquivado precisou ser reescrito pelas constraints da 008 (ver desvio 2).
- Usei `/tmp` por um instante para guardar uma cópia de `teste.ts` durante as mutações (e apaguei em seguida), contra a orientação de usar o scratchpad; não restou arquivo nenhum e `git status` ficou sem diferença em `apps/api`.

## Verification Run

- Postgres 16 em Docker (`crm-n1-pg-1602`, porta 55717), `npm run --silent migrar` antes, contêiner removido no fim:
  - `src/mensageria/registro.test.ts` 15 passando; com `src/bootstrap/canal-segredo-de-teste.test.ts` 25 passando; `src/mensageria` inteiro + o do comando: 3 arquivos, 35 testes passando, nenhum pulado.
  - `DATABASE_URL= npx vitest run src/mensageria/provedor.test.ts`: 10 passando.
  - `npx tsc --noEmit` em `apps/api`: ok.
  - CLI de verdade: `npm run canal:segredo-de-teste -w @n1/api -- --canal <id>` com `COFRE_CHAVE` gerada na hora: exit 0 para Canal simulado (segredo mostrado uma vez), 2 para Canal real e para argumento ausente.
- Critérios de aceite: `export interface ProvedorDeMensageria` 1; `x-n1-webhook-segredo` em `provedor.ts` 1; `timingSafeEqual` em `teste.ts` 2; `fetch(`/`http.request`/`https.request` em `teste.ts` 0; `PROVEDOR_INDISPONIVEL` em `registro.ts` 2; `descreverContratoDoProvedor` 1 e 2; `D-16-03` no `CONTEXT.md` 1 e no comando 2; script no `package.json` 1; `dependencies`/`devDependencies` idênticas ao `HEAD` anterior.
- Não rodei `npm run check` inteiro (13-17 min), conforme o plano.

## Known Stubs

None.

## Threat Flags

None. A superfície nova (provedor de teste e comando) está coberta pelos T-16-04 (só `conexaoSimulada`; `enviar` também recusa), T-16-05 (segredo só no `stdout`, uma vez; contrato (f) procura o segredo em resultados e erros), T-16-06 (sem segredo fixo, recusa sem `segredoDoWebhook`, tempo constante) e T-16-SC (nenhum pacote novo).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 16-03 importa `ProvedorDeMensageria`, `CanalParaProvedor`, `ChamadaDoWebhook`, `CABECALHO_DO_SEGREDO` de `mensageria/provedor.ts` e `provedorDoCanal`/`canalParaProvedor` de `registro.ts`. A rota pública deve dar a mesma 401 para as causas de recusa (inclusive `ErroDeProvedor PROVEDOR_INDISPONIVEL`); `chaveDaChamada` dá a chave de deduplicação.
- `registroPadrao()` só tem o provedor de teste; o 16-11/16-12 acrescenta `whatsapp-nao-oficial` em `porProvedor` e roda `descreverContratoDoProvedor` contra o servidor falso da Evolution (a `fabrica` fornece `chamadaDeTexto`, `prepararEnvioAceito`, `prepararMidiaGrande`, `encerrar`).
- Os eventos do provedor de teste levam `cargaBruta` (o evento cru). O processador de entrada (16-03) deve tratá-lo como dado pessoal: só o banco o guarda, nunca log.
- `canalParaProvedor` lança se o cofre não decifra (chave errada, linha copiada); o chamador decide se vira 401 ou retentativa.

## Self-Check: PASSED

- Arquivos criados existem: `provedor.ts`, `registro.ts`, `registro.test.ts`, `provedores/teste.ts`, `contrato-do-provedor.ts`, `provedor.test.ts`, `mensageria/CONTEXT.md`, `canal-segredo-de-teste.ts`, `.cli.ts` e `.test.ts`.
- Commits na branch: `722e0c1`, `c6c07fa`, `c5e4665`, `d2f16a3`, `8c9b555`.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
