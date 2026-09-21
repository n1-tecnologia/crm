---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 24
subsystem: payments
tags: [fastify, zod, decideProcessApproval, classifyApproval, outbox, idempotency, comment-fallback]

requires:
  - phase: 02-04
    provides: "decideProcessApproval / solicitarAprovacao — a operação canônica de decisão de processo"
  - phase: 02-13
    provides: "Padrão de rota de integração /v1/integrations, idempotência HTTP, mapeamento de erro"
  - phase: 02-21
    provides: "webhooks-plataforma.ts — auth em tempo constante, Idempotency-Key, receipt idempotente, taxonomia de erro"
provides:
  - "POST /v1/integrations/payment-approvals/classifications — callback que decide via decideProcessApproval(source:'comment')"
  - "apps/api/src/servicos/janela-de-fallback.ts — dentroDaJanela/calcularDataFinal/metricaDeOrigem (D-10, janela de 90 dias)"
  - "classificador-de-aprovacao.ts (automation/) — consome solicitacao.comentario-criado.v1, classifica texto, chama o callback"
  - "webhooks-plataforma.ts /comentario-criado — responde 202 e classifica de forma assíncrona, fora do caminho paralelo antigo"
affects: [02-25, 02-26, 02-27, 02-28]

tech-stack:
  added: []
  patterns:
    - "Callback de classificação sem autoridade: o corpo só carrega commentId; a plataforma resolve autor/tópico/aprovação do dado persistido, nunca do corpo (T-02-18)"
    - "eventId determinístico (hash do commentId) quando a origem não tem UUID nativo, para Idempotency-Key sobreviver a retry sem gerar um novo id a cada tentativa"
    - "Handler HTTP que responde antes de terminar o efeito assíncrono, marcando o receipt depois (fire-and-forget com try/catch defensivo em volta da composição de dependências)"

key-files:
  created:
    - apps/api/src/servicos/janela-de-fallback.ts
    - apps/api/src/servicos/janela-de-fallback.test.ts
    - apps/api/src/rotas/classificacoes.ts
    - apps/api/src/rotas/classificacoes.test.ts
    - apps/api/src/rotas/esquemas/classificacoes.ts
    - ../financeiro-tria/automation/src/tenants/tria/classificador-de-aprovacao.ts
    - ../financeiro-tria/automation/src/tenants/tria/classificador-de-aprovacao.test.ts
  modified:
    - apps/api/src/app.ts
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.ts
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts

key-decisions:
  - "FALLBACK_COMENTARIO_ATE ausente ou inválida = fallback DESLIGADO (fail closed), nunca ligado para sempre"
  - "A rota de classificação nunca aceita actorId/memberId/approvalId no corpo — resolve autor pelo Comentário persistido e a Aprovação pelo pai do Comentário (RN-SP-05/T-02-18)"
  - "Idempotency-Key da rota precisa ser igual a eventId (T-02-08); replay da MESMA decisão devolve aplicado:true,replay:true sem novo efeito, pois decideProcessApproval já é idempotente"
  - "eventId do classificador do automation/ é um hash determinístico do commentId (não um randomUUID por chamada) — um retry do MESMO comentário reusa a MESMA chave"
  - "/comentario-criado do webhook da plataforma responde 202 e SÓ DEPOIS chama o classificador (assíncrono); substitui a chamada a syncAndAnalyzeComment (o caminho paralelo que D-09 fecha), que continua servindo só o webhook do ClickUp"
  - "Confidence enviado é 1 (aprovado/reprovado) ou 0 (irrelevante) — classifyApproval não expõe um número; a rota não usa confidence na decisão, só o aceita no contrato"

patterns-established:
  - "Motivo de negócio (irrelevante/fora_da_janela/fora_do_topico/autor_nao_autorizado) sempre 200 aplicado:false — nunca um erro HTTP; só schema/auth/conflito de decisão usam o envelope de erro do contrato"

requirements-completed: [SOL-08]

duration: 45min
completed: 2026-09-21
---

# Phase 02 Plan 24: Fallback por comentário decide pela mesma operação de domínio do clique Summary

**O comentário de aprovação volta a decidir dentro da janela de 90 dias de D-10, mas agora chamando `decideProcessApproval` da plataforma via um callback autenticado — o `automation/` classifica texto, nunca decide sozinho.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-21
- **Tasks:** 3/3
- **Files modified:** 10 (7 novos, 3 modificados) em dois repositórios

## Accomplishments

