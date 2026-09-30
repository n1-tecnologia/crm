---
phase: 06-conferencia-do-resumo-e-anexos
repo: financeiro-tria (automation/)
diff_base: 0ad567e
head: 6767be1
reviewed: 2026-09-30T17:50:46Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - automation/src/http/webhooks-plataforma.ts
  - automation/src/http/receipts-da-plataforma.ts
  - automation/src/http/worker-da-plataforma.ts
  - automation/src/http/routes.ts
  - automation/src/tenants/tria/payment-automation-service.ts
  - automation/src/tenants/tria/contas-a-pagar-lancamento.ts
  - automation/src/tenants/tria/contas-a-pagar-anexos.ts
  - automation/src/tenants/tria/contas-a-pagar-resolucao.ts
  - automation/src/adapters/omie.ts
  - automation/contratos/contas-a-pagar-v1/lancar.sucesso-anexos-nomeados.json
  - automation/contratos/contas-a-pagar-v1/README.md
  - docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md
  - automation/src/tenants/tria/payment-automation-service.plataforma.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Fase 6 (financeiro-tria/automation), rodada de fechamento 06-16..06-17: relatório de revisão de código

**Revisado em:** 2026-09-30T17:50:46Z
**Profundidade:** standard, com rastreio ponta a ponta de `montarHandlerDeAprovacao`, `reprocessarAprovacoesPresas`, `processarAprovacaoReivindicada`, `encerrarAprovacoesEsgotadas`, `decisaoQueSupera`/`decisaoSuperada`, `gravarPayloadDoReceipt`/`fecharReceipt` (CAS por `attempts`), `publicarResumoDaDecisao`/`executarResumoDaPlataforma`/`antesDePublicar`, `subirAnexos`/`hostDoAnexoPermitido`, e `lancarContaAPagar`/`lancarUmaVez` (fila em processo por conta).
**Arquivos revisados:** 13 arquivos de produção tocados pelos commits `c03eb07`, `522752c`, `c535dee` (06-16) e `b3b4278`, `30a28fb`, `6767be1` (06-17); testes lidos por amostragem dirigida (as sequências X1/X1b/X2 ponta a ponta com o serviço real, RC1-RC3, M1-M22 conferidas por leitura do código-fonte contra a descrição do SUMMARY). `npm test` isolado: 769/769 em ~18s.
**Status:** issues_found (1 warning, 2 info — nenhum bloqueante)

## Resumo

Esta rodada fechou o `fin2:CR-01` (a varredura reexecutando uma decisão velha) com uma combinação de três camadas independentes: (1) a marca `decisaoGravada` no receipt, que faz a varredura nunca regravar uma decisão já aplicada; (2) `decisaoQueSupera`/`decisaoSuperada`, que ordena as decisões da mesma Tarefa por `occurredAt` (com `event_id` de desempate) e impede tanto o handler quanto a varredura de aplicar ou publicar algo mais velho que a última decisão gravada; (3) a releitura do Status da Solicitação pela porta — duas vezes, uma antes de gastar Omie/RAG/IA e outra imediatamente antes do `createComment` do RESUMO — como rede de segurança independente das duas primeiras. Tracei as duas sequências concretas do `06-REVIEW-FINANCEIRO-TRIA-2.md` (aprovada→S5 transitório→reprovada→varredura; e a variante com uma segunda aprovação) contra o código novo, e ambas terminam como o corretas: nenhum RESUMO numa Solicitação reprovada, `Aprovado` não regravado, no máximo um RESUMO (o do último ciclo). Os testes `X1`/`X1b`/`X2` em `payment-automation-service.plataforma.test.ts` provam exatamente essas duas sequências ponta a ponta, pelo webhook HTTP real, com o serviço real — não é só uma alegação do SUMMARY.

