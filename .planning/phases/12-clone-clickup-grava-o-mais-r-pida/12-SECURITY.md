---
phase: "12"
slug: "clone-clickup-grava-o-mais-r-pida"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-11-02"
---

# Phase 12 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Fonte do registro: os `<threat_model>` dos 10 planos (24 ameaças, T-12-01 a T-12-24). Verificado contra o código e os testes em 2026-11-02, não só contra os documentos.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| navegador → `POST /operacoes/:nome` (apps/web → apps/api) | a tela manda a operação e recebe a resposta (lista de respostas, uma por chamada, com revisão e diferença) | operação do Espaço de Trabalho, ids, revisão; nunca segredo gerado no cliente (as 14 operações que geram segredo esperam o servidor) |
| `executar()` → Postgres da plataforma | a trava do Espaço (`select … for update`), a hidratação e a gravação num `begin`/`commit` | `plataforma.registros`, `plataforma.workspaces` (revisão), outbox |
| comando `gravacao:medir` → API em loopback | o comando sobe um Fastify no próprio processo com um stub de `verificarToken` | registros `ZZ-MEDICAO-*` criados e mandados à lixeira; só números na saída |
| ramo da fase → produção (VPS e Vercel) | só o dono publica | código e revisão publicados |
| `12-PROVAS.md` e a linha de log → git (repositório `n1-tecnologia/crm`, público) | a saída do comando e a linha "gravacao medida" ficam no histórico | só números, nomes de etapa, de coleção e de operação |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-12-01 | Information Disclosure | campo de medição no corpo da resposta | medium | mitigate | medição por callback `aoMedir`, sem campo em `ResultadoTransacao` (`unidade-de-trabalho.ts:41-43,113,328-351`); `operacoes-medicao.test.ts` afirma a ausência da chave em 200, recusa, 409, 500 e `inviteMember` | closed |
| T-12-02 | Tampering / Information Disclosure | linha de log com nome da operação e dados | medium | mitigate | a linha sai depois do 404 (`operacoes.ts:264` antes de `:331`), só números e desfecho; o teste confere que nome de Lista e e-mail do convite não aparecem; `log.ts:27` censura `authorization` | closed |
| T-12-03 | Spoofing / Elevation of Privilege | stub de `verificarToken` alcançável fora do comando | high | mitigate | `medir-gravacao.cli.ts` sem `export` (0 linhas), sem import em lugar nenhum (só o script do `package.json` e o `spawnSync` do teste), `app.ts:222` segue com `verificarTokenDoSupabase`, stub aceita só o `randomUUID` do processo, escuta só `127.0.0.1`, fecha no `finally` | closed |
| T-12-04 | Tampering | o comando gravando fora do Espaço de teste ou apagando dado real | high | mitigate | só ids que ele criou, prefixo `ZZ-MEDICAO`, só lixeira e nunca apagar (sem operação de apagar), `--confirmar-espaco` para outro Espaço (`cli.ts:76-80`), teste de `md5` de todo registro pré-existente (`medir-gravacao.test.ts:137-142`); rodado em Docker local na 12-02 | closed |
| T-12-05 | Information Disclosure | saída do comando colada em `12-PROVAS.md` | medium | mitigate | as duas saídas só têm nomes de etapa e coleção, contagens, KB e ms; busca por `@`, `http`, `://`, `ZZ-`, `supabase`, `Bearer`, `eyJ`, `senha`, `password` nelas voltou vazia | closed |
| T-12-06 | Repudiation | Atividade assinada pelo Proprietário em gestos que ele não fez à mão | low | accept | aceito pelo dono (D-04); os nomes `ZZ-MEDICAO-…` identificam o rastro; anotado em `12-PROVAS.md` § "Rastro em produção (D-04)" | closed |
| T-12-07 | Elevation of Privilege | o agente publicando ou rodando contra produção sem ordem, ou vazando passphrase | high | mitigate | as tarefas de publicação são `checkpoint:human-action` com `gate="blocking-human"`; varredura dos 74 arquivos da fase: sem chave privada, JWT, `service_role`, `api.env` com conteúdo nem URL de produção com senha (as únicas `postgres://…@` são o Postgres descartável `postgres:x@localhost`) | closed |
| T-12-08 | Tampering | meta e decisão registradas sem o dono ou com número estimado | medium | mitigate | a Task 2 do 12-03 foi `checkpoint:decision` `blocking-human`; a frase do dono está sem paráfrase em `12-PROVAS.md` e `12-CONTEXT.md`; os 300 valores das colunas Antes/Depois estão nas saídas coladas | closed |
| T-12-09 | Denial of Service | escritores esperando a trava esgotam o pool de 10 | medium | mitigate | `lock_timeout` = Q/3 (10 s), uma tentativa, `55P03` vira `rollback` e 409 sem repetir, a conexão volta ao pool (`unidade-de-trabalho.ts:201-207,292,384-394,526`); documentado em `persistencia/CONTEXT.md:82-89` | closed |
| T-12-10 | Denial of Service | chamador travado com Q = 0 esperando sem prazo | medium | mitigate | `TRAVA_DE_RESERVA_MS` = 10 s em `inicioDaTransacaoTravada` (`:213,225-228`); caso no bloco (k) de `unidade-de-trabalho-trava.test.ts` | closed |
| T-12-11 | Denial of Service | importação longa segurando o `ws_n1` | high | mitigate | `regime: "otimista"` só nos quatro importadores longos; `regime-dos-chamadores.test.ts` lê o código-fonte e falha se outro chamador o usar ou se um deles não o usar | closed |
| T-12-12 | Denial of Service | ciclo de espera entre a trava de `executar` e as escritas do CRM/Canais | low | accept | `executar` só lê `plataforma.canais` (sem trava) e só grava `registros`, `workspaces` e outbox; `avancarRevisaoDoEspaco` só roda depois de travar o Canal; sem ciclo por leitura de código (RESEARCH A6); aceito no plano 12-04 | closed |
| T-12-13 | Tampering | diferença aplicada sobre revisão que não é a dela | medium | mitigate | `store.ts:334` compara `revisaoAnterior` com a revisão corrente e, se difere, re-hidrata sem aplicar; casos (d) e (s) de `store.test.ts` | closed |
| T-12-14 | Repudiation / Integrity | mudança mostrada na hora e recusada pelo servidor | medium | mitigate | `terminar` tira a pendente e `refazerPendentes` volta `data` a `confirmado` mais as pendentes; `lastResult` traz a mensagem do servidor; casos de recusa e falha | closed |
| T-12-15 | Tampering | reconstrução refazendo uma gravação já confirmada | medium | mitigate | `tirar(pendente)` antes de `refazerPendentes`; `rehidratar` de fora entra na mesma fila (Pitfall 3); caso dedicado | closed |
| T-12-16 | Tampering | pendente que falhou ao ser refeita enviada com id inexistente | low | mitigate | a que falha sai da fila antes de qualquer envio (`store.ts:264-271`); caso "criar e renomear" | closed |
| T-12-17 | Information Disclosure / Tampering | segredo de link, JID, convite ou chave mostrado antes de existir | medium | mitigate | `OPERACOES_QUE_ESPERAM` (14 entradas) não vira `data` na hora; conjunto fechado por `operacoes-que-esperam.test.ts`; caso do `createForm` em `store.test.ts` | closed |
| T-12-18 | Tampering | `inviteMember` otimista mostrando Membro que o servidor resolve diferente | low | mitigate | `inviteMember` na lista; a resolução e-mail → `userId` fica só em `SERVICOS` (`operacoes.ts:242-254`) | closed |
| T-12-19 | Tampering | navegação para id que o servidor não confirmou (árvore, lentes, Subtarefas) | medium | mitigate | `openTask` ignora pendente; árvore e linha da Tarefa sem `href` com `aria-busy`; Subtarefa pendente sem `Link`; testes `arvore-salvando` e `tarefa-salvando` | closed |
| T-12-20 | Repudiation | fechar a aba com mudança ainda não gravada | medium | mitigate | `beforeunload` com `pendentes > 0` (`deveAvisarAoSair`, `store.ts:583-614`); testes em `store.test.ts` e `guarda-de-navegacao.test.tsx` | closed |
| T-12-21 | Denial of Service | a guarda bloqueando navegação legítima | low | mitigate | só age com id pendente, por igualdade inteira de segmento ou valor de parâmetro, nunca em outra origem; casos "lst_1 não casa com lst_10", "sem id pendente", "outra origem", "depois de desmontar" | closed |
| T-12-22 | Tampering | código não conferido indo para produção | medium | mitigate | `npm run check` verde no Postgres local (3ª rodada) sobre código idêntico ao `37c1cab`; o dono publicou (`blocking-human`); ressalva abaixo | closed |
| T-12-23 | Information Disclosure | saída ou linha de log com segredo ou dado de negócio no git | medium | mitigate | mesma varredura de T-12-05; a linha de log só tem número, nome da operação e desfecho; nenhum `api.env` nem URL com senha em `12-PROVAS.md` | closed |
| T-12-24 | Tampering | âncora de tela sem "salvando" levando a id não confirmado | medium | mitigate | guarda em captura no `document` instalada pelo `StoreProvider` (`click` e `auxclick`, `preventDefault`, `stopPropagation`, `aria-busy`); `guarda-de-navegacao.test.tsx` com o store de verdade | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-12-01 | T-12-06 | Os gestos de medição ficam assinados pelo Proprietário na Atividade; o ruído é aceito e os Espaços `ZZ-MEDICAO-…` o identificam | dono (decisão D-04 de `12-CONTEXT.md`) | Fase 12 |
| AR-12-02 | T-12-12 | Sem ciclo de espera por leitura de código: `executar` só lê `plataforma.canais` e o CRM espera atrás da trava até o `query_timeout` do cliente | plano 12-04 (RESEARCH A6) | Fase 12 |

