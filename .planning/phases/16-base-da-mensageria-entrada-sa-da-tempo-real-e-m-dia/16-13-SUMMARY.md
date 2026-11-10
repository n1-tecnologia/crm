---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 13
subsystem: mensageria
tags: [evolution, whatsapp, cli, cofre, webhook, canal, dominio, tdd]

requires:
  - phase: 16-06
    provides: reenfileirarPendentesDoCanal (fila-de-saida.ts), chamada na mesma transação da conexão
  - phase: 16-12
    provides: criarClienteDaEvolution (buscarInstancia com ownerJid e token, estadoDaConexao, configurarWebhook) e o servidor falso
provides:
  - "AcaoDeConexao ganha conexao_confirmada (leva a conectada com conexaoSimulada false, aceita Canal já conectado, recusa arquivado)"
  - "conferirNumeroConectado(canal, numeroDoProvedor): mesmo número com e sem o nono dígito brasileiro, recusa outro número mostrando só os finais"
  - "npm run canal:ligar-evolution: liga um Canal whatsapp-nao-oficial à instância da Evolution (webhook, cofre, conexão real, fila)"
affects: [16-14, 16-16, Sessão 4]

actuals:
  tokens: 16000
  tasks: 2
  commits: 6
plan_head_before: 26b2490006f793c6ad938aec683b3ae5ca6859de
plan_head_after: 24bcddc923da79f2a21bc3396b021b29fbec3d69

tech-stack:
  added: []
  patterns:
    - "CLI com dependências injetadas (env, pool, chaves, criarCliente, saída): os testes passam um ambiente de teste e nunca tocam process.env nem o .env"
    - "Recusa da instância do Financeiro em duas camadas: lerArgumentos (antes de qualquer I/O) e ligarCanalAEvolution (quem chamar direto)"
    - "Efeito externo antes da transação, com erro próprio (FalhaDepoisDoWebhook) quando o banco falha depois dele"

key-files:
  created:
    - apps/api/src/bootstrap/canal-ligar-evolution.ts
    - apps/api/src/bootstrap/canal-ligar-evolution.cli.ts
    - apps/api/src/bootstrap/canal-ligar-evolution.test.ts
  modified:
    - packages/dominio/src/crm/canais.ts
    - packages/dominio/src/crm/canais.test.ts
    - apps/api/src/bootstrap/CONTEXT.md
    - apps/api/package.json
    - apps/api/src/servicos/crm/canais.ts

key-decisions:
  - "Só conexao_confirmada e conferirNumeroConectado entram no domínio; conectar (QR) e conexao_perdida (CONNECTION_UPDATE) ficam para a Sessão 4"
  - "O cofre guarda o TOKEN da instância; sem token o comando recusa em vez de usar a chave global (decisão do dono, A10)"
  - "conexao_confirmada aceita Canal já conectada: rodar o comando de novo troca o segredo, e um Canal simulado deixa de ser simulado"
  - "webhook/set e connectionState usam o token da instância; a chave global só lê fetchInstances (e GET / no --seco)"
  - "--seco percorre o mesmo caminho do comando real até a conferência do número e recusa do mesmo jeito (código 2), em vez de só relatar"
  - "COFRE_CHAVE é lida antes de falar com a Evolution: sem ela o webhook nem chega a mudar"

patterns-established:
  - "Comando de operador que muda um serviço externo: tudo o que pode recusar vem antes, o efeito externo vem antes da transação do banco, e a falha entre os dois é dita na saída"

requirements-completed: [MSG-06]

