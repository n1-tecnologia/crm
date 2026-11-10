---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 14
subsystem: documentacao
tags: [cronograma, context, env, systemd, deploy, gate, mensageria]

requires:
  - phase: 16-01 a 16-13
    provides: o código da mensageria (recebimento, provedor, webhook, saída, tempo real, mídia, Evolution, comando de ligar o Canal) que este plano descreve
provides:
  - "docs/09-planejamento/dados/andamento.mjs registra 3.6.1 a 3.9.6 (3.8.1 com o decidido de D-16-01) e marca parcial 4.2.1, 4.2.2, 4.4.1, 4.4.2 e 4.4.4; o cronograma regenera sem erro"
  - "CONTEXT.md da raiz com 'A partir da Fase 16' e o corte da Fase 15 corrigido para feito em 2026-11-07; os CONTEXT.md de camada (mensageria, persistencia, rotas, servicos, e2e, testes, web, dominio, api) descrevem o que a fase acrescentou e o que não está provado"
  - "apps/api/.env.example com a seção Mensageria (Fase 16); n1-crm-api.service com MENSAGERIA_WORKER_ATIVO e COLETA_DE_ORFAOS_ATIVA em false; deploy/CONTEXT.md com a 013, o drop-in mensageria.conf, o SSE atrás do nginx e canal:ligar-evolution"
  - "o gate (npm run check) verde na rodada 2; a rodada 1 falhou em um teste cuja causa foi provada (bug latente de ORDER BY em repositorios/crm/mensagens.ts)"
affects: [16-15, 16-16, Sessão 4]

actuals:
  tokens: 18000
  tasks: 3
  commits: 2
plan_head_before: 44860c1ef892e866b1fbe4b62b0369c77a04a8af
plan_head_after: 640931133bd7fc528bb850a7baa4b9da7b8a9cb6

tech-stack:
  added: []
  patterns:
    - "variável de ambiente que o carregador leria como string vazia fica COMENTADA no .env.example (Number('') é 0)"
    - "andamento.mjs: uma entrada por subtarefa, 'parcial' diz o que entrou e o que fica para a sessão seguinte"

key-files:
  created: []
  modified:
    - CONTEXT.md
    - apps/api/CONTEXT.md
    - apps/api/src/mensageria/CONTEXT.md
    - apps/api/src/persistencia/CONTEXT.md
    - apps/api/src/rotas/CONTEXT.md
    - apps/api/src/servicos/CONTEXT.md
    - apps/api/src/e2e/CONTEXT.md
    - apps/api/src/testes/CONTEXT.md
    - apps/web/CONTEXT.md
    - packages/dominio/CONTEXT.md
    - apps/api/.env.example
    - apps/api/deploy/n1-crm-api.service
    - apps/api/deploy/CONTEXT.md
    - .planning/phases/16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia/deferred-items.md
    - .planning/WINDOWS.md

key-decisions:
  - "EVOLUTION_API_KEY (a chave GLOBAL da Evolution) fica FORA do .env.example do runtime, por ordem do orquestrador verificada no código: só a linha de comando de canal:ligar-evolution a lê e o cofre nunca a guarda; o .env.example só a cita em comentário"
  - "MENSAGERIA_WORKER_ID e UPLOAD_MAX_BYTES_MIDIA ficam comentadas no .env.example: o carregador lê 'VAR=' como valor vazio, e Number('') é 0 (todo upload de mídia seria recusado) e o worker de entrada teria id vazio"
  - "TEMPO_REAL_ATIVO NÃO é fixada na unidade systemd: o padrão do código é ligado e é o que a prova A9 (16-16) exercita; a unidade só documenta a conexão extra do ouvinte (10 + 1) e como desligar por drop-in"
  - "docs/09-planejamento/ não foi commitado (decisão do planejador): o dono commita junto com o trabalho dele"

requirements-completed: [MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, MSG-06]

