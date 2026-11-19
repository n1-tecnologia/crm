---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 06
subsystem: mensageria
tags: [email, fio, in-reply-to, references, receber-mensagem, contrato-de-provedor, semWebhook, anexos-guardados, tdd]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "mensagemRespondida, destinoDoFio e os campos novos de RecebidaDoProvedor (17-01); plataforma.mensagens.corpo_html (17-04)"
provides:
  - "receberMensagem com o fio do e-mail antes da regra do par, D-17-15, enderecos_adicionais e corpo_html gravados"
  - "ProvedorDeMensageria.semWebhook e idExternoDoEnvio; EnvioAoProvedor.enderecosAdicionais e referencias; AnexoDoEnvio.objectKey e tamanhoBytes"
  - "FabricaDoContrato.semWebhook e recusasQueFaltam (o contrato falha o provedor que aceita chamada externa)"
  - "guardarAnexosRecebidos aceita Pick<ProvedorDeMensageria, baixarMidia>; o processador grava anexosGuardados sem baixar"
affects: [17-07, 17-08, 17-09, 17-10, 17-15, 17-16]

actuals:
  tokens: 12800
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "O fio so existe no Canal de e-mail: a citacao do WhatsApp e do Instagram nunca muda a Conversa"
    - "O contrato de provedor ganha um modo (semWebhook) em vez de um provedor falso que finge aceitar chamada"

key-files:
  created: []
  modified:
    - apps/api/src/servicos/crm/recebimento.ts
    - apps/api/src/servicos/crm/recebimento.test.ts
    - apps/api/src/repositorios/crm/mensagens.ts
    - apps/api/src/mensageria/provedor.ts
    - apps/api/src/mensageria/provedor.test.ts
    - apps/api/src/mensageria/contrato-do-provedor.ts
    - apps/api/src/mensageria/midia.ts
    - apps/api/src/mensageria/processador-de-entrada.ts
    - apps/api/src/mensageria/processador-de-entrada.test.ts
    - apps/api/src/mensageria/CONTEXT.md

key-decisions:
  - "O fio so vale no Canal de e-mail (canal.tipo === email): o emRespostaAIdExterno do WhatsApp e do Instagram continua sendo so citacao e nunca muda a Conversa"
  - "mensagens_conteudo_ck (008, imutavel) exige texto ou anexo: o e-mail so com assunto grava o assunto em conteudo, e o so com HTML grava a frase fixa (sem texto)"
  - "O teste do contrato semWebhook mora em provedor.test.ts (sem banco), com recusasQueFaltam exportada para provar o lado que falha"
  - "recebimento.ts tambem cai em evento.anexosGuardados quando opcoes.anexos nao vem; o processador os passa de qualquer forma"

patterns-established:
  - "A busca do fio recebe uma funcao presa a (Espaco, Canal): nunca atravessa Canal"

requirements-completed: [EML-03, EML-04]

duration: 9min
completed: 2026-11-19
status: complete
plan_head_before: c3cd68c49da7f09180a53b38df9df265323e2b10
plan_head_after: d8f6b388b585bf29d840844892e2edfc54e732fa
commits: 3

coverage:
  - id: D1
    description: "A resposta por e-mail (In-Reply-To ou References) entra na Conversa do fio com em_resposta_a_id; a resolvida reabre mesmo fora da janela do par, a pendente volta a aberta sem contar reabertura"
    requirement: EML-04
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#e-mail: o fio decide a Conversa"
        status: pass
    human_judgment: false
  - id: D2
    description: "A resposta de um colega no mesmo fio entra na Conversa do cliente com o remetente e o Identificador do colega; o Contato da Conversa e o contatoId devolvido nao mudam; o colega vira Contato automatico_mensagem"
    requirement: EML-04
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#a resposta de um colega no mesmo fio"
        status: pass
    human_judgment: true
  - id: D3
    description: "O fio nunca atravessa Canal (mesmo Espaco), nunca reabre Conversa na lixeira e nunca nasce so do assunto Re:"
    requirement: EML-04
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#OUTRO Canal, #na lixeira, #assunto Re:"
        status: pass
    human_judgment: false
  - id: D4
    description: "A recebida grava enderecos_adicionais e corpo_html; obter devolve corpoHtml; so assunto ou so HTML e aceito e sem nada dos quatro e 400"
    requirement: EML-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#grava as copias e o corpo HTML, #sem texto e sem anexo"
        status: pass
    human_judgment: false
  - id: D5
    description: "O contrato aceita o provedor semWebhook (recusa sempre) e falha o que aceita chamada externa; o provedor de teste segue passando sem a flag"
    requirement: EML-03
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedor.test.ts#contrato do provedor sem webhook (17-06)"
        status: pass
    human_judgment: false
  - id: D6
    description: "O processador grava os anexosGuardados do evento sem chamar baixarMidia nem subir ao bucket; sem eles baixa pelo provedor como antes"
    requirement: EML-03
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/processador-de-entrada.test.ts#anexosGuardados"
        status: pass
    human_judgment: false
