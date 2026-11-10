---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 21
subsystem: mensageria-saida
tags: [identificador, resposta, gap-closure, wr-04, t-16-72, t-16-76, t-16-19, tdd]

requires:
  - phase: 16-05
    provides: o entregador da saída e a leitura dos Identificadores do Contato da Conversa (T-16-19)
  - phase: 16-19
    provides: o CONTEXT.md do domínio que este plano também edita
  - phase: 16-20
    provides: o bloco "antes do envio" (preparar) de entregar-mensagem.ts onde a leitura nova entra
provides:
  - "@n1/dominio/crm/conversas: identificadorDeResposta(identificadores, canal, idDeQuemEscreveu?)"
  - "RepositorioDeMensagens.identificadorDaUltimaRecebida(workspaceId, conversaId)"
  - "entregar-mensagem.ts: o destino da resposta é o Identificador por onde o Contato escreveu por último na Conversa"
  - "identificadorDoCanal (abrir Conversa e Tarefa conversacional) sobre a mesma função do domínio, sem o id de quem escreveu"
affects: [16-VERIFICATION lacuna WR-04, 16-SECURITY T-16-19, 16-22 (conferência do dono em produção)]

requirements-completed: [MSG-02]

actuals:
  tokens: 5500
  tasks: 2
  commits: 3
plan_head_before: 421c682a2a4a6fd135146619f587949bf0c2d119
plan_head_after: 9eca467801a0a39203868e47c16d37d4593cfc65

tech-stack:
  added: []
  patterns:
    - "A regra de escolher o destino mora no domínio e as duas pontas (entregador e abrir Conversa) a chamam: uma regra só, sem divergir"
    - "O id vindo de dado gravado (o identificador_id da recebida) só ESCOLHE dentro de uma lista lida com workspace_id e contato_id da Conversa; nunca vira destino por si"

key-files:
  created: []
  modified:
    - packages/dominio/src/crm/conversas.ts
    - packages/dominio/src/crm/conversas.test.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/repositorios/crm/mensagens.ts
    - apps/api/src/repositorios/crm/mensagens.test.ts
    - apps/api/src/mensageria/entregar-mensagem.ts
    - apps/api/src/mensageria/entregar-mensagem.test.ts
    - apps/api/src/mensageria/CONTEXT.md
    - apps/api/src/servicos/crm/conversas.ts

key-decisions:
  - "\"Por onde o Contato escreveu\" é o identificador_id da última Mensagem recebida da Conversa (criado_em e seq decrescentes), já gravado pela recepção: a Conversa não ganha coluna e não há migração"
  - "Identificador de quem escreveu que não está mais na lista do Contato da Conversa (transferido ou removido) ou é de outro tipo que o do Canal volta ao principal do tipo, como antes"
  - "O entregador chama identificadorDeResposta direto (tem a frase própria para Contato sem Identificador); identificadorDoCanal continua devolvendo o 409 de quem abre Conversa, agora sobre a mesma função"

patterns-established:
  - "identificadorDaUltimaRecebida ignora recebidas sem Identificador (Contato novo sem vínculo): salta para a anterior que tem"

coverage:
  - id: D1
    description: "Com um Contato de dois WhatsApp (A principal e B) que escreveu de B, a resposta escrita na Caixa sai para B e não para A; a Mensagem fica enviada"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#WR-04: o Contato que escreveu do segundo número recebe a resposta nesse número, não no principal"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/crm/conversas.test.ts#WR-04: com o id de quem escreveu entre os do tipo do Canal, devolve esse"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sem Mensagem recebida na Conversa a resposta sai para o principal; com o número de quem escreveu transferido a outro Contato ela sai para o principal que sobrou, nunca para o número transferido (T-16-76)"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#WR-04: sem nenhuma Mensagem recebida na Conversa a resposta sai para o principal"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#WR-04: o número por onde ele escreveu foi transferido a outro Contato antes da resposta"
        status: pass
    human_judgment: false
  - id: D3
    description: "A regra do domínio cobre id desconhecido, Identificador de outro tipo, sem principal do tipo e sem nenhum do tipo; abrir Conversa e Tarefa conversacional seguem indo ao principal"
    requirement: MSG-02
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/conversas.test.ts#identificadorDeResposta (WR-04)"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts e tarefas-conversacionais.test.ts (sem mudança)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Em produção, com a Evolution real, um Contato com dois números que escreve do segundo recebe a resposta no celular certo"
    requirement: MSG-02
    verification: []
    human_judgment: true
    rationale: "Provado só com o provedor de teste e um Postgres 16 de Docker; o número exato que a Evolution entrega como remetente casar com o Identificador é a conferência do dono no plano 16-22"

