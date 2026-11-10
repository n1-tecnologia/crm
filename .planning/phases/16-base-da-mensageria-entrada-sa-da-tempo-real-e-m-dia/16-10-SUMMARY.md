---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 10
subsystem: api
tags: [mensageria, midia, anexos, storage, url-assinada, coleta-de-orfaos, advisory-lock, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "o processador da fila de entrada, `receberMensagem` e `baixarMidia` na interface do provedor (16-03)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`avisarCrm` no mesmo cliente da transação (16-07)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "a porta `ArmazenamentoDeAnexos`, o falso, a lista de tipos e as assinaturas de arquivo (16-09)"
provides:
  - "`mensageria/midia.ts`: `criarGuardaDeMidia().guardarAnexosRecebidos` baixa do provedor, confere tipo, teto e assinatura do conteúdo inteiro e sobe a `workspace/<ws>/entrada/<canalId>/<uuid>`; devolve `algumTransitorio`, `baixarMs` e `subirMs`"
  - "o processador guarda a mídia ANTES da transação, adia a linha com `resultado = midia_pendente` (até 3 passadas, `backoff()`) e fecha com `midia_indisponivel`; uma linha de etapas por chamada (`mensageria.etapas`: espera, baixar, subir, transação, total, anexos)"
  - "`receberMensagem(ws, canal, evento, { anexos })` e `completarAnexos` no repositório: a repetida completa o anexo `baixado: false` que agora baixou e avisa `mensagem.status`"
  - "o entregador manda cada anexo ao provedor por URL assinada nova (`EnvioAoProvedor.anexos`; documento com `download`)"
  - "`mensageria/coleta-de-orfaos.ts` (`criarColetaDeOrfaos`: `iniciar`, `parar`, `rodarUmaVez`) e `COLETA_DE_ORFAOS_ATIVA=true` no `index.ts`"
affects: [16-11, 16-12, 16-14, 16-16]

actuals:
  tokens: 22900
  tasks: 3
  commits: 6
plan_head_before: c92d03621e480b615bbdbea6e0376d35afb62d55
plan_head_after: b59e9847f66187d121f1f26b091addc04569140e

tech-stack:
  added: []
  patterns:
    - "a mídia é baixada e guardada ANTES da transação: a conexão do banco nunca espera o provedor"
    - "falha de mídia nunca derruba a Mensagem: o anexo grava `baixado: false` com nome e referência; só a falha que pode passar (rede, provedor, bucket) pede nova passada, e a passada completa a MESMA Mensagem"
    - "a coleta usa a porta do armazenamento e uma trava consultiva de sessão (`pg_try_advisory_lock` num cliente próprio do pool), devolvida no `finally`"
    - "log de etapas só com o id da linha e números"

key-files:
  created:
    - apps/api/src/mensageria/midia.ts
    - apps/api/src/mensageria/midia.test.ts
    - apps/api/src/mensageria/coleta-de-orfaos.ts
    - apps/api/src/mensageria/coleta-de-orfaos.test.ts
    - apps/api/src/e2e/mensageria-midia.test.ts
  modified:
    - apps/api/src/mensageria/processador-de-entrada.ts
    - apps/api/src/mensageria/processador-de-entrada.test.ts
    - apps/api/src/mensageria/entregar-mensagem.ts
    - apps/api/src/servicos/crm/recebimento.ts
    - apps/api/src/servicos/crm/recebimento.test.ts
    - apps/api/src/repositorios/crm/mensagens.ts
    - apps/api/src/index.ts

key-decisions:
  - "O anexo guardado NÃO leva `referenciaExterna`: o tipo do domínio diz que ela some quando o arquivo é guardado, e o 16-09 pediu `{ tipoDeMidia, nome, objectKey, tamanhoBytes, baixado: true }`. O `<action>` do plano a listava; segui o contrato do domínio."
  - "A assinatura é conferida no conteúdo INTEIRO baixado, não nos primeiros 4096 bytes como o plano escreveu: o zip e o Office (docx, xlsx, pptx) guardam o diretório central no fim do arquivo, e a conferência de 4 KiB recusaria todo documento do Office (teste com um .docx de 8 KiB)."
  - "Falha transitória = qualquer erro que não seja `ErroDeProvedor` (rede, tempo esgotado), `PROVEDOR_INDISPONIVEL` e a falha do bucket no upload. `MIDIA_INDISPONIVEL`, `MIDIA_GRANDE_DEMAIS`, `CREDENCIAL_AUSENTE`, tipo fora da lista, teto e assinatura são permanentes."
  - "A repetida só completa o anexo que estava `baixado: false` e só por índice; nunca troca um anexo já guardado (a passada nova subiu outro objeto, que a coleta apaga em 1 h) nem volta atrás."
  - "`esperaMs` é o tempo desde `disponivel_em` (não desde `recebido_em`): numa nova passada não soma o backoff. `totalMs` = espera + o trabalho da passada, até a gravação."
  - "A coleta de sessões é própria (porta + consulta que ignora sessão já limpa), e NÃO chama `coletarOrfaos` de `storage-uploads.ts` (ver desvios e `deferred-items.md`)."
  - "`listar` recebe o prefixo SEM barra final (`workspace/<ws>/entrada/<canalId>`): o `listarObjetos` real monta a chave como `<prefixo>/<nome>` e o falso confere `<prefixo>/`. O plano escreveu o prefixo com barra."

patterns-established:
  - "Quem precisa do bucket recebe `armazenamento?: ArmazenamentoDeAnexos` por injeção (processador, entregador, coleta, guarda de mídia); o padrão é o do Supabase e os testes passam o falso."

requirements-completed: [MSG-04]

coverage:
  - id: D1
    description: "Um áudio recebido pelo provedor de teste é baixado, conferido e guardado em `entrada/<canalId>/` (tipo normalizado, tamanho, `baixado: true`) e continua abrindo por `GET /mensagens/:id/anexos/0` depois de o provedor esquecer a mídia"
    requirement: MSG-04
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-midia.test.ts#3.9.4: um áudio recebido é baixado e guardado em `entrada/`, e continua abrindo depois de o provedor esquecer a mídia"
        status: pass
      - kind: unit
        ref: "apps/api/src/mensageria/midia.test.ts#guarda o áudio em entrada/ do Canal, com o tipo normalizado, o tamanho e baixado: true"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mídia acima do teto, de tipo fora da lista, com assinatura que não bate ou que o provedor esqueceu grava a Mensagem com o anexo `baixado: false`, o nome e a referência; nunca derruba a Mensagem e nunca some em silêncio"
    requirement: MSG-04
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/midia.test.ts (11 testes: teto de 17 MiB, texto como .ogg, audio/webm, tipo trocado, MIDIA_INDISPONIVEL, rede, PROVEDOR_INDISPONIVEL, bucket, Office de 8 KiB, dois anexos)"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/processador-de-entrada.test.ts#mídia que o provedor já esqueceu (MIDIA_INDISPONIVEL) não pede nova passada"
        status: pass
    human_judgment: false
  - id: D3
    description: "Falha transitória volta a linha a `pendente` (`midia_pendente`, até 3 passadas); a passada seguinte completa o anexo da MESMA Mensagem e avisa `mensagem.status`; esgotadas, `processado` com `midia_indisponivel`"
    requirement: MSG-04
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/processador-de-entrada.test.ts#falha transitória da mídia ... a passada seguinte completa a MESMA Mensagem e avisa mensagem.status"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/processador-de-entrada.test.ts#depois de 3 passadas sem a mídia: a linha fica processado com midia_indisponivel"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#opcoes.anexos: a entrada de mídia (16-10) (3 testes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O processador registra UMA linha de etapas por chamada (espera, baixar, subir, transação, total, anexos) só com o id da linha e números"
    requirement: MSG-04
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/processador-de-entrada.test.ts#registra UMA linha de etapas por chamada, com o id da linha e só números (nenhum dado pessoal)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Uma imagem anexada na Caixa chega ao provedor de teste com a URL assinada (`EnvioAoProvedor.anexos`); documento com `download`; anexo `baixado: false` numa Mensagem enviada falha com a frase do produto sem chamar o provedor; o bucket fora do ar na hora de assinar é transitório"
    requirement: MSG-04
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-midia.test.ts#3.9: uma imagem anexada na Caixa chega ao provedor de teste com a URL assinada, o tipo e o nome (e mais 3 testes de saída)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A coleta de órfãos apaga a sessão expirada e o objeto de `entrada/` com mais de 1 h que nenhuma Mensagem cita, preserva o citado e o recente, roda uma instância por vez (`pg_try_advisory_lock`) e loga só contagens; `COLETA_DE_ORFAOS_ATIVA=true` a liga no `index.ts`"
    requirement: MSG-04
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/coleta-de-orfaos.test.ts (5 testes: coleta, falha do bucket, duas em paralelo, log, agendamento)"
        status: pass
      - kind: other
        ref: "grep COLETA_DE_ORFAOS_ATIVA e coleta.parar em apps/api/src/index.ts; npx tsc --noEmit em apps/api"
        status: pass
    human_judgment: false
  - id: D7
    description: "Na prova ao vivo, o áudio mandado do celular aparece e toca na Caixa de outra aba em menos de 2 s, com as etapas medidas pela linha `mensageria.etapas`; o `created_at` da listagem do bucket e o `createSignedUrl(..., { download })` do Storage real continuam [ASSUMED]"
    requirement: MSG-04
    verification: []
    human_judgment: true
    rationale: "Medição ao vivo com Evolution, celular e Storage reais (Open Question 1, decisão do dono no 16-16); todos os testes deste plano usam o provedor de teste e o armazenamento falso."

duration: 20min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 10: Mídia recebida guardada, saída com URL assinada e coleta de órfãos Summary

**O anexo recebido é baixado do provedor, conferido (tipo, teto e assinatura do conteúdo inteiro) e guardado em `entrada/<canalId>/` antes da transação, com a falha de mídia nunca derrubando a Mensagem (anexo `baixado: false`, até 3 passadas que completam a mesma Mensagem), cada etapa medida em ms sem dado pessoal, a URL assinada indo ao provedor no envio e uma coleta diária de órfãos protegida por trava consultiva.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-11-09T19:36:00Z
- **Completed:** 2026-11-09T19:56:00Z
- **Tasks:** 3
- **Files modified:** 12 (5 novos, 7 alterados), 1310 linhas inseridas

## Accomplishments

- `guardarAnexosRecebidos`: tipo normalizado na lista da Mensagem, teto por tipo no `baixarMidia`, tipo devolvido pelo provedor conferido de novo, assinatura contra o conteúdo inteiro e upload em `workspace/<ws>/entrada/<canalId>/<uuid>`. Classifica a falha em transitória (rede, provedor, bucket) e permanente (teto, tipo, assinatura, `MIDIA_INDISPONIVEL`).
- O processador baixa antes da transação, grava a Mensagem mesmo quando a mídia falhou, volta a linha a `pendente` com `midia_pendente` na escada de `backoff()` e a passada seguinte COMPLETA a mesma Mensagem (`completarAnexos`, `mensagem.status` avisado); na terceira passada fecha `processado` com `midia_indisponivel`.
- Uma linha `mensageria.etapas` por chamada (`webhookId`, `esperaMs`, `baixarMs`, `subirMs`, `transacaoMs`, `totalMs`, `anexos`), a medição da prova ao vivo.
- O entregador assina uma URL nova de cada anexo (documento com `download`) e a põe em `EnvioAoProvedor.anexos`; anexo `baixado: false` numa Mensagem enviada falha com "O arquivo desta Mensagem não está disponível."; falha do bucket ao assinar volta à fila sem enviar.
- `criarColetaDeOrfaos`: sessões de upload expiradas (só as que ainda têm objeto a apagar) e objetos de `entrada/` com mais de 1 h que nenhuma Mensagem do Canal cita, sob `pg_try_advisory_lock`, log só com as três contagens; `COLETA_DE_ORFAOS_ATIVA=true` a liga.

## Task Commits

Plano `type: execute`, tarefas `tdd="true"`; a Task 1 é o traçador.

1. **Task 1 (traçador), RED** - `9c84189` (test): o e2e do áudio falha em `baixado: true` (recebe `false` com a referência).
2. **Task 1, GREEN** - `a58fc6b` (feat): `midia.ts`, o processador baixa antes da transação, `receberMensagem` aceita `opcoes.anexos`.
3. **Task 2, RED** - `c7a7a32` (test): 6 de 11 em `midia.test.ts`, 4 do processador e 1 do recebimento falham por asserção.
4. **Task 2, GREEN** - `791a255` (feat): classificação da falha, `midia_pendente`/`midia_indisponivel`, `completarAnexos`, etapas.
5. **Task 3, RED** - `27b7095` (test): 4 e2e de saída e 5 de coleta falham por asserção (a coleta nasce como esqueleto sem efeito).
6. **Task 3, GREEN** - `b59e984` (feat): URL assinada no entregador, coleta de órfãos e `COLETA_DE_ORFAOS_ATIVA`.

**Plan metadata:** commit `docs(16-10)` seguinte (STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `apps/api/src/mensageria/midia.ts` (+ teste) - baixar, conferir e guardar a mídia recebida
- `apps/api/src/mensageria/coleta-de-orfaos.ts` (+ teste) - a coleta diária de órfãos
- `apps/api/src/e2e/mensageria-midia.test.ts` - o áudio recebido que continua abrindo e a imagem enviada com URL assinada
- `apps/api/src/mensageria/processador-de-entrada.ts` (+ teste) - guarda a mídia antes da transação, `midia_pendente`, etapas
- `apps/api/src/mensageria/entregar-mensagem.ts` - URL assinada por anexo, `FRASES_DA_SAIDA.arquivoIndisponivel`, `armazenamento` injetável
- `apps/api/src/servicos/crm/recebimento.ts` (+ teste) - `opcoes.anexos`; a repetida completa o anexo
- `apps/api/src/repositorios/crm/mensagens.ts` - `completarAnexos` (só `recebida`)
- `apps/api/src/index.ts` - `COLETA_DE_ORFAOS_ATIVA`

## Decisions Made

Ver `key-decisions`. O que mais pesa para os próximos planos:

- **16-11 (Evolution):** `baixarMidia` deve ler em fluxo e abortar no `tetoBytes` (o guarda confia no teto, mas confere o tamanho de novo) e lançar `ErroDeProvedor("MIDIA_INDISPONIVEL")` para mídia que o provedor já não tem (permanente) ou `PROVEDOR_INDISPONIVEL`/qualquer erro de rede (transitório, pede nova passada). `convertToMp4` NÃO é pedido por padrão (orçamento de 2 s); o 16-11 reabre se o Safari não tocar o áudio.
- **16-12 (tela):** o anexo recebido pode vir `baixado: false` (com `referenciaExterna`, sem `objectKey`): a tela deve mostrá-lo como indisponível, nunca esconder. `GET /mensagens/:id/anexos/:indice` já responde 404 `ARQUIVO_INDISPONIVEL` nesse caso (16-09). Depois de `completarAnexos` a aba recebe `mensagem.status` e relê a Mensagem.
- **16-16 (prova ao vivo):** as etapas saem na linha de log `mensageria.etapas`; `totalMs` = espera na fila + o trabalho da passada, sem contar o tempo do webhook até a fila nem a entrega SSE à aba.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Assinatura conferida nos primeiros 4096 bytes recusaria todo Office e zip**
- **Found during:** Task 1 (planejando a conferência)
- **Issue:** o `<action>` manda `assinaturaConfereComTipo(bytes.subarray(0, 4096), tipo)`, mas o 16-09 fez a conferência do zip e do Office ler o diretório central no FIM do arquivo (EOCD nos últimos 64 KiB). Um .docx de 8 KiB seria recusado como `baixado: false`.
- **Fix:** o guarda passa o conteúdo inteiro já baixado (até 25 MiB em memória, que o teto já limita).
- **Files modified:** `apps/api/src/mensageria/midia.ts`
- **Verification:** `midia.test.ts` > "um documento do Office guardado é conferido pelo conteúdo INTEIRO" (docx com o diretório central depois de 8 KiB).
- **Committed in:** `a58fc6b`

**2. [Rule 1 - Bug] `listar` com o prefixo terminado em `/` listaria a pasta errada**
- **Found during:** Task 3
- **Issue:** o plano escreve `listar("workspace/<ws>/entrada/<canalId>/")`; o `listarObjetos` real monta a chave como `<prefixo>/<nome>` (ficaria `//`) e o falso confere `<prefixo>/`.
- **Fix:** o prefixo vai sem a barra final.
- **Files modified:** `apps/api/src/mensageria/coleta-de-orfaos.ts`
- **Verification:** `coleta-de-orfaos.test.ts` (o objeto de `entrada/` sai e o citado fica).
- **Committed in:** `b59e984`

**3. [Rule 3 - Blocking] `coletarOrfaos` não passa pela porta e não dá para provar a coleta de sessões com o falso**
- **Found during:** Task 3
- **Issue:** `coletarOrfaos` (`storage-uploads.ts`) chama o Supabase real direto (`armazenamento().remove`); o teste com o falso tocaria o Storage real. Além disso a consulta dela (`sessoesExpiradas`) nunca tira a sessão já limpa do lote: depois de `limite` sessões abandonadas ela anda no lugar.
- **Fix:** a coleta tem a sua própria varredura de sessões, pela porta (`remover`) e só com as sessões expiradas que ainda têm objeto `reservado`/`enviado`; sessão cuja remoção falhou não é marcada e a próxima rodada tenta. `coletarOrfaos` não foi alterada (fora dos `files_modified`).
- **Files modified:** `apps/api/src/mensageria/coleta-de-orfaos.ts`
- **Verification:** `coleta-de-orfaos.test.ts` (sessão expirada some; falha do bucket não marca).
- **Committed in:** `b59e984`

### Decisões do planejador que o plano deixou abertas

- `referenciaExterna` some do anexo guardado (contrato do domínio e do 16-09); fica só no `baixado: false`.
- Quem falha no bucket ao assinar a URL do envio: transitório (`tentar_de_novo`), e na última tentativa `falhou` com "O provedor não respondeu depois de várias tentativas."; o erro do bucket nunca sobe (pode citar a chave).

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3)
**Impact on plan:** nenhuma muda o contrato do `<interfaces>`; a 1 e a 2 corrigem o texto do plano contra o código do 16-09, a 3 troca uma chamada por uma consulta própria. Sem scope creep.

## TDD Gate Compliance

O plano é `type: execute` e `workflow.tdd_mode` é `false`: não usei `gsd_run check tdd-red-evidence`; a avaliação semântica foi manual (o alvo executou e falhou na asserção planejada, nunca por import ou sintaxe).

- **Task 1 (traçador):** RED `9c84189`: o e2e falhou com `baixado: false` no lugar de `true` e sem `objectKey`/`tamanhoBytes`. GREEN `a58fc6b`: passou, `tsc` limpo, 45 testes dos arquivos vizinhos (recebimento, processador, entrada) verdes. O traçador foi reverificado antes da expansão (só `<automated>`, `human_verify_mode` `end-of-phase`, sem `blocking-human`).
- **Task 2:** RED `c7a7a32`: 6 de 11 em `midia.test.ts` (o provedor lança `MIDIA_GRANDE_DEMAIS`, erro de rede e bucket fora do ar sem ninguém para classificar), 4 do processador (`pendente` sem `midia_pendente`, sem linha de etapas) e 1 do recebimento (a repetida não completa o anexo). Cinco de `midia.test.ts` e dois do recebimento nasceram verdes por construção (a Task 1 já cobria o caminho feliz, o tipo fora da lista e a assinatura). GREEN `791a255`: 61 testes passando.
- **Task 3:** RED `27b7095`: 4 de 5 do e2e (o provedor recebia `anexos` indefinido, o `baixado: false` saía mesmo assim) e 5 de 5 da coleta (esqueleto sem efeito, `rodou: false`). GREEN `b59e984`: 14 passando.
- **REFACTOR:** não houve.

## Issues Encountered

- O teste do bucket com `falharNaProxima` quebrava com sessões de outros testes no mesmo banco (a falha única era gasta pela primeira sessão da lista); passou a falhar só na remoção da chave do próprio teste.
- A coleta de duas em paralelo precisou de uma listagem lenta SÓ no Canal do teste (`dormir(150)` por Canal faria a suíte inteira, com centenas de Canais de outros testes, levar minutos).
- A suíte inteira roda com o log gravado dentro de `apps/api/`: apaguei o arquivo (`.vitest-1610.log`) antes de commitar; nada ficou no working tree.

## Verification Run

- Postgres 16 em Docker (`crm-n1-pg-1610`, porta 55725), `npm run --silent migrar` até `013-mensageria.sql`; contêiner removido no fim.
- `src/e2e/mensageria-midia.test.ts` 5, `src/mensageria/coleta-de-orfaos.test.ts` 5, `src/e2e/mensageria.test.ts` (comando `<automated>` da Task 3): 3 arquivos, 14 testes passando, nenhum pulado.
- `src/mensageria/midia.test.ts` 11, `processador-de-entrada.test.ts` 20, `servicos/crm/recebimento.test.ts` 30 (comando `<automated>` da Task 2): 61 passando.
- A SUÍTE INTEIRA de `apps/api` contra o Docker novo: 214 arquivos, 212 passando, 2 pulados (Storage real, anteriores), 2764 testes passando, 0 falhas, exit 0 (314 s).
- `npx tsc --noEmit` em `apps/api`: ok. `packages/dominio` e `apps/web` não foram tocados.
- Critérios de aceite: `/entrada/` em `midia.ts` 2; `guardarAnexosRecebidos` no processador 1; `fetch(` em `midia.ts` 0; `mensageria.etapas` no processador 1; `midia_pendente|midia_indisponivel` no processador 5; `completarAnexos` no repositório 3; `COLETA_DE_ORFAOS_ATIVA` em `index.ts` 3 e `coleta.parar` 1; `pg_advisory_unlock` na coleta 1; `urlAssinada` no entregador 2.
- Não rodei `npm run check` inteiro (13-17 min), conforme o plano.

## Known Stubs

None.

## Threat Flags

None. T-16-37 (teto passado ao `baixarMidia` e conferido de novo no tamanho recebido; 17 MiB de vídeo vira `baixado: false`, teste), T-16-38 (`midia.ts` sem `fetch(`; a mídia só vem de `provedor.baixarMidia`), T-16-39 (só `entrada/` com mais de 1 h e não citado por Mensagem; sessão só expirada; trava consultiva; testes), T-16-40 (a linha de etapas só leva o id da linha e números; teste proíbe telefone, nome, referência e chave) e T-16-SC (nenhum pacote novo) estão cobertos.

## User Setup Required

None - a variável `COLETA_DE_ORFAOS_ATIVA` é opcional e vem desligada. Só deve ser ligada em produção com o Storage configurado (`SUPABASE_*`) e depois de o dono conferir na prova ao vivo (16-16) que a listagem do bucket traz `created_at` (A12).

## Next Phase Readiness

- 16-11 e 16-12: veja "Decisions Made".
- Documentação devida (arquivos fora dos `files_modified`, para o 16-14): `apps/api/src/mensageria/CONTEXT.md` (o mapa ganha `midia.ts` e `coleta-de-orfaos.ts`; a regra "`baixarMidia` só fala com o host do provedor" já vale; a linha de log `mensageria.etapas`, o `resultado` `midia_pendente`/`midia_indisponivel` e a chave `entrada/<canalId>/<uuid>`); `apps/api/src/servicos/CONTEXT.md` (nada novo em `storage-uploads.ts`); `apps/api/src/persistencia/CONTEXT.md` (anexo recebido guardado com `objectKey` de `entrada/`, `completarAnexos` só na `recebida`); `apps/api/.env.example` (**`COLETA_DE_ORFAOS_ATIVA`**, padrão `false`); `apps/api/src/e2e/CONTEXT.md` (o e2e novo, Docker na porta 55725). Variável de ambiente nova: `COLETA_DE_ORFAOS_ATIVA`.
- Itens abertos em `deferred-items.md`: a coleta de `entrada/` só enxerga 500 objetos por Canal (a porta não tem `deslocamento`); a primeira coleta só roda 24 h depois do boot.

## Self-Check: PASSED

- Os 5 arquivos novos existem (`midia.ts`, `midia.test.ts`, `coleta-de-orfaos.ts`, `coleta-de-orfaos.test.ts`, `e2e/mensageria-midia.test.ts`) e os 7 alterados constam de `git diff --stat`.
- Commits na branch: `9c84189`, `a58fc6b`, `c7a7a32`, `791a255`, `27b7095`, `b59e984`.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