coverage:
  - id: D1
    description: "O andamento da Sessão 3 parte C (3.6.1 a 3.9.6) e o adiantamento parcial da Sessão 4 (4.2.1, 4.2.2, 4.4.1, 4.4.2, 4.4.4) chegam ao cronograma gerado"
    verification:
      - kind: other
        ref: "node docs/09-planejamento/gerar.mjs (exit 0, 23 blocos, 382 subtarefas) e grep -c 3.9.6 em TAREFAS-POR-SESSAO.md = 2"
        status: pass
    human_judgment: false
  - id: D2
    description: "O CONTEXT.md da raiz e os das camadas descrevem a mensageria, o que ficou para a Sessão 4 e o que não está provado"
    verification:
      - kind: other
        ref: "grep dos critérios de aceite da Task 2 (A partir da Fase 16, webhooks/mensageria, tempo-real, recebimento, 013, GET /eventos); packages/dominio quem-pode.test.ts verde com o CONTEXT novo"
        status: pass
    human_judgment: true
    rationale: "Se a documentação é clara e fiel ao código é leitura humana; os greps só provam que as seções existem"
  - id: D3
    description: ".env.example documenta as variáveis da mensageria sem valor real; a unidade systemd fixa os dois workers em false; deploy/CONTEXT.md traz o drop-in"
    verification:
      - kind: other
        ref: "grep -c das sete variáveis em .env.example = 10; Environment=MENSAGERIA_WORKER_ATIVO=false = 1; mensageria.conf em deploy/CONTEXT.md = 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run check passa nos três workspaces contra Postgres 16 local"
    verification:
      - kind: other
        ref: "npm run check, rodada 2: api 217 arquivos passaram, 2 pulados (2877 passaram, 21 pulados); web 135/135 (1366); dominio 132/132 (2452); exit 0. Rodada 1: 1 falha em repositorios/crm/mensagens.test.ts, causa provada (ver Issues Encountered)"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 14: Documentação da fase e gate Summary

**O cronograma, os CONTEXT.md da raiz e das camadas, o `.env.example`, a unidade systemd (workers desligados) e o roteiro de deploy descrevem a mensageria da Fase 16, e o `npm run check` fechou verde na segunda rodada; a primeira falhou num teste de ordenação cuja causa é um bug latente do `listar` de Mensagens desde o plano 08-12.**

## Performance

- **Duration:** 16 min (estimada: o relógio inicial não foi gravado; o gate levou 4 min por rodada neste computador)
- **Started:** 2026-11-09T20:56Z (aprox.)
- **Completed:** 2026-11-09T21:13Z
- **Tasks:** 3
- **Files modified:** 15 no git (mais 1 fora do git, `andamento.mjs`, e 2 gerados de `docs/09-planejamento/`)

## Accomplishments

- **Cronograma (D-16-04).** `andamento.mjs` marca feitas as 22 subtarefas da Sessão 3 parte C (3.6.1 a 3.9.6), com o plano e uma nota em português de produto; a 3.8.1 leva o `decidido` de D-16-01 (SSE por `LISTEN/NOTIFY`, e que se o pooler não entregar o `LISTEN` a tela segue pela releitura de 5 s). As cinco subtarefas da Sessão 4 que a fase adiantou ficam `parcial` com o que entrou e o que ficou (4.2.1, 4.2.2, 4.4.1, 4.4.2, 4.4.4). As quatro linhas da Fase 16 saíram de `FUTURAS` e o comentário foi atualizado. `node docs/09-planejamento/gerar.mjs` regenerou o `.md` e o `.html` sem erro.
- **CONTEXT.md.** A raiz ganhou "A partir da Fase 16" e teve o corte da Fase 15 corrigido para "feito em 2026-11-07" (o texto dizia que ainda não tinha acontecido e que a `012` só existia em banco local). Camadas: `mensageria/` (entrada, saída, tempo real, mídia, Evolution, comando e o mapa final de arquivos), `persistencia/`, `rotas/` (webhook público, `GET /eventos`, anexos, `reenviar`), `servicos/` (anexo da Mensagem, porta de armazenamento), `e2e/` (os cinco arquivos), `testes/` (`armazenamento-falso.ts`), `web/` (`tempo-real.ts`, `EstadoDaEntrega`, `AnexoDaMensagemNoFio`, compositor), `dominio/` (`recebimento`, `eventos`, `midia`, `conexao_confirmada`) e `api/` (tabela das variáveis). Foram corrigidas duas frases que ficaram velhas (`registrarRecebida` no `e2e/` e na rota da Meta).
- **Variáveis, unidade e deploy.** Seção "Mensageria (Fase 16)" no `.env.example`; `MENSAGERIA_WORKER_ATIVO=false` e `COLETA_DE_ORFAOS_ATIVA=false` na unidade, com a nota da conexão extra do ouvinte; `deploy/CONTEXT.md` com a `013` (backup, `--seco`, `publicar.sh`), o drop-in `mensageria.conf`, o SSE atrás do nginx (`X-Accel-Buffering`, batida de 25 s abaixo de 120 s) e `canal:ligar-evolution`.
- **Gate.** Rodada 2 verde (exit 0). Os cinco `e2e/mensageria*.test.ts` rodaram sem pular (5 arquivos, 26 testes) num Postgres novo.