duration: 3min
completed: 2026-11-10
status: complete
---

# Phase 16 Plan 21: A resposta sai por onde o Contato escreveu (WR-04) Summary

**A resposta escrita numa Conversa agora sai para o Identificador da última Mensagem recebida dela (`identificadorDeResposta`, regra do domínio), desde que ainda seja do Contato da Conversa e do tipo do Canal; sem recebida ou com o número transferido, volta ao principal, e abrir Conversa usa a mesma função sem o id.**

## Performance

- **Duration:** ~3 min de relógio (18:26 a 18:29 UTC)
- **Completed:** 2026-11-10
- **Tasks:** 2 (1 traçador TDD, 1 automática TDD com documentação)
- **Files:** 9 modificados, nenhum criado; nenhuma migração

## Accomplishments

- `packages/dominio/src/crm/conversas.ts`: `identificadorDeResposta(identificadores, canal, idDeQuemEscreveu?)` filtra os do tipo do Canal (`TIPO_DE_IDENTIFICADOR_DO_CANAL`) e devolve o de quem escreveu se estiver entre eles, senão o principal do tipo, senão o primeiro, senão `undefined`.
- `repositorios/crm/mensagens.ts`: `identificadorDaUltimaRecebida(workspaceId, conversaId)` na interface e na implementação (a `recebida` mais recente com `identificador_id`, por `criado_em` e `seq` decrescentes; o índice `mensagens_conversa_idx` cobre).
- `mensageria/entregar-mensagem.ts`: dentro do `preparar()` lê os Identificadores do Contato da Conversa (como antes, com `workspace_id` e `contato_id` da Conversa) e o id da última recebida, e escolhe o destino com `identificadorDeResposta`; sem destino, a mesma recusa `CONTATO_SEM_IDENTIFICADOR_DO_CANAL` com a frase do entregador.
- `servicos/crm/conversas.ts`: `identificadorDoCanal` escolhe por `identificadorDeResposta` (sem o id), com o genérico pedindo também `id`; o 409 e a frase ficam iguais e os dois chamadores não mudaram.
- `CONTEXT.md` da mensageria (o destino é por onde o Contato escreveu, com a regra e o T-16-19) e do domínio (uma entrada sobre `identificadorDeResposta`).
- Testes: cinco "WR-04" no domínio, três com banco em `entregar-mensagem.test.ts` (segundo número, sem recebida, número transferido) e um do repositório (`identificadorDaUltimaRecebida`, incluindo a recebida mais nova sem Identificador e o isolamento por Espaço). O `cenario` do arquivo passou a devolver `contatoId`, `idDoPrincipal` e `numeroDoPrincipal`, e ganhou o auxiliar `comSegundoNumero`.

## TDD

- **RED (`68a9074`):** o domínio falhou com `identificadorDeResposta is not a function` nos cinco casos (a função não existia, então o alvo executou e falhou por falta do comportamento). No Postgres local, o caso alvo da api falhou na asserção planejada: `expected '+5511987650017' to be '+5511976540017'` (a resposta saía para o principal A em vez de B). Os casos "sem recebida" e "número transferido" passaram no RED de propósito: já valiam com o principal e ficam como guarda contra a regressão do caminho novo (T-16-76), que é onde um erro de implementação mandaria a resposta ao número de outro Contato. `tdd_mode` desligado: o classificador `tdd-red-evidence` não foi exigido; a avaliação semântica foi feita à mão.
- **GREEN (`2551c77`):** a função do domínio, a leitura do repositório e o entregador. Domínio 46 passam; api: `entregar-mensagem`, `repositorios/crm/mensagens`, `e2e/mensageria` e `e2e/mensageria-entrada` (33 passam).
- **REFACTOR (`9eca467`):** `identificadorDoCanal` sobre a função do domínio e os `CONTEXT.md`, sem mudar comportamento (`refactor`, não `feat`).