coverage:
  - id: D1
    description: "Domínio: conexao_confirmada leva a conectada de verdade (inclusive de conectada e com_erro) e recusa Canal arquivado"
    requirement: MSG-06
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/canais.test.ts#conexao_confirmada (16-13, D-16-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "conferirNumeroConectado aceita o mesmo número com e sem o nono dígito, com máscara e @s.whatsapp.net, e recusa outro número, DDD diferente e vazio"
    requirement: MSG-06
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/canais.test.ts#conferirNumeroConectado (16-13, D-16-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "canal:ligar-evolution liga o Canal: webhook com o segredo, cofre com o segredo e o token da instância, Canal conectada com conexao_simulada false, revisão do Espaço e Mensagem pendente reenfileirada"
    requirement: MSG-06
    verification:
      - kind: integration
        ref: "apps/api/src/bootstrap/canal-ligar-evolution.test.ts#liga o Canal à instância"
        status: pass
    human_judgment: false
  - id: D4
    description: "A instância numeropvmarcos é recusada (qualquer caixa e espaços) antes de qualquer pedido ao banco ou à Evolution, também por quem chama ligarCanalAEvolution direto"
    requirement: MSG-06
    verification:
      - kind: unit
        ref: "apps/api/src/bootstrap/canal-ligar-evolution.test.ts#lerArgumentos recusa a instância do Financeiro"
        status: pass
      - kind: integration
        ref: "apps/api/src/bootstrap/canal-ligar-evolution.test.ts#a instância do Financeiro"
        status: pass
    human_judgment: false
  - id: D5
    description: "Recusas (Canal de outro provedor, arquivado, inexistente; instância ausente ou fechada; token nulo; número de outro Canal; variáveis e URL), falhas no meio (webhook/set 500, banco fora depois do webhook, sem COFRE_CHAVE) e saída sem chave, token nem segredo"
    requirement: MSG-06
    verification:
      - kind: integration
        ref: "apps/api/src/bootstrap/canal-ligar-evolution.test.ts (32 testes)"
        status: pass
    human_judgment: false
  - id: D6
    description: "--seco só lê: versão, estado, final do número e URL do webhook, sem escrever na Evolution, no banco nem no cofre"
    requirement: MSG-06
    verification:
      - kind: integration
        ref: "apps/api/src/bootstrap/canal-ligar-evolution.test.ts#--seco mostra versão, estado, número que confere"
        status: pass
    human_judgment: false
  - id: D7
    description: "O comando contra a Evolution REAL do dono (token devolvido por fetchInstances, webhook/set com o token da instância, ownerJid no formato esperado)"
    requirement: MSG-06
    verification: []
    human_judgment: true
    rationale: "Nenhum teste fala com uma Evolution real (regra de segurança do plano); A10 e o aceite do webhook/set pelo token da instância só se confirmam na prova ao vivo (16-16), que é do dono"

duration: 16min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 13: Ligar o Canal à Evolution (comando) Summary

**`npm run canal:ligar-evolution` liga um Canal WhatsApp não oficial à instância da Evolution do dono (instância aberta, número conferido, webhook com segredo próprio, token da instância no cofre, Canal `conectada` de verdade e fila de saída reenfileirada), recusando a `numeropvmarcos` antes de qualquer I/O, com as duas peças de domínio que isso pede.**

## Performance

- **Duration:** 16 min (primeiro commit 17:37 a último 17:44, horário local; leitura e desenho antes)
- **Started:** 2026-11-09T20:30:00Z (aproximado)
- **Completed:** 2026-11-09T20:46:00Z
- **Tasks:** 2 (1 traçador, 1 automática, ambas TDD)
- **Files modified:** 8 (3 criados, 5 alterados)

## Accomplishments

- `packages/dominio/src/crm/canais.ts`: `conexao_confirmada` em `AcaoDeConexao`/`proximaConexao` e `conferirNumeroConectado`; os dois lados da fronteira aplicam a mesma regra. `conectar` e `conexao_perdida` ficaram de fora (Sessão 4).
- `canal-ligar-evolution.ts`: `lerArgumentos`, `ligarCanalAEvolution`, `principal`, `RecusaDaLigacao`, `FalhaDepoisDoWebhook`. Ordem: Canal por `id` (exatamente uma linha, `whatsapp-nao-oficial`, ativo) → `fetchInstances` com a chave global → token → `connectionState` com o token → número → segredo em memória → `webhook/set` → uma transação (cofre ×2, `conexao_confirmada`, revisão, reenfileiramento).
- Prova contra o servidor falso e o Postgres 16 de Docker: o webhook recebido tem a URL `<API_URL_PUBLICA>/webhooks/mensageria/<canalId>` e o segredo de 64 hex no cabeçalho; o cofre tem o mesmo segredo e `{ instancia, apikey: <token> }`; o Canal fica `conectada` com `conexao_simulada = false`; a Mensagem `pendente` ganha a linha `mensagem.enviar.v1`; a revisão do Espaço sobe; a saída só tem nome, Espaço, instância e final do número.
- Rodar de novo troca o segredo e revoga o anterior; um Canal simulado que a Evolution confirma deixa de ser simulado.

## RED / GREEN / REFACTOR

Gate de TDD desligado em `config.json` (`tdd_mode: false`); disciplina seguida por tarefa.

