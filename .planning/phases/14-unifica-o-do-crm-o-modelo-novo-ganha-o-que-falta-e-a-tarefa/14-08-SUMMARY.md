---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 08
subsystem: api
tags: [crm, consentimento, contatos, mensagens, uni-07, t-14-19, vitest, postgres]

requires:
  - phase: 14-01
    provides: tabela `plataforma.contato_consentimentos` (011), só inserção
  - phase: 14-04
    provides: Contato `mesclado` somente leitura
  - phase: 14-06
    provides: molde de Notas do Contato (repositório, serviço, rota) e `rotas/CONTEXT.md`
provides:
  - "`@n1/dominio/crm/consentimentos` (`consentimentoVigente`, `validarNovoConsentimento`, `recusaPorFaltaDeConsentimento` e os três vocabulários)"
  - "`GET`/`POST /contatos/:id/consentimentos` sobre a tabela, só inserção"
  - "`finalidadeDeConsentimentoAtiva` e `finalidadeDeMarketing` em `repositorios/crm/referencias.ts`"
  - "`ServicoDeMensagens.enviar` recusa modelo de marketing sem consentimento (409 `SEM_CONSENTIMENTO`), com `deps.categoriaDoModelo` injetável"
affects: [14-09, 14-11, fase-15, fase-16]

actuals:
  tokens: 15300
  tasks: 3
  commits: 6
plan_head_before: 8746b07120228e7dbf399b82b6fec2e277c5d5db
plan_head_after: e2ee0dd0ab7752592579922c8caf6465786c407d
commits: 6

tech-stack:
  added: []
  patterns:
    - "repositório de histórico só com `inserir` e leitura: a ausência de `update`/`delete` é a mitigação de Repudiation (T-14-19)"
    - "regra de recusa que a Sessão 7 vai ligar entregue pronta atrás de um parâmetro injetável (`categoriaDoModelo`), sem caminho HTTP"

key-files:
  created:
    - packages/dominio/src/crm/consentimentos.ts
    - packages/dominio/src/crm/consentimentos.test.ts
    - apps/api/src/repositorios/crm/consentimentos.ts
    - apps/api/src/servicos/crm/consentimentos.ts
    - apps/api/src/servicos/crm/consentimentos.test.ts
    - apps/api/src/rotas/crm/consentimentos.ts
    - apps/api/src/rotas/crm/consentimentos.test.ts
  modified:
    - packages/dominio/CONTEXT.md
    - apps/api/src/repositorios/crm/referencias.ts
    - apps/api/src/servicos/crm/mensagens.ts
    - apps/api/src/servicos/crm/mensagens.test.ts
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "`validarNovoConsentimento` dá 5 minutos de folga ao relógio da tela: `em` só é recusado se passar de agora + 5 min, para quem registra 'agora' não tomar 400 por segundos de diferença."
  - "Sem a finalidade Marketing no Catálogo, `recusaPorFaltaDeConsentimento` recusa (não há como provar consentimento), a mesma conta de `marketingConsentMissing`."
  - "`GET /contatos/:id/consentimentos` devolve o histórico inteiro, sem paginação (`{ itens, total }`): é lista curta e a tela calcula o vigente."
  - "O contato arquivado aceita consentimento (como aceita Nota e Negócio); só `mesclado` e `na_lixeira` recusam."
  - "A checagem de evidência é método de leitura do repositório de consentimentos (`mensagemEhDoContato`), para não abrir `repositorios/crm/mensagens.ts`, que está fora de `files_modified`."

patterns-established:
  - "Consentimento e Nota não gravam Registro de Atividade nem avançam a revisão do Espaço; nada de consentimento entra em `GET /estado`."

requirements-completed: [UNI-07]