## Verificação

- Postgres 16 de Docker (`crm-n1-pg-1621`, porta 55734, `EVOLUTION_URL=` vazio, removido no fim; recriado limpo antes de cada rodada): Task 1: `entregar-mensagem`, `repositorios/crm/mensagens`, `e2e/mensageria` e `e2e/mensageria-entrada` (4 arquivos, 33 testes). Task 2: `entregar-mensagem`, `servicos/crm/conversas`, `servicos/crm/tarefas-conversacionais` e `e2e/mensageria` (4 arquivos, 119 testes), nenhum skipped. `npx tsc --noEmit` limpo no `apps/api` e no `packages/dominio`; domínio inteiro: 132 arquivos, 2465 testes passam.
- Critérios de aceite: `export function identificadorDeResposta` (1), `identificadorDaUltimaRecebida` no repositório (2), no entregador `identificadorDeResposta` (2) e `identificadorDaUltimaRecebida` (1), "WR-04" no teste da api (4) e no do domínio (6), `identificadorDeResposta` em `servicos/crm/conversas.ts` (2), `CONTATO_SEM_IDENTIFICADOR_DO_CANAL` ali (1), `moverIdentificador` no teste da api (1), nos dois `CONTEXT.md` (1 cada); `git diff --name-only -- apps/api/migracoes` vazio.
- O `apps/api` e o domínio não têm lint próprio (o `npm run lint` da raiz cobre só o `apps/web`); o web não foi tocado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Ordem] O teste do Identificador transferido nasceu na Task 1, não na Task 2**
- **Found during:** Task 1 (RED)
- **Issue:** o plano põe o caso do número transferido na Task 2, mas ele só faz sentido ao lado do caso do segundo número, que usa o mesmo auxiliar do `cenario`. Escrevê-lo no RED da Task 1 também protege a implementação nova (T-16-76) desde o GREEN.
- **Fix:** os três casos de api entraram juntos no commit RED; a Task 2 ficou com a refatoração de `identificadorDoCanal` e os `CONTEXT.md`. Nenhum comportamento a menos foi coberto.
- **Commit:** `68a9074`

**2. [Rule 2 - Cobertura] Teste do repositório para `identificadorDaUltimaRecebida`**
- **Found during:** Task 1 (GREEN)
- **Issue:** o plano lista `repositorios/crm/mensagens.test.ts` na verificação, mas não pede um caso para a leitura nova (a recebida mais nova sem Identificador, o isolamento por Espaço).
- **Fix:** um caso "WR-04" e uma asserção de isolamento no caso que já existia.
- **Files modified:** `apps/api/src/repositorios/crm/mensagens.test.ts`
- **Commit:** `2551c77`

**Total deviations:** 2 (1 de ordem entre tarefas, 1 de cobertura adicionada). **Impact:** nenhum no comportamento entregue.

## Threat Flags

Nenhum: não há endpoint, caminho de autenticação nem acesso a arquivo novos. O id de quem escreveu nunca vira destino por si: só escolhe dentro de `listarIdentificadores(workspace_id, contato_id da Conversa)` (T-16-76, T-16-19); nenhum dado novo vai a log.

## Known Stubs

Nenhum.

## Self-Check: PASSED

- Os nove arquivos listados em `key-files.modified` existem e foram commitados.
- Commits `68a9074`, `2551c77` e `9eca467` são ancestrais de `HEAD`; `git rev-list --count 421c682..HEAD` = 3 (medido antes do commit deste SUMMARY).