- **Domínio.** RED `64d77cb` (com esqueleto de `conferirNumeroConectado` que devolve `ok`): falhou nas asserções de recusa (4 testes) e em `conexao_confirmada` com Canal arquivado e a partir de `desconectada` (o ramo caía em `desconectar`); semanticAssessment: o alvo executou e falhou na asserção planejada, não por import. GREEN `5721f90`: 41 de 41, domínio inteiro 2452.
- **Task 1 (traçador).** RED `d7876e3` (esqueleto que devolve 1 e `lerArgumentos` que lança "não implementado"): 5 de 6 falharam (parse dos argumentos, a frase da `numeropvmarcos`, o caminho feliz com `esperado 0, recebido 1`). GREEN `0cd70ee`: 6 de 6.
- **Task 2.** Os testes de recusa, `--seco`, falhas e ambiente entraram em `9da29b1` já verdes, porque o GREEN da Task 1 implementou o fluxo inteiro que a ação do plano descreve. Para provar que não são vácuos, mutei o código de produção (restaurado por `git checkout` do arquivo): `--seco` ignorado (2 falham), estado não conferido (1), número não conferido (3), `COFRE_CHAVE` lida depois da Evolution (7) e a defesa em profundidade da `numeropvmarcos` removida (1, o teste direto de `ligarCanalAEvolution` que acrescentei por isso). REFACTOR: não houve.

## Task Commits

1. **Domínio** — `64d77cb` (test), `5721f90` (feat)
2. **Task 1: Traçador** — `d7876e3` (test), `0cd70ee` (feat)
3. **Task 2: Recusas, --seco e CONTEXT.md** — `9da29b1` (test), `24bcddc` (docs)

**Plan metadata:** commit seguinte (docs: complete plan)

## Files Created/Modified

- `apps/api/src/bootstrap/canal-ligar-evolution.ts` - o comando (regra, saída, recusas)
- `apps/api/src/bootstrap/canal-ligar-evolution.cli.ts` - casca fina (`carregarEnv`, `principal`, `encerrar`)
- `apps/api/src/bootstrap/canal-ligar-evolution.test.ts` - 32 testes (6 sem banco, 26 com Postgres local e Evolution falsa)
- `packages/dominio/src/crm/canais.ts` / `canais.test.ts` - `conexao_confirmada`, `conferirNumeroConectado`
- `apps/api/src/bootstrap/CONTEXT.md` - seção "Os comandos dos Canais de mensageria" (`canal:segredo-de-teste` e `canal:ligar-evolution`)
- `apps/api/package.json` - só o script `canal:ligar-evolution`
- `apps/api/src/servicos/crm/canais.ts` - tipo do parâmetro de `mudarConexao` (ver desvio)

## Decisions Made

Ver `key-decisions`. As de maior efeito: o cofre guarda só o token da instância e o comando recusa quando ele não vem (A10); `COFRE_CHAVE` é lida antes de qualquer chamada à Evolution; `--seco` é um ensaio fiel que recusa como o comando real.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Alargar `AcaoDeConexao` quebrou a compilação do serviço de Canais**
- **Found during:** Task 1 (GREEN, `npx tsc --noEmit`)
- **Issue:** `mudarConexao(membro, id, acao: AcaoDeConexao)` repassa a ação como `AcaoCrm` (permissão), e `"conexao_confirmada"` não é uma `AcaoCrm`: `TS2345` em `apps/api/src/servicos/crm/canais.ts`.
- **Fix:** o parâmetro passou a `Exclude<AcaoDeConexao, "conexao_confirmada">`, com comentário: quem confirma a conexão é o comando, não um Membro pela rota. `simularConexao` e `desconectar` não mudam.
- **Files modified:** `apps/api/src/servicos/crm/canais.ts` (fora dos `files_modified` do plano; o plano mandava corrigir só se estivesse no escopo, e é uma linha causada pela mudança do domínio, sem efeito em runtime)
- **Verification:** `npm run typecheck` nos três workspaces sem erro; `servicos/crm/canais.test.ts`, `rotas/crm/canais.test.ts`, `repositorios/crm/canais-008.test.ts` e `e2e/canais-fluxo.test.ts` passam.
- **Committed in:** `0cd70ee`

---

**Total deviations:** 1 auto-fixed (1 bloqueio de compilação). **Impact:** nenhum comportamental; só o tipo de uma função interna.

Escolhas dentro do que o plano deixou aberto (não são desvio): `principal(argv, deps = dependenciasPadrao())` recebe as dependências por parâmetro (como o `canal-segredo-de-teste`) para os testes passarem um ambiente de teste em vez de `process.env`; `--seco` e as recusas ficaram no GREEN da Task 1 (ver RED/GREEN acima); URL pública só aceita http(s) sem usuário, query nem fragmento.