coverage:
  - id: D1
    description: "consentimentoVigente devolve o registro mais recente (por em) da finalidade para o tipo do Canal ou para todos: concedido, revogado depois, todos que vale para email e outro tipo que não vale"
    requirement: UNI-07
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/consentimentos.test.ts#consentimentoVigente"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /contatos/:id/consentimentos grava linha com registrado_por igual ao Membro da sessão; revogar insere um revogado e mantém a linha anterior; o repositório não tem update nem delete"
    requirement: UNI-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/consentimentos.test.ts#(a) e (b)"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/crm/consentimentos.test.ts#POST grava pelo serviço com o Membro da sessão; não existe rota de edição nem de exclusão"
        status: pass
    human_judgment: false
  - id: D3
    description: "Finalidade conferida contra o Catálogo do Espaço (400 finalidadeId) e evidência conferida por join Mensagem, Conversa, Contato (400 evidenciaMensagemId); Contato mesclado ou na lixeira é 409; outro Espaço é 404; Convidado é 403"
    requirement: UNI-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/consentimentos.test.ts#(c) a (h)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ServicoDeMensagens.enviar recusa com 409 SEM_CONSENTIMENTO o modelo de marketing sem consentimento vigente para o tipo do Canal, com o resolvedor de modelo injetado; utilidade, sem resolvedor e Mensagem interna não mudam"
    requirement: UNI-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mensagens.test.ts#SEM_CONSENTIMENTO (14-08, 3.2.4)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-11-04
status: complete
---

# Phase 14 Plan 08: Consentimento do Contato no modelo novo Summary

**Consentimento registrado e revogado só por inserção em `plataforma.contato_consentimentos` (`GET`/`POST /contatos/:id/consentimentos`), com o vigente derivado no domínio e o envio de modelo de marketing recusando com 409 `SEM_CONSENTIMENTO` quem não consentiu, pronto para a Sessão 7.**

## Performance

- **Duration:** 22 min
- **Tasks:** 3 (cada uma com RED e GREEN)
- **Files modified:** 13 (7 criados, 6 alterados)

## Accomplishments

- Regra no domínio (`crm/consentimentos.ts`): `consentimentoVigente` (o mais recente por `em` da finalidade para o tipo do Canal ou `todos`; empate pelo `registradoEm`), `validarNovoConsentimento` (vocabulários da 011, finalidade preenchida, `em` não futuro com o campo `em`) e `recusaPorFaltaDeConsentimento` (a conta de `marketingConsentMissing` sobre as linhas novas).
- Histórico imutável (T-14-19): o repositório só tem `inserir`, `listarDoContato` e a leitura de evidência; revogar é um `POST` com `revogado` e a linha anterior continua (teste (b)). Não há `PUT`/`PATCH`/`DELETE` e a rota prova isso com 404.
- O registrador é o Membro da sessão e `registrado_em` é do banco; `registradoPor`, `registradoEm`, `contatoId` e `workspaceId` no corpo são 400. Finalidade conferida no Catálogo do Espaço (T-14-20) e evidência por `join` Mensagem → Conversa → Contato no mesmo Espaço; ambas com teste de outro Espaço.
- `ServicoDeMensagens.enviar` aplica a recusa depois da janela de 24 h, só para `enviada`, só quando `deps.categoriaDoModelo` devolve uma categoria. Hoje ninguém passa o resolvedor e `POST /mensagens` não muda.

## Task Commits

1. **Task 1 RED:** `bde2582` (test) regra do consentimento no domínio, com falha esperada
2. **Task 1 GREEN:** `a25a0fb` (feat) regra do consentimento do Contato no domínio
3. **Task 2 RED:** `c0ff639` (test) consentimentos na api, com falha esperada
4. **Task 2 GREEN:** `e7eda5c` (feat) `GET`/`POST /contatos/:id/consentimentos`, só inserção
5. **Task 3 RED:** `2cdbbd3` (test) envio de modelo de marketing sem consentimento, com falha esperada
6. **Task 3 GREEN:** `e2ee0dd` (feat) envio de modelo de marketing recusa quem não consentiu

**Plan metadata:** commit de docs que fecha o plano (SUMMARY, STATE, ROADMAP).

## TDD Gate Compliance