`fin2:WR-01` (orçamento dos anexos) também fechou de verdade: o orçamento de anexos agora deriva de `PRAZO_DO_LANCAR_MS` (50 s) menos o que a resolução/consulta/inclusão já gastaram, e `subirAnexos` falha rápido (sem tocar a rede) quando esse saldo já é ≤ 0. Mais importante: `lancarContaAPagar` ganhou uma fila em processo por `codigoLancamentoIntegracao` — uma repetição da MESMA conta (a ponte reenviando depois do timeout de 60 s dela) encontra a promessa original ainda em voo e espera o MESMO resultado, em vez de reexecutar `IncluirContaPagar`/`subirAnexos` em paralelo. Isso fecha a duplicação de anexo independentemente de qual etapa do Omie estava lenta — não só a etapa de anexos.

`fin2:WR-02` (allowlist de host liberando a API inteira do Supabase) fechou: a política agora exige host E `pathname` (normalizado pelo WHATWG `URL`, o que resolve `..`/`%2e%2e` antes da comparação) começando por `/storage/v1/object/`. Testei manualmente as variações pedidas (URL-encoding, barra dupla, maiúsculas, travessia de diretório) contra a lógica e todas são recusadas pelo mesmo mecanismo — a travessia por `..` dentro do prefixo apenas rearranja segmentos dentro de `/storage/v1/object/…`, nunca escapa para `/rest/v1` ou `/auth/v1`.

A troca deliberada da URL do exemplo canônico `lancar.sucesso-anexos-nomeados` (de `https://exemplo.invalid/anexos/comprovante.pdf` para `https://exemplo.invalid/storage/v1/object/public/anexos/comprovante.pdf`) está consistente nos dois repositórios (`diff -r` entre as duas pastas `contratos/contas-a-pagar-v1/` sai vazio) e documentada no README do contrato e no §7 do doc 05. Não sobrou nenhuma referência à forma antiga em documentação — as únicas ocorrências de URLs fora do padrão Storage que restam são deliberadamente negativas (o fixture `lancar.sucesso-anexos-com-falhas.json`, que EXISTE para demonstrar `ANEXO_HOST_NAO_PERMITIDO`) ou estão em arquivos de teste que não são material de integração.

O resíduo do log cru (`fin2:WR-03`/`WR-04`) está fechado para a coorte plataforma: `step()` e `listOmieCategoriasComRetry` (`ListarCategorias`) bifurcam em `origemAtual() === "plataforma"` e usam `detalheSanitizadoDaFalha`; a fonte ClickUp mantém `error.message` cru, mas isso é escopo aceito e registrado (nenhum teste do legado cobre, conforme a mutação M16 do 06-16).

O único ponto que not fechou por completo é um resíduo estreito do próprio mecanismo novo: `gravarPayloadDoReceipt` (que grava a marca `decisaoGravada: true`) pode falhar (best-effort, nunca lança) e as duas chamadas em `webhooks-plataforma.ts` descartam o retorno sem checar. Ver WR-01 abaixo.

## Situação dos achados do `06-REVIEW-FINANCEIRO-TRIA-2.md` (fin2)