## Issues Encountered

Nenhum além do desvio acima. O `vitest` pula o arquivo silenciosamente se a `DATABASE_URL` local não estiver exportada na mesma chamada de shell: conferi em cada rodada que os testes de banco não apareciam como pulados.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>` do plano. T-16-48 (recusa em duas camadas, testes de caixa e espaço e do chamador direto), T-16-49 (número conferido antes do `webhook/set`), T-16-50 (testes procuram a chave global, o token e qualquer sequência de 64 hex na saída), T-16-51 (só o token vai ao cofre; sem token, recusa), T-16-52 (`webhook/set` antes da transação; 500 não grava nada; banco fora depois do webhook diz o que fazer).

## User Setup Required

Nenhuma configuração nova para este plano. Para a prova ao vivo (16-16, do dono), o comando lê quatro variáveis, que o dono passa na linha de comando:

- `EVOLUTION_URL` — base da Evolution (a mesma que o runtime usa);
- `EVOLUTION_API_KEY` — a chave **global** da Evolution (só lê a instância; nunca vai ao cofre nem ao `api.env` do runtime);
- `API_URL_PUBLICA` — endereço público da API (ou a flag `--url-publica`);
- `COFRE_CHAVE` — a mesma do `api.env` de produção, e a `DATABASE_URL` do banco que se quer mudar.

## Documentação devida

Fora dos `files_modified` deste plano, para o 16-14:

- `apps/api/.env.example`: `EVOLUTION_URL` (já pendente do 16-12) e `API_URL_PUBLICA` (nova, só do comando; o runtime não a lê). **Não** colocar `EVOLUTION_API_KEY` no `.env.example` do runtime: a chave global só vive na linha de comando do comando de ligar.
- `apps/api/src/mensageria/CONTEXT.md`: como um Canal real passa a ser ligado (aponta para `bootstrap/CONTEXT.md`, `canal:ligar-evolution`).
- `packages/dominio/CONTEXT.md` (se houver menção às ações de conexão): `conexao_confirmada` e `conferirNumeroConectado`.

## Next Phase Readiness

- 16-16 (prova ao vivo): rodar primeiro `canal:ligar-evolution ... --seco` contra a Evolution do dono e só depois sem `--seco`. Pressupostos que só a instância real responde: A10 (`fetchInstances` devolve `token` e `ownerJid`), o aceite do `webhook/set` pelo token da instância (o comando o usa; se a Evolution exigir a chave global, o ajuste é em `ligarCanalAEvolution`, e guardá-la seguiria sendo decisão do dono), o formato do `ownerJid`.
- Sessão 4 troca este comando pelo botão "Conectar" com QR e herda `conectar`, `conexao_perdida` e a junção de Contatos com e sem o nono dígito (4.4.3).
- O comando escreve no banco do `DATABASE_URL` com a `COFRE_CHAVE` do ambiente: para o Canal de produção, quem roda tem de usar as de produção.

## Self-Check: PASSED

- Arquivos: os 3 criados e os 5 alterados constam de `git diff --stat 26b2490..HEAD` (8 arquivos, 1132 inserções, 5 remoções); nenhum arquivo apagado.
- Commits na branch: `64d77cb`, `5721f90`, `d7876e3`, `0cd70ee`, `9da29b1`, `24bcddc` (6, medidos por `git rev-list --count`).
- Verificação: domínio `npm run test -w @n1/dominio` 2452 testes e `canais.test.ts` 41; `npm run typecheck` nos três workspaces sem erro; `canal-ligar-evolution.test.ts` 32 e `canal-segredo-de-teste.test.ts` 10 contra o Postgres 16 de Docker na porta 55728 (container removido), nenhum pulado; 32 arquivos de teste da API que importam o que mudou (`rotas/crm/canais`, `servicos/crm/canais`, `repositorios/crm/canais-008`, `mensageria/**`, `e2e/canais-fluxo`, `e2e/mensageria*`, `bootstrap/**`, `cofre`, `operacoes-ferramentas`): 403 testes, nenhum pulado.
- Critérios de aceite: `grep -c "\"canal:ligar-evolution\"" apps/api/package.json` = 1; `conexao_confirmada` em `canais.ts` = 3 e `export function conferirNumeroConectado` = 1; `"conectar"`/`"conexao_perdida"` entre aspas em `canais.ts` = 0; `numeropvmarcos` no comando = 2 e no `bootstrap/CONTEXT.md` = 1; `--seco` no comando = 9; `canal:ligar-evolution` no `CONTEXT.md` = 2.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
