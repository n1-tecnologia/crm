---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 12
subsystem: mensageria
tags: [evolution, whatsapp, fetch, webhook, tradutor, provedor, servidor-falso, tdd]

requires:
  - phase: 16-02
    provides: ProvedorDeMensageria, registro, conjunto de contrato (descreverContratoDoProvedor)
  - phase: 16-05
    provides: entregador de saída (ambiguo nunca volta à fila) e sanitizarErro com o padrão apikey
  - phase: 16-10
    provides: guarda de mídia (baixarMidia em fluxo, MIDIA_INDISPONIVEL permanente, PROVEDOR_INDISPONIVEL transitório)
provides:
  - cliente HTTP da Evolution v2.3.7 (fetch, apikey, AbortSignal.timeout) com as oito chamadas da D-16-04
  - tradutor do MESSAGES_UPSERT (texto, imagem, áudio, vídeo, documento, figurinha) com motivos de ignorar
  - criarProvedorEvolution (verificarChamada com segredo + instância, envio sem reenvio automático, baixarMidia)
  - registroPadrao() liga whatsapp-nao-oficial à Evolution só com EVOLUTION_URL
  - sete exemplos sintéticos do webhook e o e2e com o servidor falso
affects: [16-13, 16-14, 16-16, Sessão 4]

actuals:
  tokens: 25000
  tasks: 3
  commits: 6
plan_head_before: a8de2e42a95758e05cb5c22d12295cf2abbee5d5
plan_head_after: 1c5dd6f10e87c9bea2126019edbddfeac0bd32d5

tech-stack:
  added: []
  patterns:
    - "Cliente com função interna chamar() que só lança falha de transporte; o status HTTP volta como dado e quem classifica é o provedor"
    - "Classificação de envio por certeza: conexão recusada e 429/502/503/504 são transitórios; tempo esgotado, resposta perdida e 5xx são ambíguos"
    - "Corpo de erro da Evolution nunca é lido nem repetido (ecoa cabeçalhos); só o 400 é lido, para achar exists:false"

key-files:
  created:
    - apps/api/src/mensageria/provedores/evolution/cliente.ts
    - apps/api/src/mensageria/provedores/evolution/cliente.test.ts
    - apps/api/src/mensageria/provedores/evolution/traduzir.ts
    - apps/api/src/mensageria/provedores/evolution/traduzir.test.ts
    - apps/api/src/mensageria/provedores/evolution/provedor.ts
    - apps/api/src/mensageria/provedores/evolution/provedor.test.ts
    - apps/api/src/mensageria/provedores/evolution/exemplos/texto.json
    - apps/api/src/mensageria/provedores/evolution/exemplos/imagem.json
    - apps/api/src/mensageria/provedores/evolution/exemplos/audio.json
    - apps/api/src/mensageria/provedores/evolution/exemplos/video.json
    - apps/api/src/mensageria/provedores/evolution/exemplos/documento.json
    - apps/api/src/mensageria/provedores/evolution/exemplos/figurinha.json
    - apps/api/src/mensageria/provedores/evolution/exemplos/ignorados.json
    - apps/api/src/e2e/mensageria-evolution.test.ts
  modified:
    - apps/api/src/mensageria/registro.ts

key-decisions:
  - "O cliente devolve a RespostaDaEvolution de qualquer status nos envios e só lança falha de transporte; nas demais funções o status que não é 2xx vira ErroDaEvolution http"
  - "Resposta 2xx de envio sem key.id é ambígua (RESPOSTA_SEM_ID): saiu, mas não há como confirmar, então nunca reenvia"
  - "Áudio com texto sai em duas mensagens (voz e depois sendText); se o texto não se confirma, o resultado é ambíguo para não reenviar o áudio"
  - "interpretarChamada devolve [{ignorado, evento_nao_tratado}] quando o tradutor devolve []: o contrato exige pelo menos um ignorado para corpo fora do formato"
  - "baixarMidia: 429 e 5xx e falha de transporte viram PROVEDOR_INDISPONIVEL (transitório); 401/403 viram CREDENCIAL_AUSENTE; o resto (400/404) MIDIA_INDISPONIVEL"
  - "A credencial do Canal no cofre usa tipo whatsapp-nao-oficial (o que canalParaProvedor já lê), JSON { instancia, apikey } com o token da instância"

patterns-established:
  - "Falha de conexão que prova que o pedido não saiu (ECONNREFUSED, ENOTFOUND, EAI_AGAIN, ENETUNREACH, EHOSTUNREACH, UND_ERR_CONNECT_TIMEOUT) é rede; qualquer outra depois do envio é resposta_perdida"