| Id | Situação | Evidência |
|---|---|---|
| fin2:CR-01 (varredura reexecuta decisão velha) | **fechado** | `decisaoGravada` no payload do receipt (`webhooks-plataforma.ts:955`, `:1221`), consultado pela varredura antes de reaplicar a decisão (`:1204-1208`); `decisaoQueSupera`/`decisaoSuperada` por `occurredAt` (`:803-831`), consultados no handler (`:951`), na varredura (`:1213`) e dentro do S5 (`:1041`, via `vigencia`); releitura do Status antes de gastar Omie (`payment-automation-service.ts:1614`) e de novo imediatamente antes do `createComment` (`antesDePublicar`, `:1596-1601`, chamado em `postPaymentSummary:2364-2379`). As duas sequências do fin2:CR-01 (A transitório→R→varredura; A→R→A2→varredura) são provadas ponta a ponta pelo webhook real em `X1`/`X1b`/`X2` (`payment-automation-service.plataforma.test.ts:2229-2255`). Resíduo estreito: ver WR-01 (Warnings) abaixo. |
| fin2:WR-01 (orçamento dos anexos não conta desde o início; duplica anexo) | **fechado** | `PRAZO_DO_LANCAR_MS = 50_000` (`contas-a-pagar-lancamento.ts:154`), `orcamentoDosAnexos()` medido desde `entradaEm` (`:327`) e passado a `subirAnexos` nas duas chamadas (reaproveitado `:432` e inclusão nova `:541`); `subirAnexos`/`correrContraOrcamento` falha rápido sem tocar rede quando `ms <= 0` (`contas-a-pagar-anexos.ts:260`). Mais importante que o cálculo do orçamento: `lancarContaAPagar` (`:280-315`) serializa por `codigoLancamentoIntegracao` num `Map` em processo — uma repetição da ponte encontra a promessa original em voo e devolve o MESMO resultado, em vez de reexecutar `IncluirContaPagar`/`subirAnexos`. Isso fecha a duplicação mesmo quando a lentidão está em etapas ANTERIORES aos anexos (resolução, consulta, inclusão) — que continuam sem prazo próprio, mas como a fila em processo nunca deixa uma segunda execução começar, a lentidão dessas etapas só atrasa a resposta, nunca duplica. Limite disclosed e aceito: duas instâncias do `automation/` não se coordenam por este `Map` (comentário `:277-279`, SUMMARY "Deferred"). |
| fin2:WR-02 (allowlist de host libera a API inteira do Supabase) | **fechado** | `PREFIXOS_DO_STORAGE = ["/storage/v1/object/"]` (`contas-a-pagar-anexos.ts:65`), exigido em `PoliticaDeAnexos.prefixosDoCaminho` (obrigatório no tipo, `:88`) e conferido em `hostDoAnexoPermitido` depois do host (`:123-135`) sobre o `pathname` já normalizado pelo WHATWG `URL` (resolve `..`/`%2e%2e`/backslash antes da comparação — os mesmos testes M1/M2 do 06-17 cobrem `../`, `%2e%2e`, barra dupla, maiúsculas e `objectX`). Tracei manualmente a travessia por `..` dentro do prefixo permitido (ex.: `/storage/v1/object/sign/a/../../b/x`): ela rearranja segmentos MAS nunca produz um `pathname` fora de `/storage/v1/object/…` — não há bypass para `/rest/v1`, `/auth/v1`, `/functions/v1` ou `/graphql/v1`. Fixar o bucket continua fora de escopo (deferred, documentado). |
| fin2:WR-03/WR-04 residual (log cru do S5, premissa do 06-10) | **fechado na coorte plataforma** | `step()` (`payment-automation-service.ts:3027-3028`) e `listOmieCategoriasComRetry` (`:2208-2212`) bifurcam em `origemAtual() === "plataforma"` para `detalheSanitizadoDaFalha`; confirmado por leitura direta do código (a mutação M14/M15 do 06-16 e os testes F8/F9/F10 cobrem). A fonte ClickUp mantém `error.message` cru — aceito e registrado no SUMMARY como fora de escopo (M16: nenhum teste do legado cobre). |
| fin2:WR-05 (varredura roda S5 em série e trava a fila) | **fechado** | `worker-da-plataforma.ts:103-193`: duas trilhas independentes no timer (`emAndamentoDaFila`/`emAndamentoDasAprovacoes`), cada uma com o próprio guarda de concorrência — um S5 lento na trilha de aprovações nunca atrasa a trilha da fila/comentários no mesmo ciclo. `reprocessarAprovacoesPresas` limita a `LIMITE_PADRAO_DA_VARREDURA_DE_APROVACOES = 2` retomadas por passada (`webhooks-plataforma.ts:788`, `:1140`). |
| fin2:WR-06 (receipt de aprovação preso para sempre) | **fechado** | `encerrarAprovacoesEsgotadas` (`webhooks-plataforma.ts:1266-1300`): candidatos com `attempts >= maxTentativas`, reivindicados pela mesma CAS; a tentativa `maxTentativas + 1` é a passada final, terminal (roda a decisão que falta e/ou o S5 com `ultimaTentativa: true`, publicando o RESUMO ou o aviso fixo `summary:<eventId>:falha`) e fecha `concluido`/`falhou`, nunca mais `falhou_retentavel`; todo abandono vai a `console.error`. Resíduo aceitável e documentado no próprio código (`:1263-1264`): se o PROCESSO morrer durante a própria passada final, a passada seguinte (tentativa `> maxTentativas+1`) desiste sem tentar de novo — um corner case de dupla falha (esgotar as tentativas normais E o processo cair exatamente na passada final), não um regressão nova. |
| fin2:IN-01 (`jaExistia` decidido antes da política de host) | **fechado** | `subirAnexos` confere `permitidos[indice]` (política) antes de `jaEstaNoTitulo` (`contas-a-pagar-anexos.ts:338-345`); o `ListarAnexo` só roda quando o título já existia E algum anexo passa na política (`:322`). |
| fin2:IN-02 (`ANEXO_OMIE_RECUSOU` também para o Omie fora do ar) | **fechado** | `codigoDoErroDoAnexo`/`codigoDaFalhaDaLeitura` mapeiam `ErroDoOmie` de `natureza: "infraestrutura"` para `ANEXO_TEMPO_ESGOTADO`, só a recusa de negócio vira `ANEXO_OMIE_RECUSOU` (`contas-a-pagar-anexos.ts:238-247`). |
| fin2:IN-03 (mudanças de comportamento no legado além de prazo/teto) | **sem mudança nesta rodada** | Fora do escopo de 06-16/06-17; nenhuma reversão nem agravamento encontrado. |
| fin2:IN-04 (`conferidoNoOmie` sem as flags) | **fechado** | `conferidoNoOmie` no S5 usa `reprovacaoDaCategoriaNoPlano` (receita/totalizadora/inativa) via `reprovadas.has(categoryCode)` (`payment-automation-service.ts:2175`); a mutação N1 do 06-16 cobre. |
| fin2:IN-05 (`deParaDoTitulo` marca `resolvida` mesmo fora do plano/regra do CR-02) | **fechado** | `deParaDoTitulo` (`contas-a-pagar-resolucao.ts:629-679`) agora lê o plano quando a categoria do título diverge da resolução, aplica `reprovacaoDaCategoriaNoPlano` e devolve `revisar` com `motivoDaReprovacaoNoPlano` (incluindo o caso "indisponivel" para plano vazio, adicionado como correção de plano). Só marca `resolvida` quando a linha existe no plano e passa nas três flags. |
| fin2:IN-06 (conta pelo rótulo, não pelo id) | **registrado como limite conhecido** | Sem mudança de comportamento; documentado no contrato v1.2 e no doc 05 conforme o SUMMARY. |
| fin2:IN-07 (`cCodIntAnexo` igual ao `recordId` para todos os anexos) | **deferred (aceito)** | Fica para 06-20 com autorização do dono (item 11 do roteiro), conforme o SUMMARY. Nenhuma mudança nesta rodada. |
| fin2:IN-08 (redação não diferencia maiúsculas/acentos) | **fechado** | `redigirValores`/`dobrarComMapa` (`omie.ts:164-224`): normaliza NFD, remove marcas combinantes, busca literal (`indexOf`, nunca `RegExp` construída com o valor) sobre o texto "dobrado", troca o trecho do texto ORIGINAL (do fim para o começo, para não deslocar índices). O mapa de índices usa `caractere.length` (código UTF-16) consistente com `String.slice`, corretamente tratando pares substitutos Unicode. Testado em `omie-redacao.test.ts` (6 casos) e em `F10` ponta a ponta (CNPJ/razão social em maiúsculas do Omie não vazam). |
| fin2:IN-09 (`rota.listen` do script sem tratar `error`) | **fechado** | `scripts/teste-omie-real.ts:112` usa `escutarNoLoopback(rota)`; `rota.listen(` não aparece mais no arquivo. |
| fin2:IN-10 (`retryRun("summary")` publica RESUMO duplicado com a varredura pendente) | **fechado** | `repetirResumoDaPlataforma` (`payment-automation-service.ts:1778-1791`) consulta `this.receiptsDaAprovacao.naoTerminaisDaTarefa(taskId)` e recusa a repetição enquanto houver receipt de aprovação não terminal da Tarefa; falha ao consultar os receipts é transitória (`RECEIPTS_INDISPONIVEIS`), nunca decide às cegas. `receiptsDaAprovacao` corretamente amarrado em `routes.ts:98-101`. |

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `gravarPayloadDoReceipt` falha em silêncio — a marca `decisaoGravada` pode nunca ser gravada mesmo depois de a decisão já ter sido aplicada, reabrindo uma variante estreita do fin2:CR-01

