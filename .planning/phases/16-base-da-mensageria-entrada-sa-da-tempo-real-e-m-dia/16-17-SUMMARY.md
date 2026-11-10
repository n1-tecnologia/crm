---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 17
subsystem: mensageria
tags: [canal, conexao, cofre, dominio, ficha, gap-closure, cr-01, tdd]

requires:
  - phase: 16-13
    provides: canal:ligar-evolution (guarda a credencial do provedor no cofre com o Canal travado) e AcaoDeConexao.conexao_confirmada
  - phase: 16-03
    provides: registro.ts e a regra D-16-03 (provedor de teste só com conexao_simulada = true)
provides:
  - "FatosDaConexao, CanalNaFicha, podeSimularConexao, FRASE_DO_CANAL_REAL e FRASE_SEM_FATOS_DA_CONEXAO em @n1/dominio/crm/canais; proximaConexao com o terceiro argumento (falha fechada)"
  - "RepositorioDeCanais.ligadoAoProvedor: existência da credencial ativa do provedor no cofre, sem decifrar"
  - "POST /canais/:id/simular-conexao responde 409 TRANSICAO_INVALIDA para o Canal ligado a um provedor real"
  - "GET /canais/:id devolve ligadoAoProvedor; a ficha esconde Simular conexão no Canal real e mostra como reconectar"
affects: [16-VERIFICATION lacuna 1, Sessão 4 (botão Conectar com QR)]

requirements-completed: [MSG-05]

actuals:
  tokens: 8600
  tasks: 3
  commits: 5
plan_head_before: d27bea2dfdd265fb34c2c1fa7a276d2d543413fa
plan_head_after: 99cd75429342bc0fda8c6b4bb71c8c875e207658

tech-stack:
  added: []
  patterns:
    - "Fato que o domínio não conhece entra como terceiro argumento obrigatório na ação que depende dele; sem o fato, a regra recusa (falha fechada)"
    - "O fato é lido na mesma transação, depois do for update da linha que a escrita decide, para não haver corrida com o comando do operador"

key-files:
  created: []
  modified:
    - packages/dominio/src/crm/canais.ts
    - packages/dominio/src/crm/canais.test.ts
    - apps/api/src/repositorios/crm/canais.ts
    - apps/api/src/servicos/crm/canais.ts
    - apps/api/src/rotas/crm/canais.test.ts
    - apps/web/src/dados/crm/canais.ts
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx
    - apps/web/src/features/crm/ficha-do-canal.test.tsx
    - apps/api/src/mensageria/CONTEXT.md
    - packages/dominio/CONTEXT.md
    - apps/web/CONTEXT.md

key-decisions:
  - "O fato \"o Canal é real\" é a credencial ativa do próprio provedor no cofre (a que canal:ligar-evolution guarda); descartados o adaptador registrado (recusaria o Canal de demonstração, que é a Sessão 4) e uma coluna \"já foi real\" (exigiria a migração 014)"
  - "O fato entra no domínio como terceiro argumento obrigatório de simular_conexao; desconectar e conexao_confirmada o ignoram, então canal-ligar-evolution.ts não mudou"
  - "CanalNaFicha só existe na leitura da ficha (GET /canais/:id); o tipo Canal não ganhou campo"
  - "Reconectar o Canal real é canal:ligar-evolution até a Sessão 4; nenhum botão Conectar nasce aqui"

patterns-established:
  - "Recusa de transição por fato de infraestrutura: o serviço lê o fato dentro da transação e o domínio decide; a tela usa a mesma função do domínio para esconder o botão"

coverage:
  - id: D1
    description: "Domínio: simular_conexao recusa o Canal ligado a um provedor (FRASE_DO_CANAL_REAL) e a falta do fato (FRASE_SEM_FATOS_DA_CONEXAO); arquivado e já conectada vêm antes; desconectar e conexao_confirmada não mudam; podeSimularConexao é a mesma regra"
    requirement: MSG-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/canais.test.ts#CR-01 (16-17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pela rota, Desconectar seguido de Simular conexão num Canal com credencial ativa do provedor dá 409 TRANSICAO_INVALIDA; o Canal fica desconectada com conexao_simulada false, a revisão do Espaço e o outbox não mudam"
    requirement: MSG-05
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/canais.test.ts#CR-01: desconectar e simular o Canal com credencial do provedor"
        status: pass
    human_judgment: false
  - id: D3
    description: "O Canal de demonstração (só o segredo de teste do webhook, sem nada no cofre, ou com a credencial do provedor revogada) continua conectando por Simular conexão (D-16-03)"
    requirement: MSG-05
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/canais.test.ts#CR-01: o Canal sem credencial ATIVA do provedor"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /canais/:id devolve ligadoAoProvedor true com a credencial ativa do provedor e false sem ela"
    requirement: MSG-05
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/canais.test.ts#CR-01: GET /canais/:id devolve ligadoAoProvedor"
        status: pass
    human_judgment: false
  - id: D5
    description: "A ficha do Canal ligado a um provedor não oferece Simular conexão (desconectado ou conectado), mostra a frase de como reconectar e mantém Arquivar e Desconectar; o Canal de demonstração segue com o botão"
    requirement: MSG-05
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/ficha-do-canal.test.tsx#CR-01 (16-17)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A ficha, num navegador autenticado contra a API de produção, com um Canal realmente ligado à Evolution"
    requirement: MSG-05
    verification: []
    human_judgment: true
    rationale: "Nenhuma tela foi aberta em navegador nem contra o banco de produção (regra da execução); a prova ao vivo é do dono"