---

# Phase 17 Plan 06: O nucleo da entrada fala e-mail Summary

**`receberMensagem` acha a Conversa pelo fio (`In-Reply-To`, `References`) so no Canal de e-mail, grava copias e HTML, o contrato de provedor aceita o que busca (`semWebhook`) e o processador usa os anexos que o leitor ja guardou.**

## Performance

- **Duration:** 9 min
- **Tasks:** 3 (1 tracer + 2 auto, todas TDD)
- **Files modified:** 10 (nenhum criado)

## Accomplishments

- Dentro de `processar`, depois de achar ou criar o Contato e antes de `abertaDoPar`: no Canal de e-mail, `mensagemRespondida` (busca presa a Espaco e Canal) e `destinoDoFio`. A resolvida reabre mesmo fora da janela de 72 h do par; a pendente volta a aberta sem contar reabertura; a da lixeira cai na regra do par. `em_resposta_a_id` e a Mensagem achada.
- D-17-15: quando o fio decide, o `contatoId` devolvido e o da Conversa; o remetente verdadeiro fica em `remetente_externo` e no Identificador, e o colega desconhecido vira Contato `automatico_mensagem` a parte.
- A recebida grava `enderecos_adicionais` e `corpo_html` (lido e gravado no repositorio); `validarEvento` aceita so assunto, so HTML ou so `anexosGuardados`.
- `provedor.ts`: `semWebhook`, `idExternoDoEnvio`, `enderecosAdicionais`, `referencias`, `objectKey`, `tamanhoBytes`, todos opcionais (quem os preenche e o 17-07).
- `contrato-do-provedor.ts`: com `semWebhook: true` o primeiro caso exige que `verificarChamada` recuse a chamada de texto, a sem cabecalho e as de `chamadasRecusadas`; `recusasQueFaltam` expoe a conferencia para o teste provar o lado que falha.
- `midia.ts` aceita `Pick<ProvedorDeMensageria, "baixarMidia">`; o processador, com `anexosGuardados`, nao chama a guarda e passa os anexos como `opcoes.anexos`.

## Task Commits

1. **Task 1 (tracer):** `6151113` feat(17-06): a resposta por e-mail cai na Conversa do fio, com copias e HTML gravados
2. **Task 2:** `384fd76` test(17-06): o fio do e-mail nao atravessa Canal nem lixeira e a resposta do colega nao troca o Contato
3. **Task 3:** `d8f6b38` feat(17-06): o contrato aceita o provedor que busca e o processador usa os anexos ja guardados

**Tracer gate:** `<verify>` do tracer re-rodado de ponta a ponta (recebimento.test.ts, 62 testes, mais as suites abaixo): passou, expansao liberada.

## Verification Results

Postgres 16 proprio (container `crm-n1-pg-1706`, porta 55743, migrado ate a 017, removido no fim; nenhum container `supabase_*` tocado).