- **RED Task 1** (`bde2582`): 11 de 18 testes falharam e 7 passaram (os casos que esperam `undefined` e as entradas válidas, que o esqueleto que aceita tudo satisfaz). Avaliação semântica: o alvo executou e cada falha é a ausência planejada da regra (esperado `field: "em"`, recebido `ok: true`; esperada a frase, recebido `undefined`). O módulo nasceu com esqueleto porque importar módulo inexistente seria INVALID_RED.
- **RED Task 2** (`c0ff639`): 21 de 23 testes falharam; os 2 que passaram são o `401` sem Authorization e o "não existe PUT/PATCH/DELETE" (404 sem a rota). Os 8 do serviço falharam com `esperava sucesso, veio 404 : Ainda não implementado.` ou com status e código diferentes do esperado: o banco migrado até a 011 e a fixture (Catálogo, Contato, Canal, Conversa e Mensagem) funcionaram, a falha é só a regra ausente.
- **RED Task 3** (`2cdbbd3`): 4 de 19 testes falharam com `esperava recusa, veio sucesso` (marketing sem consentimento, revogado depois, outro tipo de Canal e sem finalidade); os 15 restantes (inclusive os casos que NÃO devem mudar) seguiram passando. Só o tipo de `categoriaDoModelo` entrou no RED, para o `tsc` ficar limpo.
- **GREEN** (`a25a0fb`, `e7eda5c`, `e2ee0dd`): domínio 117 arquivos, 2291 testes; api com Postgres 16 migrado até a 011, ver Verification.
- **REFACTOR:** nenhum commit. Um `amend` do commit GREEN da Task 1 corrigiu só o assunto da mensagem (ainda local, nada publicado).
- O classificador `check tdd-red-evidence` não foi rodado: o vitest não persiste TAP/JUnit neste repositório (mesma situação de 14-04 e 14-06); a evidência é o relatório da execução.

## Files Created/Modified

- `packages/dominio/src/crm/consentimentos.ts` - os três vocabulários, `ConsentimentoDoContato`, `NovoConsentimento`, `validarNovoConsentimento`, `consentimentoVigente`, `recusaPorFaltaDeConsentimento`.
- `apps/api/src/repositorios/crm/consentimentos.ts` - `inserir`, `listarDoContato`, `mensagemEhDoContato`.
- `apps/api/src/repositorios/crm/referencias.ts` - `finalidadeDeConsentimentoAtiva`, `finalidadeDeMarketing`.
- `apps/api/src/servicos/crm/consentimentos.ts` - `ServicoDeConsentimentos`, código `CONSENTIMENTO_RECUSADO`.
- `apps/api/src/servicos/crm/mensagens.ts` - `deps.categoriaDoModelo` e o 409 `SEM_CONSENTIMENTO`.
- `apps/api/src/rotas/crm/consentimentos.ts` e `index.ts` - `rotasDeConsentimentos` e `OpcoesDeCrm.consentimentos`.
- Testes: `consentimentos.test.ts` nas três camadas e os casos novos em `servicos/crm/mensagens.test.ts`.
- `apps/api/src/rotas/CONTEXT.md`, `packages/dominio/CONTEXT.md` - as rotas e as regras.

## Decisions Made

- 5 minutos de folga de relógio em `em` (`FOLGA_DE_RELOGIO_MS`): o plano diz "no futuro é erro" e o teste de "amanhã" continua valendo; a folga evita 400 por relógio da tela adiantado.
- Sem finalidade Marketing no Catálogo a regra recusa, como `marketingConsentMissing`.
- `GET` sem paginação; `listar` do serviço devolve `Pagina` com `total = itens.length` para reaproveitar `responderLista`.
- Contato arquivado aceita consentimento; só `mesclado` e `na_lixeira` recusam, com a frase de cada um e o código `CONSENTIMENTO_RECUSADO`.
- A evidência é conferida por `mensagemEhDoContato` no repositório de consentimentos, porque `repositorios/crm/mensagens.ts` não está em `files_modified`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Rede de erro do `em` e vocabulários no domínio**
- **Found during:** Task 1
- **Issue:** o plano só pedia a recusa de `em` no futuro, mas a função também é a porta de quem chama o serviço sem passar por zod; um `em` que não é instante ou um vocabulário fora da 011 viraria 500 do CHECK.
- **Fix:** `validarNovoConsentimento` também recusa `em` ilegível (campo `em`), finalidade em branco e decisão, origem e tipo de Canal fora do vocabulário, cada um com o seu campo.
- **Files modified:** `packages/dominio/src/crm/consentimentos.ts`, `consentimentos.test.ts`
- **Verification:** casos "não é um instante" e "fora do vocabulário" do teste de domínio.
- **Committed in:** `a25a0fb`

**2. [Rule 3 - Blocking] Esqueletos no RED**
- **Found during:** Tasks 1, 2 e 3
- **Issue:** módulos novos não existem antes do GREEN e importar módulo inexistente é falha de carga, que é INVALID_RED.
- **Fix:** o commit RED leva um esqueleto sem comportamento (domínio que aceita tudo, serviço que devolve 404, rota que não registra nada, e o tipo opcional de `categoriaDoModelo`).
- **Files modified:** os mesmos arquivos do GREEN
- **Committed in:** `bde2582`, `c0ff639`, `2cdbbd3`