requirements-completed: [MSG-06]

coverage:
  - id: D1
    description: "Cliente da Evolution com as chamadas da D-16-04, apikey em cada uma, tempo limite e erros que nunca carregam a apikey nem o corpo"
    requirement: MSG-06
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/evolution/cliente.test.ts#cliente da Evolution (22 testes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tradutor do MESSAGES_UPSERT com todos os tipos aceitos e os motivos de ignorar (fromMe, grupo, status, sem_numero, reação, edição, tipo sem suporte)"
    requirement: MSG-06
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/evolution/traduzir.test.ts#traduzirChamadaDaEvolution"
        status: pass
    human_judgment: false
  - id: D3
    description: "verificarChamada confere o segredo em tempo constante E a instância do corpo contra a credencial do Canal"
    requirement: MSG-06
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/evolution/provedor.test.ts#o segredo certo com a instância de OUTRO Canal é recusado"
        status: pass
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-evolution.test.ts#o mesmo corpo com a instância de OUTRO Canal recebe 401"
        status: pass
    human_judgment: false
  - id: D4
    description: "Envio sem reenvio automático do que pode ter saído: classificação permanente, transitória e ambígua; texto, mídia e áudio"
    requirement: MSG-06
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/evolution/cliente.test.ts#provedor da Evolution: enviar nunca reenvia o que pode ter saído"
        status: pass
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-evolution.test.ts#a resposta escrita na Caixa sai por POST /message/sendText"
        status: pass
    human_judgment: false
  - id: D5
    description: "O conjunto de contrato do provedor roda contra a Evolution com o servidor falso, e registroPadrao() liga whatsapp-nao-oficial só com EVOLUTION_URL"
    requirement: MSG-06
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/evolution/provedor.test.ts#contrato do provedor: evolution"
        status: pass
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-evolution.test.ts#registroPadrao() liga whatsapp-nao-oficial à Evolution só quando EVOLUTION_URL existe"
        status: pass
    human_judgment: false
  - id: D6
    description: "Pressupostos que só a instância real do dono responde: versão 2.3.7, getBase64 só com o message, number só com dígitos, @lid sem Alt no número do dono, fetchInstances devolvendo token e ownerJid"
    requirement: MSG-06
    verification: []
    human_judgment: true
    rationale: "A1, A2, A3, A4 e A10 da RESEARCH só se confirmam contra a Evolution real; a prova ao vivo (16-16) é do dono"

duration: 11min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 12: Evolution (adaptador mínimo) Summary

**Adaptador da Evolution v2.3.7 só com `fetch`: cliente com `apikey` e `AbortSignal.timeout`, tradutor do `MESSAGES_UPSERT` de seis tipos, provedor que confere segredo e instância no webhook e nunca reenvia o que pode ter saído, tudo provado contra o servidor falso e pelo conjunto de contrato.**

## Performance

- **Duration:** 11 min (medido do primeiro commit ao último)
- **Started:** 2026-11-09T20:15:59Z
- **Completed:** 2026-11-09T20:26:12Z
- **Tasks:** 3 (1 traçador, 2 automáticas, todas TDD)
- **Files modified:** 15 (14 criados, 1 alterado)

## Accomplishments

- Um `MESSAGES_UPSERT` de texto da instância do Canal entra por `POST /webhooks/mensageria/:canalId` e vira Contato `+5511987654321`, Conversa aberta e Mensagem com o `key.id` como `id_externo`; a resposta escrita na Caixa sai por `POST /message/sendText/inst-teste` com `apikey: tok-inst` e `{ number, text }`, e a Mensagem fica `enviada` com o `key.id` devolvido (e2e com o falso, Canal real, segredo e credencial no cofre).
- O segredo certo com a instância de outro Canal recebe a mesma 401 (T-16-43).
- Cliente completo: `versao`, `buscarInstancia`, `estadoDaConexao`, `configurarWebhook`, `enviarTexto`, `enviarMidia`, `enviarAudio` e `baixarMidia` (corpo `{ message, convertToMp4 }` sem conversão, leitura em fluxo com corte em `ceil(teto x 4/3) + 64 KiB`, base64 conferido por reencode).
- Tradutor: texto, imagem, áudio, vídeo, documento (inclusive `documentWithCaptionMessage`) e figurinha como `image/webp`; `fromMe`, grupo, `status@broadcast`, `@lid` sem Alt, reação, edição e tipo sem suporte viram `ignorado` com motivo; `@lid` com `remoteJidAlt` numérico vira mensagem; instante só de `messageTimestamp`; `apikey` removida da carga bruta em qualquer nível.
- `registroPadrao()` registra `whatsapp-nao-oficial` só quando `EVOLUTION_URL` existe; sem ela o Canal real continua recusando com `PROVEDOR_INDISPONIVEL` (MSG-05).