**Arquivos:** `automation/src/http/webhooks-plataforma.ts:954-955` e `:1220-1221`; `automation/src/http/receipts-da-plataforma.ts:277-294` (`gravarPayloadDoReceipt`)

**Problema:** `gravarPayloadDoReceipt` é deliberadamente best-effort — "nunca lança" — e devolve `false` em caso de erro do cliente ou exceção, só registrando um `console.warn` curto. As DUAS chamadas que gravam a marca `decisaoGravada: true` (uma no handler síncrono, `montarHandlerDeAprovacao:955`, outra na varredura, `processarAprovacaoReivindicada:1221`) descartam esse retorno:

```ts
resultado = await decidir(evento.taskId, evento.decision, evento.decidedByMemberId, { eventId: evento.eventId });
// A decisão está gravada: a varredura nunca mais a roda para este evento, só o S5.
await gravarPayloadDoReceipt(deps.supabase, evento.eventId, { ...payloadDaAprovacao(evento), decisaoGravada: true });
```

Se esta escrita falhar (rede, um `update` que colide, uma falha transitória do Supabase) DEPOIS de `decidir()` já ter alterado `Aprovado`/Status/S6 com sucesso, o receipt fecha sem a marca. Se o S5 subsequente (`publicarResumoDaDecisaoReivindicado`) também falhar de forma transitória, o receipt volta para `falhou_retentavel` SEM a marca — e a varredura, ao encontrar `payload.decisaoGravada !== true`, entra no ramo "decisão ainda não gravada" (`webhooks-plataforma.ts:1210-1221`) e **roda `decidir()` de novo**.

