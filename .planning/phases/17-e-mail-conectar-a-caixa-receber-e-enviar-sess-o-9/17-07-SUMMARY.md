---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 07
subsystem: mensageria
tags: [email, saida, assunto, copias, fio, referencias, idExternoDoEnvio, anexos, bucket, baixar]
requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "validarNovaMensagem(entrada, canal), validarTamanhoDoEmail, assuntoDaResposta (17-01); EnvioAoProvedor.enderecosAdicionais/referencias, AnexoDoEnvio.objectKey/tamanhoBytes, idExternoDoEnvio (17-06); enderecos_adicionais e assunto na 017 (17-04)"
provides:
  - "POST /mensagens aceita assunto e enderecosAdicionais (strict) e ate 10 arquivos; o servico valida pelas capacidades do Canal da Conversa"
  - "A enviada de e-mail grava assunto (Re: + o da ultima recebida quando nao digitado) e copias normalizadas; 422 EMAIL_GRANDE_DEMAIS acima de 20 MB (tamanhos confirmados no bucket)"
  - "A entrega leva assunto, enderecosAdicionais, referencias (fio em ordem), emRespostaAIdExterno (citada ou ultima recebida) e anexos com objectKey e tamanhoBytes"
  - "idExternoDoEnvio gravado em id_externo antes de enviar; codigo de Canal desconectado deixa a Mensagem pendente; frasesDaSaida(tipoDoCanal)"
  - "ArmazenamentoDeAnexos.baixar / baixarObjeto (bytes do bucket com teto) e baixar no armazenamento falso"
affects: [17-08, 17-09, 17-11, 17-14, 17-15, 17-16]
actuals:
  tokens: 11500
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - "A forma do corpo depende do Canal da Conversa: o servico le Conversa e Canal antes da transacao e passa as capacidades ao dominio"
    - "O id externo que o provedor conhece antes de enviar e gravado antes da chamada (resposta ambigua nunca fica sem id)"
key-files:
  created: []
  modified:
    - apps/api/src/rotas/crm/mensagens.ts
    - apps/api/src/rotas/crm/mensagens.test.ts
    - apps/api/src/servicos/crm/mensagens.ts
    - apps/api/src/servicos/crm/mensagens.test.ts
    - apps/api/src/repositorios/crm/mensagens.ts
    - apps/api/src/mensageria/entregar-mensagem.ts
    - apps/api/src/mensageria/entregar-mensagem.test.ts
    - apps/api/src/servicos/armazenamento-de-anexos.ts
    - apps/api/src/servicos/storage-uploads.ts
    - apps/api/src/servicos/storage-uploads.test.ts
    - apps/api/src/testes/armazenamento-falso.ts
    - apps/api/src/e2e/mensageria-midia.test.ts
key-decisions:
  - "Conversa e Canal sao lidos fora da transacao so para validar a forma (assunto, copias, quantos arquivos); a transacao os le de novo e e a fonte da verdade para o teto de 20 MB e para o assunto"
  - "idsExternosDoFio ordena por seq (ordem de chegada ao banco), como o plano manda, e nao por criado_em do provedor"
  - "Os campos objectKey e tamanhoBytes saem em todo anexo de todo Canal (nao so e-mail); os outros provedores os ignoram"
  - "O codigo de Canal desconectado devolvido pelo provedor so vale depois do teste de resultado ambiguo (ambiguo vence: nunca reenvia sozinho)"
requirements-completed: [EML-05]
duration: 24min
completed: 2026-11-19
status: complete
plan_head_before: 2c28aed19771ca4688b8f246dc8c1b23302da3dd
plan_head_after: a1f0ff1821b278e0250085e19572129410cda116
commits: 3
coverage:
  - id: D1
    description: "POST /mensagens num Canal de e-mail grava assunto e copias normalizadas e a linha mensagem.enviar.v1 no mesmo commit; sem assunto vira Re: + assunto da ultima recebida; no WhatsApp assunto e copias dao 400"
    requirement: EML-05
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mensagens.test.ts#e-mail: assunto, copias e arquivos (17-07)"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/crm/mensagens.test.ts#assunto e copias (17-07): o servidor real"
        status: pass
    human_judgment: false
  - id: D2
    description: "E-mail com 3 anexos (5 MB) passa, 2 anexos de 21 MB dao 422 EMAIL_GRANDE_DEMAIS sem gravar nada, 11 anexos dao 400 e os outros Canais seguem com um arquivo"
    requirement: EML-05
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mensagens.test.ts#3 arquivos / 21 MB / 11 arquivos"
        status: pass
    human_judgment: false
  - id: D3
    description: "A entrega leva assunto, copias (com a oculta), referencias em ordem do fio, emRespostaAIdExterno (citada ou ultima recebida) e anexos com objectKey e tamanhoBytes"
    requirement: EML-05
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#e-mail: o envio completo (17-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "idExternoDoEnvio gravado antes da chamada (Mensagem ainda pendente), mantido no aceite; ambiguo fica com o id, frase de Enviados e nunca reenvia"
    requirement: EML-05
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#grava o id_externo ANTES de chamar o provedor / resposta ambigua"
        status: pass
    human_judgment: false
  - id: D5
    description: "O codigo de Canal desconectado deixa a Mensagem pendente e a linha failed/CANAL_DESCONECTADO, e a volta do Canal reabre e envia"
    requirement: EML-05
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#D-17-20"
        status: pass
    human_judgment: false
  - id: D6
    description: "A resposta a um fio em que um colega escreveu por ultimo sai para o Contato da Conversa (A15 / D-17-15)"
    requirement: EML-05
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#A15 / D-17-15"
        status: pass
    human_judgment: true
  - id: D7
    description: "baixar devolve os bytes do bucket com teto e sem a chave nos erros (real com cliente injetado, falso em memoria)"
    requirement: EML-05
    verification:
      - kind: unit
        ref: "apps/api/src/servicos/storage-uploads.test.ts#baixar os bytes de um objeto, com teto (17-07)"
        status: pass
    human_judgment: false