## RED / GREEN / REFACTOR

Gate de TDD desligado em `config.json` (`tdd_mode: false`), mas a disciplina foi seguida por tarefa.

- **Task 1 (traçador).** RED `fdf16b8`: o e2e e o `texto.json`, com `provedor.ts` só como esqueleto que devolve `false`/`[]` (para o teste falhar na asserção e não no carregamento). Falhou 3 de 5: 401 no lugar de 200 no webhook; a Conversa não existe para a resposta; `registroPadrao()` sem a Evolution. `semanticAssessment`: o alvo executou e falhou na asserção planejada (status 200), não por import nem fixture. GREEN `49f96d2`: 5 de 5.
- **Task 2.** RED `0fe199c` (`cliente.test.ts`, 40 testes): 23 falharam (funções do cliente ainda `não implementado`, envio de mídia e `baixarMidia` do provedor ausentes), 17 passaram (o que a Task 1 já cobria). GREEN `72080f5`: 40 de 40.
- **Task 3.** RED `0219477` (`traduzir.test.ts`, `provedor.test.ts` e seis exemplos): 9 falharam (mídia, reação, edição, nome do arquivo); o contrato da Evolution já passava porque o provedor da Task 2 o cumpria. GREEN `1c5dd6f`: 76 de 76 na pasta da Evolution.
- REFACTOR: não houve.

## Task Commits

1. **Task 1: Traçador (texto entra e a resposta sai por sendText)** - `fdf16b8` (test), `49f96d2` (feat)
2. **Task 2: O cliente inteiro, com tempo limite e a classificação que não duplica envio** - `0fe199c` (test), `72080f5` (feat)
3. **Task 3: O tradutor com todos os tipos e o contrato do provedor** - `0219477` (test), `1c5dd6f` (feat)

**Plan metadata:** commit seguinte (docs: complete plan)

## Files Created/Modified

- `apps/api/src/mensageria/provedores/evolution/cliente.ts` - cliente HTTP, `ErroDaEvolution`, `RespostaDaEvolution`
- `apps/api/src/mensageria/provedores/evolution/traduzir.ts` - `traduzirChamadaDaEvolution`, `semApikey`
- `apps/api/src/mensageria/provedores/evolution/provedor.ts` - `criarProvedorEvolution`
- `apps/api/src/mensageria/provedores/evolution/exemplos/*.json` - sete exemplos sintéticos (números `55119876543xx`, nada real)
- `apps/api/src/mensageria/registro.ts` - `registroPadrao()` com a Evolution quando há `EVOLUTION_URL`
- `apps/api/src/e2e/mensageria-evolution.test.ts` - o traçador ponta a ponta (Docker, porta 55727)
- `cliente.test.ts`, `traduzir.test.ts`, `provedor.test.ts` - testes sem banco

## Decisions Made

Ver `key-decisions`. As de maior efeito para quem vem depois: o `enviar` devolve `ambiguo: true` para tempo esgotado, resposta perdida, 500 e 2xx sem `key.id` (é o que impede o reenvio no entregador do 16-05); `interpretarChamada` nunca devolve lista vazia; `baixarMidia` classifica por status (404/400 permanente, 429/5xx/rede transitório, 401/403 credencial).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Helper de teste com parâmetro padrão engolia o `undefined`**
- **Found during:** Task 2 (GREEN)
- **Issue:** `canalReal(undefined)` acionava o valor padrão e o Canal "sem credencial" tinha credencial; dois testes falhavam por causa do teste, não do código.
- **Fix:** o helper passou a usar `null` para "sem credencial".
- **Files modified:** `cliente.test.ts`
- **Committed in:** `72080f5`

**2. [Rule 3 - Blocking] Porta 1 não recusa a conexão neste ambiente**
- **Found during:** Task 2 (RED)
- **Issue:** `http://127.0.0.1:1` não dá `ECONNREFUSED` aqui (caiu em `resposta_perdida`); o teste de "conexão recusada" ficou dependente do ambiente.
- **Fix:** o teste abre e fecha um servidor numa porta efêmera e usa essa porta livre (`portaSemNinguem`).
- **Files modified:** `cliente.test.ts`
- **Committed in:** `0fe199c`

---

**Total deviations:** 2 auto-fixed (1 bug de teste, 1 bloqueio de ambiente de teste). **Impact:** nenhum no código de produção; só os testes ficaram determinísticos.