**3. [Rule 2 - Missing Critical] Comentário do cabeçalho de `rotas/crm/index.ts`**
- **Found during:** Task 3
- **Issue:** o cabeçalho enumera os recursos do CRM e não citava `notas` nem `consentimentos`.
- **Fix:** três linhas de comentário; `index.ts` já estava em `files_modified`.
- **Committed in:** `e2ee0dd`

---

**Total deviations:** 3 (2 Rule 2, 1 Rule 3)
**Impact on plan:** nenhuma muda contrato público além do que o plano pedia; a folga de relógio é decisão registrada acima.

## Issues Encountered

- O RED da Task 3 inicial deu "no tests" porque o arquivo de teste não importava `describe`; corrigido antes do commit.
- Nenhuma falha pré-existente apareceu. O caso `outbox-worker` do baseline do 14-07 não ocorreu: `persistencia` rodou em lote próprio e passou inteiro.

## Verification

- `packages/dominio`: `vitest run` 117 arquivos, 2291 testes, `tsc --noEmit` limpo; guarda D-06 do domínio passou.
- `apps/api` com Postgres 16 descartável migrado até a 011 (porta 55608, contêiner `crm-n1-pg-1408` removido ao fim): `src/persistencia` 20 arquivos e 181 testes; `rotas/operacoes.test.ts` + `rotas/estado.test.ts` 2 arquivos e 48 testes (lote separado); `servicos`, `rotas/crm`, `repositorios` e a guarda D-06 da api 29 arquivos e 468 testes; os arquivos do plano (`consentimentos.test.ts` do serviço e das rotas, `mensagens.test.ts` do serviço e das rotas) passam sem pulados; o restante da api (todos os outros arquivos) 167 arquivos passando e 2 pulados que já existiam; `tsc --noEmit` limpo.
- Critérios de aceite: `grep` de `update`/`delete` no repositório de consentimentos = 0; `/contatos/:id/consentimentos` na rota = 4; `finalidadeDeConsentimentoAtiva`/`finalidadeDeMarketing` = 2; `SEM_CONSENTIMENTO` em `mensagens.ts` = 2 e em `rotas/CONTEXT.md` = 2; `categoriaDoModelo` em `mensagens.ts` = 4; funções do domínio = 3.

## Known Stubs

Nenhum. `deps.categoriaDoModelo` ausente é o padrão deliberado e documentado: a Sessão 7 (Fase 16) é quem o preenche.

## Threat Flags

Nenhum. T-14-19 (histórico adulterado) mitigado: repositório só insere e lê, registrador da sessão, `registrado_em` do banco, revogar insere, sem rota de edição ou exclusão (provado por teste e por `grep`). T-14-20 (evidência ou finalidade de outro Espaço) mitigado e testado com 400. T-14-21 (vazamento) mitigado: nada em `hidratar()` nem em `GET /estado`, e o serviço não loga o corpo.

## Next Phase Readiness

- A ficha nova (14-11) pode chamar `GET`/`POST /contatos/:id/consentimentos` e calcular o vigente com `consentimentoVigente` do domínio.
- A mesclagem (14-09) decide o que fazer com as linhas de `contato_consentimentos` do absorvido: este plano não as move, e o Contato `mesclado` recusa consentimento novo (409), então o histórico do absorvido fica congelado.
- `FRASES_DE_CONTATOS` ainda não traduz `contato_consentimentos_*`: este plano não depende disso (a forma é validada no domínio e no zod antes do banco), então nenhuma tradução foi acrescentada.
- Para a Sessão 7: passar `categoriaDoModelo` em `criarServicoDeMensagens` e dar a `NovaMensagem` o campo de modelo; a regra e o código `SEM_CONSENTIMENTO` já estão testados.
- Em aberto (OQ7, a confirmar): a finalidade segue validada contra o Catálogo em `registros`; e (A7) os consentimentos saem em cascata se o Contato for excluído de vez (já é assim na 011).

## Self-Check: PASSED

Arquivos criados presentes; commits `bde2582`, `a25a0fb`, `c0ff639`, `e7eda5c`, `2cdbbd3`, `e2ee0dd` presentes na branch; contêiner `crm-n1-pg-1408` removido.

---
*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Completed: 2026-11-04*