## Task Commits

1. **Task 1: Traçador — o andamento chega ao cronograma gerado** — sem commit, por decisão do planejador: `docs/09-planejamento/` não entra no git deste plano (ver "Para o dono commitar"). Verificado pelo `<automated>` (`gerar.mjs` exit 0, `grep -c 3.9.6` = 2) e pelos três critérios de aceite (4, 0, 0).
2. **Task 2: CONTEXT.md da raiz e das camadas** — `a0bc4fc` (docs)
3. **Task 3: Variáveis, unidade systemd, deploy e o gate** — `6409311` (docs); o gate é a verificação, não um commit

**Plan metadata:** commit `docs(16-14)` seguinte (SUMMARY, `deferred-items.md`, `WINDOWS.md`) e outro com STATE, ROADMAP e REQUIREMENTS.

## Files Created/Modified

Os 15 arquivos do git estão em `key-files.modified` acima. Fora do git: `docs/09-planejamento/dados/andamento.mjs` (editado) e os dois gerados abaixo.

## Para o dono commitar

`docs/09-planejamento/` tinha trabalho seu não commitado antes desta fase e este plano NÃO commitou nada de lá. Estes arquivos mudaram por causa do plano e vão com as suas alterações:

- `docs/09-planejamento/dados/andamento.mjs` — **fora do git (untracked)**: editado só com entradas novas (3.6.1 a 3.9.6, 4.2.1, 4.2.2, 4.4.1, 4.4.2, 4.4.4), a constante `EM_FASE_16`, as quatro linhas tiradas de `FUTURAS` e dois comentários atualizados; nenhuma entrada existente foi mudada.
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` — regenerado por `gerar.mjs` (já estava modificado por você).
- `docs/09-planejamento/cronograma.html` — regenerado por `gerar.mjs` (já estava modificado por você).

`docs/09-planejamento/dados/index.mjs` e `gerar.mjs` continuam como você os deixou (este plano não os tocou). A cópia de segurança dos cinco arquivos é a que o orquestrador guardou antes do início. `10-PROVAS.md` da Fase 10 também não foi tocado.

## Decisions Made

Ver `key-decisions`. Resumo: a chave global da Evolution fica só na linha de comando; variáveis que o carregador leria como vazio ficam comentadas; o ouvinte `LISTEN` fica ligado por padrão (é o que a prova A9 exercita) e a unidade só o documenta.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `EVOLUTION_API_KEY` não entra no `.env.example` como variável**
- **Found during:** Task 3
- **Issue:** a `must_haves` do plano manda documentar `EVOLUTION_API_KEY` no `.env.example`; o código (`canal-ligar-evolution.ts`) a lê só da linha de comando e o cofre nunca a guarda. Pô-la no `.env.example` do runtime convidaria a gravar a chave GLOBAL no `api.env` da VPS.
- **Fix:** o `.env.example` só a cita em comentário ("não é variável do runtime"); o critério de aceite (>= 7 linhas das variáveis) fecha com 10. Ordem do orquestrador, conferida no código.
- **Files modified:** `apps/api/.env.example`, `apps/api/deploy/CONTEXT.md`, `apps/api/CONTEXT.md`
- **Committed in:** `6409311`, `a0bc4fc`

**2. [Rule 1 - Bug] Variáveis com valor vazio no `.env.example` quebrariam quem copiasse o arquivo**
- **Found during:** Task 3
- **Issue:** `carregarEnv()` lê `VAR=` como `""` (só `undefined` é "ausente"). `UPLOAD_MAX_BYTES_MIDIA=` vira `Number("")` = 0 e recusa todo upload de mídia; `MENSAGERIA_WORKER_ID=` dá id vazio ao worker de entrada.
- **Fix:** as duas ficam comentadas (`# VAR=`), com o motivo. As variáveis cujo código já testa vazio como ausente (`EVOLUTION_URL`, `API_URL_PUBLICA`) ficam como linha vazia.
- **Files modified:** `apps/api/.env.example`
- **Committed in:** `6409311`