Escolhas dentro do que o plano deixou aberto (não são desvio): o `lid-com-alt` entrou como um item de `ignorados.json` (com `motivo: null`) para ficar nos sete arquivos de exemplo do plano; o RED da Task 1 levou um esqueleto de `provedor.ts` para o teste falhar na asserção.

## Issues Encountered

Nenhum além dos dois acima.

## Known Stubs

Nenhum. Os `throw new Error("não implementado")` do esqueleto do cliente existiram só entre o RED e o GREEN da Task 2 e saíram no commit `72080f5`.

## Threat Flags

Nenhuma superfície nova além da prevista no `<threat_model>` (T-16-43 a T-16-47 mitigadas: instância conferida; `ErroDaEvolution` sem chave nem corpo e `semApikey`; lista de permitidos; corte do fluxo de base64; host fixo `EVOLUTION_URL` e `url` da mídia nunca seguida). O teste "nenhum resultado carrega a apikey nem o segredo, nem quando o servidor os ecoa" e o do contrato cobrem T-16-44.

## User Setup Required

Nenhuma configuração externa nova para este plano. A variável de ambiente nova, **`EVOLUTION_URL`** (a base da Evolution, sem barra final), só liga o provedor quando existe; ela ainda não consta em `apps/api/.env.example` (ver "Documentação devida").

## Documentação devida

Arquivos fora dos `files_modified` deste plano, para o 16-14:

- `apps/api/src/mensageria/CONTEXT.md`: a linha `provedores/evolution/` do mapa agora existe (cliente, tradutor, provedor, exemplos); o parágrafo do registro ainda diz "nesta fase o registro só tem o de teste; o plano 16-11 acrescenta `whatsapp-nao-oficial`" e deve dizer que `registroPadrao()` liga a Evolution só com `EVOLUTION_URL` (16-12); a credencial do Canal é `{ instancia, apikey }` (token da instância) com `tipo = "whatsapp-nao-oficial"`; `fromMe` ignorado nesta fase.
- `apps/api/.env.example`: **`EVOLUTION_URL`** (base fixa da Evolution; a chave global não vai em variável do runtime, só o token da instância no cofre).
- `apps/api/src/e2e/CONTEXT.md`: o e2e novo `mensageria-evolution.test.ts` (Docker, porta 55727).

## Next Phase Readiness

- 16-13 grava no cofre a credencial `tipo = "whatsapp-nao-oficial"` como JSON `{ instancia, apikey }` com o TOKEN da instância e usa `criarClienteDaEvolution(...)` (`versao`, `buscarInstancia`, `estadoDaConexao`, `configurarWebhook`) para o comando de ligar o Canal; `buscarInstancia` devolve `ownerJid` e `token` (nulos se a Evolution não os trouxer).
- 16-16 (prova ao vivo): A1, A2, A3, A4 e A10 seguem como pressupostos. Se `number` só com dígitos ou o `message` do webhook em `getBase64FromMediaMessage` não funcionarem na instância real, o ajuste é em `provedor.ts` (`digitosDoDestino`) e `cliente.ts` (`baixarMidia`).
- Sessão 4 herda o adaptador: `fromMe` (mensagem digitada no celular), o evento `status` de entrega e `connection.update` ainda não são assinados nem traduzidos; o webhook só se inscreve em `MESSAGES_UPSERT`.
- Limites conhecidos: áudio com texto sai como duas mensagens; uma Mensagem leva um anexo só (a recusa `ANEXO_INVALIDO` é defesa em profundidade, o domínio já limita); `chaveDaChamada` é o `key.id` sem o tipo do evento, o que basta enquanto só `MESSAGES_UPSERT` é assinado.

## Self-Check: PASSED

- Arquivos: os 14 criados e `registro.ts` constam de `git diff --stat a8de2e4..HEAD` (15 arquivos).
- Commits na branch: `fdf16b8`, `49f96d2`, `0fe199c`, `72080f5`, `0219477`, `1c5dd6f` (6, medidos por `git rev-list --count`).
- Verificação: `apps/api` `npx tsc --noEmit` sem erro; `cliente.test.ts` 40, `traduzir.test.ts` e `provedor.test.ts` (com o `describe` "contrato do provedor: evolution") e a pasta da Evolution inteira 76; e2e da Evolution 5 de 5 contra o Postgres 16 de Docker na porta 55727 (container removido); `src/mensageria`, `src/e2e/mensageria*`, `src/rotas/webhooks-de-mensageria`, `servicos/cofre.test.ts` e `src/testes` juntos: 20 arquivos, 222 testes, nenhum pulado.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