A proteção de `decisaoQueSupera` na varredura só funciona se a decisão MAIS NOVA da mesma Tarefa tiver a SUA PRÓPRIA marca gravada com sucesso. Numa falha correlacionada (ex.: uma janela de instabilidade do Supabase que afeta as duas chamadas de `gravarPayloadDoReceipt` para os dois eventos da mesma Tarefa, que tendem a chegar próximos no tempo numa revisão de aprovação) — evento A (aprovada) tem a marca perdida, evento R (rejeitada, mais novo) TAMBÉM tem a marca perdida — a varredura que retoma A não encontra nenhum receipt com `decisaoGravada === true` mais novo, e reaplica `decidir()` para A: **`Aprovado` volta a `true` na linha**, sobrescrevendo a reprovação de R.

O RESUMO em si continua protegido nesse cenário específico: `antesDePublicar` relê o Status pela porta (`lerTarefa(taskId).status`) imediatamente antes do `createComment`, e como `decidir()` de R já tinha escrito `updateTaskStatus(taskId, "não aprovado", ...)` com sucesso (só a MARCA do receipt de R falhou, não a escrita de Status em si), o S5 de A encontra `status !== "aprovado"` e aborta sem publicar. Mas a linha `Aprovado` fica `true` — divergente da plataforma — até a próxima decisão, exatamente o sintoma central do `fin2:CR-01` original ("a linha fica divergente da plataforma"), só que restrito ao campo, sem o RESUMO indevido.