---

# Phase 17 Plan 07: A saida leva o que o e-mail precisa Summary

**`POST /mensagens` grava assunto e copias, a entrega passa ao provedor assunto, copias, o fio e os anexos pela chave do bucket com o `Message-ID` ja gravado, e o bucket ganha a leitura de bytes com teto (`baixar`).**

## Performance

- **Duration:** 24 min
- **Tasks:** 3 (1 tracer + 2 auto, todas com testes)
- **Files modified:** 12 (nenhum criado)

## Accomplishments

- `NOVA_MENSAGEM` (`strict`) aceita `assunto` (ate 500) e `enderecosAdicionais` (ate 100, cada um `strict`, `nomeExibido` opcional); `anexos` sobe a ate 10 no esquema e o limite por Canal e do dominio. O servico le Conversa e Canal antes da transacao e chama `validarNovaMensagem(entrada, { capacidades })`: no WhatsApp, assunto e copias dao 400 "Este Canal nao tem assunto nem copias.".
- `enviar` grava o assunto digitado ou, sem ele, `assuntoDaResposta(assuntoDaUltimaRecebida)` (sem recebida, `null`) e as copias normalizadas; no Canal com `hasSubjectAndCopies` aplica `validarTamanhoDoEmail` aos tamanhos CONFIRMADOS no bucket (422 `EMAIL_GRANDE_DEMAIS`, antes de gravar e de consumir a sessao).
- A entrega monta `assunto`, `enderecosAdicionais`, `referencias` (ids do fio por `seq`, so no e-mail), `emRespostaAIdExterno` (a citada ou, no e-mail, a ultima recebida) e cada anexo com `objectKey` e `tamanhoBytes`. O destino segue sendo so um Identificador do Contato da Conversa: o colega que escreveu por ultimo entra no fio, nunca como destinatario (A15).
- Com `idExternoDoEnvio` o provedor tem o `id_externo` gravado (`definirIdExterno`, so em enviada pendente) antes da chamada; a resposta ambigua fica com o id e nunca reenvia sozinha. O resultado com `CODIGO_DO_CANAL_DESCONECTADO` deixa a Mensagem `pendente` e a linha `failed` com o codigo, que a volta do Canal reabre.
- `frasesDaSaida(tipoDoCanal)`: no e-mail, "confira em Enviados"; `FRASES_DA_SAIDA` continua sendo o conjunto do WhatsApp (importado por outros arquivos e testes).
- `ArmazenamentoDeAnexos.baixar` e `baixarObjeto(objectKey, tetoBytes, bucket?)`: `download` da service role, teto conferido antes de devolver, erros `falha_ao_baixar_objeto` e `objeto_grande_demais` sem a chave; o falso implementa a mesma porta.

## Task Commits

1. **Task 1 (tracer): assunto e copias no POST /mensagens** - `baa4d6c` (feat)
2. **Task 2: a entrega leva assunto, copias, fio e anexos e grava o id antes** - `e3d11e2` (feat)
3. **Task 3: o bucket devolve os bytes de um objeto, com teto** - `a1f0ff1` (feat)

**Portao do traçador:** o `<verify>` da Task 1 (servico, rota e `canais-fluxo`) foi re-rodado de ponta a ponta antes de expandir: passou, expansao liberada.

## Verification Results

Postgres 16 proprio (container `crm-n1-pg-1707`, porta 55747, migrado ate a 017, removido no fim; nenhum container `supabase_*` tocado). Os `<automated>` do plano nao rodaram literalmente (porta 55747 pedida pelo orquestrador, nao 55734, e por etapas), mas com as mesmas suites.