**3. [Rule 1 - Bug] Texto de documentação que ficou velho**
- **Found during:** Task 2
- **Issue:** o `CONTEXT.md` da raiz dizia que o corte da Fase 15 "ainda não aconteceu" e que a `012` só existia em banco local (o corte foi em 2026-11-07); `e2e/CONTEXT.md` e `rotas/CONTEXT.md` citavam `registrarRecebida`, que a Fase 16 tirou.
- **Fix:** corrigidos, com remissão a `15-PROVAS.md` ("Corte em produção") e a `receberMensagem`.
- **Committed in:** `a0bc4fc`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2)
**Impact on plan:** nenhuma mudou o escopo; todas protegem a fidelidade da documentação ou evitam um erro de configuração.

## Issues Encountered

**1. Gate, rodada 1: `repositorios/crm/mensagens.test.ts` falhou e a causa foi provada (não é flake).** Resultado: api 216 arquivos passaram, 1 falhou, 2 pulados (2876 testes passaram, 1 falhou); web 135/135; dominio 132/132. A falha: "lista por (criado_em, seq) — mesmo criadoEm sai na ordem de inserção", `[antes, b, a]` no lugar de `[antes, a, b]`. Causa: `apps/api/src/repositorios/crm/mensagens.ts:239` tem `select ... seq::text as seq ... order by criado_em, seq`; no Postgres, um nome solto no `ORDER BY` liga primeiro ao alias de SAÍDA, que aqui é o texto, então o desempate é lexicográfico (`"100"` antes de `"99"`). O teste passa ou falha conforme o contador global de `seq` atravessa uma fronteira de dezena ou centena entre as duas inserções (por isso "intermitente": depende de quantas Mensagens as outras suítes inseriram antes). Prova: num Postgres novo o arquivo passa 6 de 6; com `alter table plataforma.mensagens alter column seq restart with 95` falha na mesma asserção. É um bug desde o plano 08-12, não uma regressão da Fase 16; as outras consultas já qualificam (`m.seq`). Efeito em produção: Mensagens da mesma Conversa com o mesmo `criado_em` (a Evolution manda `messageTimestamp` em segundos, então empate é comum) saem trocadas no fio quando o `seq` delas atravessa uma potência de 10. **Não corrigido aqui** (o plano é só de documentação e o orquestrador mandou não editar código): correção de uma linha, `order by criado_em, plataforma.mensagens.seq`. Registrado em `deferred-items.md` e em `.planning/WINDOWS.md`.

**2. Gate, rodada 2 (Postgres novo): verde.** API 217 arquivos passaram, 2 pulados (2877 testes passaram, 2 `expected fail`, 21 pulados, 1 `todo`); web 135 arquivos, 1366 testes; dominio 132 arquivos, 2452 testes; typecheck dos dois workspaces, `eslint` da web e `verificar:tokens` (445 definidos, 406 arquivos, 0 falhas) verdes. Os baselines conhecidos (`outbox-worker.test.ts` h a k, `colunas-geradas.test.ts`, `lote-contas-a-pagar (d)`) **não falharam em nenhuma das duas rodadas** neste computador. As duas falhas intermitentes de 2026-11-09 (`mensagens.test.ts` e o `acordar()` do processador) apareceram uma vez só (a de `mensagens.test.ts` na rodada 1); como não falhou em duas rodadas seguidas, o gate fica verde, e a causa dela agora é conhecida.