- `recebimento.test.ts`: 62 testes passando (56 de antes + 6 de e-mail).
- `processador-de-entrada.test.ts`, `provedor.test.ts`, `midia.test.ts`, `e2e/mensageria-entrada.test.ts`: 4 arquivos, 52 testes passando (`<automated>` da Task 3).
- Regressao dos provedores e da entrada compartilhada: `vitest run src/mensageria src/servicos/crm src/e2e/mensageria-entrada.test.ts src/repositorios/crm` = 58 arquivos, 1080 de 1081 passando. Inclui Evolution, Instagram, WhatsApp oficial, processador de entrada, saida, coleta de orfaos e a 017. A unica falha e a ja registrada em `deferred-items.md` (whatsapp-cloud "sem a integracao configurada, 503 dizendo o que falta", `META_APP_SECRET`), nao tocada por este plano.
- `vitest run src/rotas/crm` (a Mensagem agora carrega `corpoHtml: null`): 18 arquivos, 483 testes passando.
- `npx tsc --noEmit` em `apps/api`: limpo. `packages/dominio` nao foi tocado (nao rodei o tsc dele).
- Nao rodei o `npm test` completo da api. Rodei os `<automated>` por partes (o `docker run ... && ...` numa linha so nao foi executado literalmente; mesmas etapas, mesma ordem, porta 55743 pedida pelo orquestrador).
- Acceptance: todos os `grep` do plano batem (`mensagemRespondida(` 1, `destinoDoFio(` 1, `enderecosAdicionais: []` 0, `corpo_html` 5, `D-17-15` 2, `colega` 8, `semWebhook` 6, `readonly semWebhook?: true` 1, `idExternoDoEnvio` 1, `anexosGuardados` 2, `Pick<ProvedorDeMensageria, "baixarMidia">` 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `mensagens_conteudo_ck` recusa a recebida so com assunto ou so com HTML**
- **Found during:** Task 1
- **Issue:** o plano manda aceitar a recebida sem texto e sem anexo se tiver assunto ou HTML, mas a restricao da 008 (imutavel, aplicada) exige `conteudo` nao vazio OU anexo. Sem tratar, a Mensagem passaria na validacao e estouraria 500 no INSERT.
- **Fix:** `conteudoDaMensagem`: sem texto e sem anexo, `conteudo` recebe o assunto; sem assunto (so HTML), a frase fixa `(sem texto)`. O HTML continua em `corpo_html`. Nenhuma migracao nova.
- **Files modified:** `apps/api/src/servicos/crm/recebimento.ts`, `recebimento.test.ts`
- **Commit:** `6151113`
- **Para o dono/17-15:** a frase `(sem texto)` e texto de produto que aparece na Caixa; vale revisar o texto (ou, se preferirem, uma `018` que relaxe a restricao).

**2. [Rule 1 - Bug evitado] O fio so pode valer no Canal de e-mail**
- **Found during:** Task 1
- **Issue:** `emRespostaAIdExterno` tambem e a citacao do WhatsApp e do Instagram (4.4.2). Usa-lo como fio para qualquer Canal faria uma citacao de WhatsApp mover a Mensagem para outra Conversa (inclusive reabrir uma resolvida).
- **Fix:** o passo do fio roda so com `canal.tipo === "email"`. As suites da Evolution, Instagram e WhatsApp oficial continuam verdes.
- **Commit:** `6151113`

### Escolhas dentro da lacuna do plano

- A Task 2 nao teve RED proprio: o comportamento (colega, outro Canal, lixeira, assunto, caixa alta) saiu do mesmo ponto de decisao da Task 1 e os testes passaram na primeira rodada. Foram escritos depois e cobrem cada linha do `<behavior>`; mais um teste do Contato arquivado que volta a `ativo` (D-17-12).
- O RED da Task 3 so apareceu depois de o evento do teste trazer `anexos` junto de `anexosGuardados` (sozinho, `anexosGuardados` ja passava, porque `recebimento.ts` tambem cai neles quando `opcoes.anexos` nao vem). O caso real do leitor e o do teste reforcado: o processador nao baixa mesmo havendo `anexos`.
- O caso "provedor com `verificarChamada` devolvendo true FALHA o contrato" nao pode ser um `it` que falha de proposito; virou `recusasQueFaltam(fabrica)` exportada, que o `it` do contrato usa (esperando vazio) e o teste do provedor errado usa (esperando nao vazio).
- `Mensagem.corpoHtml` passa a sair em `GET /mensagens` (`corpoHtml: null` nos outros Canais); a chave nao da acesso a nada (D-17-13), e os testes de rotas continuam verdes.

**Total deviations:** 2 auto-fixed, nenhuma exigiu decisao do dono alem da frase `(sem texto)`.

## Notas para a revisao (D-17-10 e D-17-15, `[auto]`)

O plano implementa D-17-10 e D-17-15 como escritas, sem confirmacao do dono. Em especial D-17-15: a resposta de outra pessoa no fio entra na Conversa do Contato original e a Conversa nao muda de Contato. O teste do colega cobre isso; a prova real (17-16) deve pedir a confirmacao.

## Auth gates

Nenhum.

## Known Stubs

Nenhum. `idExternoDoEnvio`, `enderecosAdicionais`, `referencias`, `objectKey` e `tamanhoBytes` sao contratos opcionais ainda sem quem os preencha; o 17-07 e o 17-09 os usam (previsto no plano).

## Threat Flags

Nenhuma superficie nova alem do `<threat_model>`. T-17-15 (busca presa a Canal e Espaco, teste do outro Canal) e T-17-17 (`semWebhook` e contrato) mitigados e provados; T-17-18 depende de o leitor (17-08) passar pela guarda de midia da Fase 16.

## Self-Check: PASSED

- Arquivos modificados existem e os commits `6151113`, `384fd76` e `d8f6b38` sao ancestrais de HEAD; `commits: 3` medido do ledger (`c3cd68c..HEAD`).
- Container `crm-n1-pg-1706` removido.

---
*Phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9*
*Completed: 2026-11-19*