Nenhum teste cobre esta combinação: `receipts-da-plataforma.test.ts` prova que `gravarPayloadDoReceipt` devolve `false` sem lançar (`RC2`), mas nenhum teste em `webhooks-plataforma.test.ts` ou `payment-automation-service.plataforma.test.ts` simula essa falha ENQUANTO o resto do fluxo (decisão, S5) segue.

**Correção:**
- Checar o retorno de `gravarPayloadDoReceipt` nos dois pontos de chamada; se `false`, tratar como falha transitória do próprio passo (lançar algo equivalente a `ErroTransitorioDaPlataforma` com um código novo, ex. `DECISAO_GRAVADA_FALHOU`) para que o receipt feche `falhou_retentavel` e a PRÓXIMA tentativa da varredura tente gravar a marca de novo antes de prosseguir — em vez de silenciosamente seguir sem a marca.
- Alternativa mais barata: na varredura, antes de reaplicar `decidir()` no ramo "sem marca", tentar gravar a marca de novo já com o resultado da decisão anterior assumido como aplicado (a escrita de `Aprovado`/Status é idempotente pelo `eventId` para Status/S6, mas não para `Aprovado`) — ou simplesmente re-tentar `gravarPayloadDoReceipt` com um pequeno backoff antes de decidir que a decisão precisa ser reaplicada.
- Teste: `decidir()` sucesso + `gravarPayloadDoReceipt` retornando `false` (cliente injetado) + S5 falha transitória + uma decisão mais nova da MESMA Tarefa cuja própria marca TAMBÉM falha ⇒ a varredura não deve regravar `Aprovado` do evento mais velho.

## Info

### IN-01: `decisaoQueSupera` devolve o primeiro `event_id` mais novo encontrado na varredura em memória, não necessariamente o mais novo de todos

**Arquivo:** `automation/src/http/webhooks-plataforma.ts:803-823`

**Problema:** o `for` sobre `linhas` retorna assim que encontra QUALQUER receipt com `occurredAt` maior que o alvo — não continua procurando o máximo. Isso não afeta a correção (qualquer decisão mais nova já prova que o alvo está superado), só a mensagem de log (`console.info`) pode citar um `event_id` que não é o da decisão mais recente quando há três ou mais decisões da mesma Tarefa.

**Correção:** opcional — continuar o loop e guardar o candidato de maior `instante` para a mensagem de log ser mais precisa. Sem impacto funcional.

### IN-02: `encerrarAprovacoesEsgotadas` desiste sem tentar a passada final se o processo morrer exatamente durante ela

**Arquivo:** `automation/src/http/webhooks-plataforma.ts:1266-1300`, especialmente `:1286`

**Problema:** a tentativa `maxTentativas + 1` é a passada final, terminal. Se o processo morrer NO MEIO dela (depois de reivindicar via CAS, antes de fechar o receipt), a linha fica com `attempts = maxTentativas + 1` e status `recebido`. Na próxima varredura, `reivindicarReceiptExistente` incrementa para `maxTentativas + 2`, e como isso é `> maxTentativas + 1`, o código trata como "a passada final já aconteceu" e fecha `falhou TENTATIVAS_ESGOTADAS` **sem nunca ter de fato rodado a decisão/S5 finais** — a Solicitação fica sem RESUMO e sem o aviso fixo, só com o log de abandono.

Este é um corner case de dupla falha (esgotar as `maxTentativas` normais E o processo morrer bem na passada final) e o próprio código documenta a escolha deliberada (comentário `:1263-1264`: "a passada final já aconteceu e o processo morreu no meio ... fecha `falhou`"). Não é uma regressão desta rodada, e o `console.error` de abandono continua saindo — mas vale registrar que, neste corner case específico, a Solicitação fica sem qualquer aviso NA PLATAFORMA (só no log do processo), diferente do caso comum em que a passada final consegue publicar o aviso fixo.

**Correção:** opcional — permitir mais de uma tentativa na "zona terminal" (ex.: `maxTentativas + 1` e `maxTentativas + 2` ambas terminais) antes de desistir sem tentar.

---

_Revisado em: 2026-09-30T17:50:46Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