**3. `verificar:contratos` pulou a verificação:** "repositório irmão não encontrado em .../financeiro-tria", exit 0. O `check` não conferiu os contratos do Financeiro por falta do repositório ao lado (já era assim; não é desta fase).

**4. Nenhum `mensageria*.test.ts` apareceu como pulado:** os cinco de `src/e2e/` rodados à parte num banco novo deram 5 arquivos e 26 testes passando. Os 2 arquivos pulados do gate não são da mensageria.

## User Setup Required

None — este plano não exige configuração externa. O que o dono faz depois (publicar a `013` com backup, ligar o drop-in, ligar um Canal à Evolution) está em `apps/api/deploy/CONTEXT.md`, na seção "Mensageria (Fase 16)", e é o roteiro de 16-15 e 16-16.

## Known Stubs

None. (Nada de código; as únicas lacunas são as de prova ao vivo, abaixo.)

## Threat Flags

None — o plano só escreve documentação e um modelo de configuração; nenhum endpoint, caminho de autenticação nem acesso a arquivo novo. T-16-53: nenhum telefone real, chave, token ou segredo nos documentos (greps dos critérios de aceite: 0 ocorrências; o `+5511987654321` que aparece em `packages/dominio/CONTEXT.md` é um exemplo fictício antigo do seed, não do plano). T-16-54: a unidade fixa os dois workers em `false`.

## Next Phase Readiness

O que 16-15 e 16-16 precisam saber:

- **Nada da fase rodou contra o Supabase Storage, o pooler real nem a Evolution real.** A prova ao vivo é do dono: suposição A9 (o pooler 5432 com `n1_api` entrega `LISTEN/NOTIFY`), `X-Accel-Buffering: no` atrás do nginx, áudio ogg/opus no Safari (A5), e A1 a A4 e A10 da Evolution (token em `fetchInstances`, `ownerJid`, `webhook/set` pelo token da instância, `number` só com dígitos, `message` do webhook em `getBase64FromMediaMessage`).
- **Publicar:** a `013` só existe em bancos locais. Backup manual do schema `plataforma` antes, `npm run migrar -w @n1/api -- --seco` primeiro, `publicar.sh` depois. Os dois workers nascem desligados; ligar é o drop-in `mensageria.conf`. `TEMPO_REAL_ATIVO` liga sozinho por padrão no primeiro deploy (uma conexão a mais: 10 + 1); `Environment=TEMPO_REAL_ATIVO=false` num drop-in o desliga.
- **Antes da prova ao vivo, vale corrigir o `ORDER BY` de `listar`** (Issues Encountered, item 1): com mensagens da Evolution em segundos, o empate de `criado_em` é comum e o fio pode trocar a ordem de duas mensagens.
- Limites abertos de 16-10 em `deferred-items.md`: a coleta de `entrada/` só vê 500 objetos por Canal e a primeira coleta só roda 24 h depois do boot.
- O dono ainda precisa commitar `docs/09-planejamento/` (ver "Para o dono commitar").

## Self-Check: PASSED

- Arquivos: os 13 arquivos do git declarados (e `andamento.mjs`) existem (`[ -f ]`).
- Commits: `a0bc4fc` e `6409311` são ancestrais de `HEAD`; `git rev-list --count 44860c1..HEAD` = 2 antes do commit deste SUMMARY.
- Critérios de aceite das três tarefas rodados e verdes (Task 1: 4, 0, 0; Task 2: grep da raiz, da rota, da web e do domínio >= 1, `013` = 2, `GET /eventos` = 1, telefone = 0 nos dois arquivos pedidos; Task 3: 10, 1, 2).
- O `<automated>` da Task 3 foi rodado em duas rodadas (a segunda verde) e o container `crm-n1-pg-1614` foi removido.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