*Accepted risks do not resurface in future audit runs.*

---

## Notas da auditoria (fora do veredito, sem bloquear)

- **T-12-22, ressalva de ordem.** A API foi publicada a partir do SHA do ramo `fase-11` (`37c1cab`) antes de o `check` do PR #3 fechar. O plano esperava o PR verde antes. Hoje o PR está `CLEAN`, com `check` e `seguranca` em `SUCCESS` no head `b997d21`, e `apps/` e `packages/` idênticos aos do `37c1cab`. O desvio está em `12-10-SUMMARY.md`.
- **Host da VPS em `12-PROVAS.md` (achado informativo, tratado).** A auditoria achou usuário de deploy, IP e nome da chave em duas linhas novas de `12-PROVAS.md` (repositório público). Não são credenciais e o IP já aparece em arquivos de fases anteriores no ramo enviado, mas as duas linhas foram trocadas por texto sem o host antes do envio.
- **Aceite de T-12-12 não está em `persistencia/CONTEXT.md`.** Está no plano, na pesquisa e no SUMMARY do 12-04; fica como lembrete se alguém tocar nas escritas do CRM sob a trava.
- **O que esta auditoria não cobre.** O `D-03` do serviço real (a linha "gravacao medida" com `"regime":"travado"` observada no `journalctl`) segue aberto no `12-PROVAS.md`; não é uma ameaça do registro. Os testes que pedem Postgres (`medir-gravacao`, `unidade-de-trabalho-concorrencia`) não foram reexecutados pelo auditor; foram rodados pelo orquestrador no mesmo dia, num Postgres descartável (6 arquivos, 89 testes verdes).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-02 | 24 | 24 | 0 | gsd-security-auditor (orquestrador do `/gsd-execute-phase 12`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-02