- Task 1: `servicos/crm/mensagens.test.ts`, `rotas/crm/mensagens.test.ts`, `e2e/canais-fluxo.test.ts`: 128 testes passando.
- Task 2: `mensageria/entregar-mensagem.test.ts` (30), `e2e/mensageria.test.ts`, `persistencia/outbox-worker.test.ts`, `e2e/mensageria-midia.test.ts`: passando.
- Task 3: `storage-uploads.test.ts`, `midia.test.ts`, `coleta-de-orfaos.test.ts` rodados com `DATABASE_URL` vazio como no `<automated>` (48 passam, 13 pulados por falta de banco/bucket real, os 7 testes de `baixar` passam) e de novo, dentro da varredura abaixo, com o banco.
- Regressao dos provedores e do caminho compartilhado: `vitest run src/mensageria src/servicos src/rotas/crm src/e2e src/repositorios/crm src/persistencia/outbox-worker.test.ts` no meu Postgres = 100 arquivos, 1844 passando, 1 falha, 18 pulados, 1 todo. Inclui Evolution, Instagram, WhatsApp oficial, processador de entrada, saida, midia, coleta de orfaos, rotas de Mensagem e a 017. A unica falha e a ja registrada em `deferred-items.md` (whatsapp-cloud, "sem a integracao configurada, 503 dizendo o que falta", `META_APP_SECRET`), nao tocada. Os arquivos pulados sao `e2e/dois-servicos`, `e2e/falhas-injetadas` e `e2e/lista-conversacional-evolution` (dependem de ambiente externo).
- `npx tsc --noEmit` em `apps/api`: limpo. `packages/dominio` e `apps/web` nao foram tocados (nao rodei o tsc deles). Nao rodei o `npm test` completo da api.
- Acceptance: todos os `grep` do plano batem (`enderecosAdicionais` e `.strict()` na rota, `validarTamanhoDoEmail` e `assuntoDaResposta` no servico, `assuntoDaUltimaRecebida`, `idExternoDoEnvio`, `definirIdExterno`, `referencias`, `confira em Enviados`, `baixar(`, `export async function baixarObjeto`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dois testes existentes assumiam o formato antigo da saida**
- **Found during:** Task 1 e Task 2
- **Issue:** `rotas/crm/mensagens.test.ts` ("dois anexos responde 400" com servico falso) e `e2e/mensageria-midia.test.ts` (`toEqual` exato do anexo que chega ao provedor) quebram por consequencia direta do plano: o esquema da rota deixa de limitar a um arquivo (o limite agora e por Canal, no dominio) e todo anexo passa a levar `objectKey` e `tamanhoBytes`.
- **Fix:** o teste de rota ficou so com a chave do objeto no anexo, e o "dois arquivos continuam 400 no WhatsApp" passou a ser provado contra o servidor real (rota + servico, `rotas/crm/mensagens.test.ts` e `servicos/crm/mensagens.test.ts`); o e2e de midia espera os dois campos novos.
- **Files modified:** `apps/api/src/rotas/crm/mensagens.test.ts`, `apps/api/src/e2e/mensageria-midia.test.ts`
- **Commits:** `baa4d6c`, `e3d11e2`

### Escolhas dentro da lacuna do plano

- `baixarObjeto` ganhou um terceiro parametro opcional (o bucket) so para o teste injetar o cliente sem `vi.mock`; sem ele usa o cliente da service role como o plano descreve.
- Um e-mail so com nota interna (`direcao: "interna"`) nao grava assunto nem copias (nao sai pelo Canal), mesmo que a validacao as aceite.
- Os tres commits juntam teste e implementacao (RED observado na saida do vitest antes de implementar nas Tasks 1 e 2; a Task 3 foi escrita junto, o tipo e uma porta nova). O plano e `type: execute`, nao `tdd`, entao nao ha gate de pares RED/GREEN.

**Total deviations:** 1 auto-fixed (teste desatualizado por mudanca prevista); impacto de escopo nenhum.

## Known Stubs

Nenhum. `ArmazenamentoDeAnexos.baixar` e `idExternoDoEnvio` ja tem quem os use na proxima onda (17-09 monta o MIME e implementa `idExternoDoEnvio`; 17-11 le o HTML), mas os dois estao provados aqui por testes.

## Threat Flags

Nenhuma superficie nova alem do `<threat_model>`. T-17-25 (injecao de cabecalho: esquema `strict` com limites + `validarNovaMensagem` antes de gravar, teste de `\r\nBcc:`), T-17-27 (10 arquivos e 20 MB conferidos com os tamanhos do bucket, antes de gravar), T-17-28 (id gravado antes de sair, ambiguo nunca reenvia) e T-17-29 (destino so entre os Identificadores do Contato, teste do colega) mitigados e provados. T-17-26 (copia oculta so no envelope) fica para o 17-09, que monta o `DATA`; este plano so a transporta.

## Self-Check: PASSED

- Os 12 arquivos modificados existem e os commits `baa4d6c`, `e3d11e2` e `a1f0ff1` sao ancestrais de HEAD; `commits: 3` medido do ledger (`2c28aed..HEAD`).
- Container `crm-n1-pg-1707` removido.

---
*Phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9*
*Completed: 2026-11-19*