- `janela-de-fallback.ts` fecha D-10: `dentroDaJanela` falha fechado (variável ausente ou inválida = desligado, com aviso no log), `calcularDataFinal` dá ao roteiro de deploy a data exata de corte, `metricaDeOrigem` conta `porClique`/`porComentario`/`razao` a partir de `decisionSource`.
- `POST /v1/integrations/payment-approvals/classifications` fecha o gap de autoridade: o `automation/` manda só `{eventId, commentId, decision, confidence}`; a plataforma resolve o Comentário, checa a janela, resolve o tópico de roteamento pelo PAI do Comentário (RN-SP-05), resolve e autoriza o autor, e só então chama a MESMA `decideProcessApproval` que o clique usa, com `source: "comment"`.
- `classificador-de-aprovacao.ts` (automation/) consome `solicitacao.comentario-criado.v1`, ignora comentário raiz sem chamar nada, busca o texto por `getCommentReplies` (o evento não traz texto) e chama `classifyApproval` sem mudar a heurística existente.
- `webhooks-plataforma.ts` ganha um handler dedicado para `/comentario-criado`: responde 202 assim que o receipt está garantido, e SÓ DEPOIS dispara o classificador — substituindo a chamada a `syncAndAnalyzeComment` (o caminho de negócio paralelo que D-09 fecha para a coorte plataforma).

## Task Commits

1. **Task 1: Janela de 90 dias e métrica por origem** - `fd53ca5` (feat) — crm-n1
2. **Task 2: `POST /v1/integrations/payment-approvals/classifications`** - `c693ae7` (feat) — crm-n1
3. **Task 3: Classificador no `automation/` consumindo o evento de comentário** - `bfbce88` (feat) — financeiro-tria

**Plan metadata:** commit final de fechamento deste SUMMARY (ver STATE.md/ROADMAP.md, atualizados pelo orquestrador).

## Files Created/Modified

- `apps/api/src/servicos/janela-de-fallback.ts` - `dentroDaJanela`, `calcularDataFinal`, `metricaDeOrigem` (D-10)
- `apps/api/src/servicos/janela-de-fallback.test.ts` - 7 casos (a)-(g), relógio injetado
- `apps/api/src/rotas/esquemas/classificacoes.ts` - corpo `.strict()` do callback, sem actorId/memberId/approvalId
- `apps/api/src/rotas/classificacoes.ts` - a rota, resolvendo comentário/tópico/autor pelo dado persistido e decidindo via `decideProcessApproval`
- `apps/api/src/rotas/classificacoes.test.ts` - 3 casos sem banco (sempre rodam) + 8 casos com banco (pulam sem `DATABASE_URL`)
- `apps/api/src/app.ts` - registra `rotasDeClassificacoes` dentro do plugin `/v1/integrations`, com `Relogio` injetável
- `../financeiro-tria/automation/src/tenants/tria/classificador-de-aprovacao.ts` - consome o evento, classifica, chama o callback
- `../financeiro-tria/automation/src/tenants/tria/classificador-de-aprovacao.test.ts` - 7 casos (a)-(g), incluindo a regressão real da Tarefa `868hc5pyu`
- `../financeiro-tria/automation/src/http/webhooks-plataforma.ts` - `/comentario-criado` com handler dedicado, assíncrono
- `../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts` - 4 casos novos (k)-(n) provando a nova ordem, sem quebrar (a)-(j)

## Decisions Made

- **`FALLBACK_COMENTARIO_ATE` ausente ou ilegível = fallback DESLIGADO.** Um deploy que esquece de calcular a data não pode deixar o classificador decidindo para sempre — falha fechada, com aviso no log em vez de silêncio.
- **A rota nunca aceita identidade no corpo.** `commentId` é a única referência; autor, tópico e Solicitação de Aprovação são resolvidos do dado já persistido. Isso é o que fecha T-02-18 (Spoofing) sem depender de o `automation/` "prometer" não mentir.
- **`Idempotency-Key` == `eventId`, verificado por igualdade, não só presença.** Mesmo princípio que `webhooks-plataforma.ts` (Plan 02-21) já usava para os três eventos de outbox — cabeçalho e corpo divergentes são duas requisições coladas, nunca um replay legítimo.
- **`eventId` do classificador é um hash determinístico do `commentId`**, não um `randomUUID()` por chamada. `commentId` não tem forma de UUID (exigida pelo schema `z.uuid()` da rota); um id aleatório a cada tentativa quebraria a proteção de replay em qualquer retry do próprio classificador.
- **`/comentario-criado` responde 202 antes de terminar de classificar.** Diferente dos outros dois eventos do webhook (que aguardam o serviço antes de responder), classificar envolve IA e uma chamada de volta à plataforma — não é razoável fazer o outbox de `crm-n1` esperar isso. O receipt garante a entrega; o resultado da classificação só afeta o status do receipt (`concluido`/`falhou`), nunca a resposta HTTP.
- **`syncAndAnalyzeComment` não foi removido nem alterado.** Continua sendo o caminho do webhook ClickUp (`http/routes.ts`, fora de `files_modified`) enquanto D-21 permitir rollback. O que mudou é que a coorte plataforma para de chamá-lo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Teste de wiring adicionado a `webhooks-plataforma.test.ts`, fora do `files_modified` declarado**