duration: 25min
completed: 2026-11-10
status: complete
---

# Phase 16 Plan 17: Simular conexão não derruba o Canal real (CR-01) Summary

**O Canal com credencial ativa do próprio provedor no cofre deixa de poder virar simulado pela tela: `POST /canais/:id/simular-conexao` responde 409 `TRANSICAO_INVALIDA` (regra no domínio, fato lido por existência na mesma transação) e a ficha esconde o botão e diz como reconectar, enquanto o Canal de demonstração simula como antes.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-11-10
- **Tasks:** 3 (1 traçador TDD, 1 automática TDD, 1 documentação)
- **Files modified:** 11 (nenhum criado)

## Accomplishments

- `packages/dominio/src/crm/canais.ts`: `FatosDaConexao`, `CanalNaFicha`, `FRASE_DO_CANAL_REAL`, `FRASE_SEM_FATOS_DA_CONEXAO`, `podeSimularConexao` e `proximaConexao(canal, acao, fatos?)`. Em `simular_conexao` a ordem é arquivado, já conectada, fato ausente, Canal ligado; sem o fato a regra recusa (falha fechada). `desconectar` e `conexao_confirmada` não mudaram.
- `RepositorioDeCanais.ligadoAoProvedor`: um `select exists` em `plataforma.credenciais` (`dono_tipo = 'canal'`, `tipo` = provedor do Canal, `revogado_em is null`). Não lê `segredo_cifrado`, não decifra, não precisa da `COFRE_CHAVE`.
- `mudarConexao` lê o fato depois do `for update` do Canal e antes de qualquer escrita; a recusa é o 409 de sempre, sem `definirConexao`, sem revisão do Espaço e sem reenfileirar.
- `ServicoDeCanais.obter` devolve `CanalNaFicha`; a ficha (`useCanal`, `FichaDoCanal`) usa `podeSimularConexao(channel)` no lugar da conferência escrita à mão e, no Canal ligado, mostra `FRASE_DO_CANAL_REAL` no parágrafo da conexão.
- Os três `CONTEXT.md` (mensageria, domínio, web) dizem a regra e que reconectar o Canal real é `canal:ligar-evolution` até a Sessão 4.

## TDD

- **RED 1 (`9503373`):** três casos de domínio (`simular` com `ligadoAoProvedor: true`, sem o fato, e `podeSimularConexao`) e o caso "CR-01" pela rota. Falharam na asserção planejada: `expected 200 to be 409` na rota; frase e função ausentes no domínio. Avaliação semântica: o alvo executou e falhou pelo motivo certo (o comportamento não existia), sem erro de fixture nem de importação.
- **GREEN 1 (`0265c27`):** domínio, repositório e serviço.
- **RED 2 (`60b5f63`):** `GET /canais/:id` sem `ligadoAoProvedor` (`expected undefined to be true`) e a ficha do Canal ligado ainda com o botão (`expected <button> to be null`). O caso web "ligado e conectado" já passava (Simular conexão não aparece num Canal conectado); fica como guarda contra regressão, não como RED.
- **GREEN 2 (`be6e616`):** serviço `obter`, `useCanal` e a ficha. Nenhum REFACTOR.

## Verificação

- Domínio: `canais.test.ts` 48 passam; `tsc --noEmit` limpo.
- API, contra `postgres:16` de Docker local (porta 55731, `EVOLUTION_URL=` vazio, container removido ao fim): `src/rotas/crm`, `src/servicos`, `src/mensageria`, `src/e2e/canais-fluxo.test.ts` e `src/bootstrap` somam 63 arquivos e 1120 testes passando, o bloco "serviço real, Postgres local" sem skip e os casos "CR-01" na saída; `tsc --noEmit` limpo.
- Web: `ficha-do-canal.test.tsx` 10 passam; `tsc --noEmit` e `eslint` dos dois arquivos limpos.
- Critérios de aceite: todos os `grep` da Task 1 e da Task 2 conferem; `canal-ligar-evolution.ts`, `migracoes/`, `package.json` e `package-lock.json` sem mudança; a web não importa a api.

## Deviations from Plan

None - plan executed exactly as written.

Observações, sem desvio de código:
- O critério de aceite da Task 3 que procura `+55` seguido de 10 ou 11 dígitos em `packages/dominio/CONTEXT.md` encontra 1 linha (53) que não é desta execução: é o identificador fictício de um exemplo do seed, já existente. Nada foi acrescentado com telefone, chave ou endereço.
- O `git status` tem arquivos modificados e não rastreados de outras fases e do planejamento (`docs/09-planejamento/*`, `.planning/phases/13-*`, etc.), deixados como estavam.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum além do registrado: `ligadoAoProvedor` em `GET /canais/:id` é o T-16-63 (aceito, só um booleano para quem já lê o Canal no mesmo Espaço).

## Next Phase Readiness

Fecha a lacuna 1 de `16-VERIFICATION.md` (MSG-05, D-16-03, T-16-62). Os planos 16-18 a 16-22 seguem independentes. A prova na tela real, com o Canal ligado à Evolution de verdade, é do dono (nada foi publicado nem aberto em navegador aqui).

## Self-Check: PASSED

- Arquivos modificados existem; os cinco commits (`9503373`, `0265c27`, `60b5f63`, `be6e616`, `99cd754`) estão no HEAD.
- Sequência TDD: `test(16-17)` precede `feat(16-17)` nos dois ciclos.