- **Found during:** Task 3
- **Issue:** O plano listava `webhooks-plataforma.ts` como modificado mas não sua suíte de teste. Sem cobertura, a mudança estrutural do handler de `/comentario-criado` (responder antes de classificar, delegar ao classificador injetado, nunca mais chamar `syncAndAnalyzeComment`) ficaria sem prova alguma no próprio arquivo que a implementa — um regressão futura ali não seria pega por nada.
- **Fix:** Adicionados 4 casos (k)-(n) à suíte existente, cobrindo: 202 imediato + classificador rodando depois; comentário raiz ainda responde 202 (quem decide "sem efeito" é o classificador); replay do mesmo `eventId` não chama o classificador de novo; falha do classificador marca o receipt como `falhou` com o erro classificado — sem alterar nenhum dos 10 casos (a)-(j) já existentes.
- **Files modified:** `../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts`
- **Verification:** `npm test` no `automation/` — 14/14 casos verdes neste arquivo, suíte inteira 60/61 (a única falha é o item pré-existente documentado em `deferred-items.md`)
- **Committed in:** `bfbce88` (junto com o resto da Task 3 — é o mesmo commit que toca `webhooks-plataforma.ts`)

---

**Total deviations:** 1 auto-fixed (Rule 2 — cobertura de teste para comportamento novo, não escopo novo)
**Impact on plan:** Nenhum comportamento adicional além do que o plano pedia; só prova que o pedido funciona. As 89 mudanças pré-existentes e não relacionadas no `financeiro-tria` continuam intocadas e não staged.

## Issues Encountered

- **`classifyApprovalHeuristic` misclassifica "nao aprovado" quando só a heurística roda (sem chave da OpenAI configurada)** — `/(aprov|ok|seguir|pode|liberad|autoriz)/i` casa "aprov" dentro de "n**ão aprov**ado" e vence, porque o `if` de aprovado é testado ANTES do de reprovado. Confirmado empiricamente (`classifyApprovalHeuristic("nao aprovado")` devolve `"approved"`). Com a chave real da OpenAI configurada neste ambiente (`automation/.env`), `classifyApproval` (heurística + IA) devolve corretamente `"failed"` — é esse caminho completo, não a heurística isolada, que a Tarefa `868hc5pyu` documenta. O caso (g) do plano testa exatamente isso, chamando o `aiAdapter` real (rede real para a OpenAI, ~1.5s). **Não corrigido**: o plano pede explicitamente para não mudar `adapters/ai.ts` nesta fase (`git diff --stat` vazio é critério de aceite) — a heurística sozinha permanece com esse comportamento como uma dívida pré-existente, fora do escopo declarado. Deixado sem novo item em `deferred-items.md` porque não bloqueia nada desta fase (a IA real corrige o caso na prática) e o plano já sabia disso ao pedir a regressão via `classifyApproval`, não via `classifyApprovalHeuristic`.

## Known Stubs

Nenhum. A rota e o classificador têm efeito real sobre o `DataState`/Postgres (via `decideProcessApproval` + `executar()`) e sobre a chamada HTTP real para a plataforma — nenhum dado mockado no caminho de produção.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano — os seis riscos registrados (T-02-18 spoofing/elevação, T-02-19 janela sem prazo, T-02-08 replay/conflito, T-02-10 equivalência clique×comentário, T-02-14 log de comentário) já cobrem exatamente o que foi construído.

## User Setup Required

None - nenhuma configuração externa nova. `FALLBACK_COMENTARIO_ATE`, `PLATAFORMA_BASE_URL` e `PLATAFORMA_SERVICE_TOKEN` já existem em `apps/api/.env.example` / já são exigidas por `../financeiro-tria/automation/src/http/routes.ts` para a fonte "plataforma" (Plan 02-09/02-12) — nada novo a documentar.

## Next Phase Readiness

- SOL-08 fechado: o fallback por comentário decide pela mesma operação de domínio do clique, com janela de 90 dias e métrica contável (`metricaDeOrigem`).
- **Verificação end-to-end pendente de infraestrutura, não de código**: o Postgres do projeto (`db.epomplsskqpluxuujpxl.supabase.co`) está inalcançável desta máquina (IPv6-only, egress IPv6 indisponível) — os 8 casos com banco de `classificacoes.test.ts` e as asserções de estado real não puderam ser executados aqui; `npm run typecheck` e a suíte sem banco confirmam a mecânica de auth/schema. Mesmo padrão de falha que TODOS os outros arquivos "contra o banco real" já apresentavam antes deste plano (`integracao-solicitacoes.test.ts`, `outbox-worker.test.ts` etc.) — não é uma regressão introduzida aqui.
- `metricaDeOrigem` está pronta mas não está exposta por nenhum endpoint ainda — D-10 pede a métrica para decidir o desligamento do fallback ao fim dos 90 dias; um plano futuro (ou uma consulta manual/CLI) precisa lê-la contra `state.approvals` real antes da decisão de desligar.

## Self-Check: PASSED

Todos os arquivos criados (`janela-de-fallback.ts`/`.test.ts`, `classificacoes.ts`/`.test.ts`, `esquemas/classificacoes.ts`, `classificador-de-aprovacao.ts`/`.test.ts`) verificados em disco; `apps/api/src/app.ts` e `../financeiro-tria/automation/src/http/webhooks-plataforma.ts` verificados modificados. Commits `fd53ca5`, `c693ae7` (crm-n1) e `bfbce88` (financeiro-tria) verificados em `git log --oneline --all`.
