---
phase: 05
slug: contas-a-receber-e-os-outros-tenants
status: verified
threats_open: 0
threats_total: 120
threats_closed_by_evidence: 112
threats_accepted_with_condition: 8
asvs_level: 1
block_on: high
created: 2026-09-25
---

# Phase 05 — Security

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria.
> Verificado contra o código ATUAL dos dois repositórios (crm-n1 e `../financeiro-tria`), depois da
> rodada de fechamento de lacunas 05-13..05-25 — não contra o código no momento de cada plano.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `apps/api` → `automation/` (outbox → webhook) | Eventos v1 e `automacao.notificar-canal.v1` saem do outbox do Postgres da plataforma e chegam por HTTP autenticado (`Authorization: Bearer`, `timingSafeEqual`) | ids de Tarefa/Automação/Execução, rótulos — nunca número de telefone nem texto livre |
| `automation/` → `apps/api` (getTask de volta) | A Empresa/tenant é sempre lida de volta pela busca autenticada, nunca do payload do evento | DTO v1 da Solicitação (inclui `requesterWhatsApp`) |
| `automation/` → Evolution API / Omie | Envio de WhatsApp (só Marcos Paulo) e lançamentos no Omie por tenant | número de destino, dados de pagamento — dinheiro real |
| Operador → Postgres de produção (`ws_n1`) | CLIs com dry-run por padrão e `--apply` explícito; o classificador de permissão bloqueia agentes, o dono roda | configuração por Empresa, correções auditadas, migrações |
| Formulário público → `apps/api` | Entrada anônima com rate-limit por IP (02-16) | dados de Solicitação |

---

## Threat Register

120 ameaças dos `<threat_model>` dos 25 planos (53 em 05-01..05-12, 67 em 05-13..05-25):
113 `mitigate` + 7 `accept`. **112 fechadas por evidência no código** (ou por risco aceito no plano);
**8 abertas por operação não executada** — nenhuma por código faltando — e fechadas pelo aceite
condicional do dono em SEC-01/SEC-02 (ver Accepted Risks Log). A coluna Status abaixo é o veredito
bruto do auditor; a disposição final das 8 é a do log.

| Threat ID | Plan | Category | Component | Disposition | Status (auditor) | Evidence |
|---|---|---|---|---|---|---|
| T-5-01 | 05-01 | Information Disclosure | `Integration` / schema `plataforma` | mitigate | CLOSED | `packages/dominio/src/types/workspace.ts:195-211` — `empresa`/`omie`/`avisosPorCanal`/`statusDeclarados`, nenhum campo de segredo; `packages/dominio/src/configuracao-por-empresa-evolver.test.ts:58` — `PADRAO_DE_SEGREDO = /app_?key\|app_?secret\|secret\|senha\|password\|token/i` varrendo todas as Integrations |
| T-5-06 | 05-01 | Tampering | evolver sobre `ws_n1` já povoado | mitigate | CLOSED | `packages/dominio/src/configuracao-por-empresa-evolver.ts:102-260` — cria-ou-confere, `divergentes.length > 0` recusa sem gravar; `apps/api/src/bootstrap/configuracao-por-empresa.cli.ts:44-55` — `dryRun = !temFlag("apply")` |
| T-5-07 | 05-01 | Information Disclosure | saída do CLI | mitigate | CLOSED | `apps/api/src/bootstrap/configuracao-por-empresa.cli.ts:58-64` — só `modo`/`criados`/`conferidos`/`divergentes` |
| T-5-SC | 05-01 | Tampering | npm installs | mitigate | CLOSED | `git log -p -- apps/api/package.json` nos commits da fase: só linhas de `scripts`, nenhuma dependência nova |
| T-5-01 | 05-02 | Information Disclosure | `configuracoes/integracoes/page.tsx` | mitigate | CLOSED | `apps/web/src/app/(shell)/configuracoes/integracoes/page.tsx:14,111-122` — só `contaRotulo`/`bancoDeCategorias`/`ultimaRotacaoEm`; nenhum campo de senha/máscara |
| T-5-08 | 05-02 | Spoofing | `statusOptionRefusal` | accept | CLOSED | Racional do accept validado E reforçado: `packages/dominio/src/operations/tasks.ts:214` — `changeTaskStatus` chama `statusNaoDeclaradoPelaEmpresa` de verdade no servidor, independente da dica de tela (linha 1042) |
| T-5-SC | 05-02 | Tampering | npm installs | mitigate | CLOSED | Nenhum pacote novo; nenhum componente de registry (confirmado no SUMMARY, sem contradição encontrada) |
| T-5-09 | 05-03 | Denial of Service | `getTask` do `automation/` | mitigate | CLOSED | `apps/api/src/contratos/v1.ts:39` e `../financeiro-tria/automation/src/adapters/plataforma.ts:128` — os dois lados aceitam os 5 valores, inclusive `em revisão` |
| T-5-10 | 05-03 | Tampering | enum de status | mitigate | CLOSED | `apps/api/src/contratos/v1.test.ts:88-93` e `../financeiro-tria/automation/src/adapters/plataforma.test.ts:182-189` — `"em revisao"` (sem acento) rejeitado dos dois lados, nenhuma normalização |
| T-5-11 | 05-03 | Repudiation | deriva schema × documento | mitigate | CLOSED | `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md` §4 atualizado no mesmo commit (`9e520b9`), confirmado no 05-03-SUMMARY |
| T-5-SC | 05-03 | Tampering | npm installs | mitigate | CLOSED | Nenhum pacote novo em nenhum dos dois repositórios |
| T-5-02 | 05-04 | Spoofing | `resolverTenantDaTarefa` | mitigate | CLOSED | `../financeiro-tria/automation/src/http/webhooks-plataforma.ts:317-328` — Empresa vem SEMPRE de `getTask` (busca autenticada de volta); nenhum evento do contrato v1 ganhou campo de tenant. Confirmado no código PÓS gap-closure (a função foi reescrita para D5-20, mas a garantia T-5-02 permanece intacta) |
| T-5-12 | 05-04 | Elevation of Privilege | roteamento por omissão | mitigate | CLOSED | `webhooks-plataforma.ts:330-343` — `EMPRESA_DESCONHECIDA` sem fallback; reforçado (não enfraquecido) pela recusa adicional `TENANT_SEM_FONTE_PLATAFORMA` do gap-closure (D5-20) para tenants sem fonte "plataforma" |
| T-5-13 | 05-04 | Information Disclosure | corpo do erro 422 | mitigate | CLOSED | `webhooks-plataforma.ts:133-146` — `MENSAGENS_FIXAS` sem interpolação para `EMPRESA_DESCONHECIDA`/`TENANT_SEM_FONTE_PLATAFORMA`; a mensagem com o valor da Empresa vai só para o log (linha ~326) |
| T-5-14 | 05-04 | Repudiation | tabela errada sem revisão | mitigate | CLOSED | 05-04-SUMMARY.md — 3 perguntas respondidas verbatim pelo dono em 2026-09-24; `../financeiro-tria/automation/src/tenants/empresa-para-tenant.ts:11-24` — tabela idêntica à confirmada, sem alteração desde então |
| T-5-SC | 05-04 | Tampering | npm installs | mitigate | CLOSED | Nenhum pacote novo |
| T-5-15 | 05-05 | Tampering | double-write no Omie durante o corte | mitigate | **OPEN-BY-OPERATION** | Tasks 2/3 do plano (`checkpoint:human-verify`, `gate=blocking-human`) NUNCA foram executadas — decisão explícita do dono ("Deixar aberto, seguir fase"), reconfirmada em D5-20 e no `05-VERIFICATION.md` (Critério 2: webhooks ainda ligados, Listas `901109642259`/`901111928443` ainda ativas). A mitigação declarada ("coorte por origem, verificação de gêmeas") É a própria execução do corte — sem ela rodar, a mitigação não existe, só o inventário (`05-CORTE-MP-FO.md`) |
| T-5-16 | 05-05 | Denial of Service | webhook ativo apontando para Lista arquivada | mitigate | **OPEN-BY-OPERATION** | Mesma base: nenhuma Lista foi arquivada, nenhum webhook foi desligado — a ordem D-28 (desligar antes de arquivar) nunca foi exercitada |
| T-5-17 | 05-05 | Repudiation | corte sem trilha | mitigate | **OPEN-BY-OPERATION** | Nenhum desligamento/arquivamento aconteceu — não há trilha a auditar porque não há evento a registrar. `05-05-SUMMARY.md` seção "Threat Flags" confirma: "mitigações... seguem sem aplicação prática até as Tasks 2/3 rodarem" |
| T-5-SC | 05-05 | Tampering | npm installs | mitigate | CLOSED | Plano não escreve código; `git -C ../financeiro-tria status --short` confirmado vazio pela sessão |
| T-5-04 | 05-06 | Information Disclosure | destino da notificação | mitigate | CLOSED | `packages/dominio/src/operations/automations.ts:348-386` (`destinoDeCanal`) — nenhum caminho devolve destino padrão; recusa explícita quando vazio/ausente. Código atualizado por D5-19 (Lista/Campo mudaram, mas a ausência de default se mantém) |
| T-5-18 | 05-06 | Information Disclosure | `ActivityEntry.detail` | mitigate | CLOSED | `automations.ts:387,448-450` — `mascararDestino` (`•••• ` + 4 últimos caracteres) usado no `detail` do `recordActivity` |
| T-5-19 | 05-06 | Tampering | I/O dentro do domínio | mitigate | CLOSED | `grep -n "fetch(\|XMLHttpRequest\|axios" packages/dominio/src/operations/automations.ts` → 0 ocorrências |
| T-5-20 | 05-06 | Repudiation | notificação sem trilha | mitigate | CLOSED | `automations.ts:435-459` — os dois desfechos (recusa e sucesso) chamam `recordActivity` com Ator Automação |
| T-5-SC | 05-06 | Tampering | npm installs | mitigate | CLOSED | Nenhum pacote novo |
| T-5-21 | 05-07 | Information Disclosure | payload do evento de Canal | mitigate | CLOSED | `apps/api/src/persistencia/outbox.ts:61-72` — `.strict()`, campos só `taskId`/`automationId`/`executionId`/`canal`/`destinoTipo`/`campoDestinoId?`/`rotulos?`/`mensagemId`, nenhum número/texto livre |
| T-5-22 | 05-07 | Tampering | evento fora da transação | mitigate | CLOSED | `apps/api/src/persistencia/unidade-de-trabalho.ts:118-133` — evento de Canal derivado e gravado DENTRO do `try`/antes do `commit`; comentário explícito proibindo `fetch`/HTTP no bloco. Reforçado pelo gap-closure (CR-05): a derivação agora é OBRIGATÓRIA em `executar()`, não mais opt-in por rota |
| T-5-23 | 05-07 | Repudiation / duplicate side-effect | entrega repetida | mitigate | CLOSED | `apps/api/src/persistencia/eventos-de-canal.ts:56-60` — `aggregateId = ${executionId}:${indicePasso}` (evoluído por WR-04); `apps/api/migracoes/006-outbox-indice-unico-canal.sql` — índice único parcial correspondente, aplicado em produção (`05-21-SUMMARY.md`/`05-VERIFICATION.md`: `pg_indexes` confirma) |
| T-5-24 | 05-07 | Tampering | Ensaio que envia de verdade | mitigate | CLOSED | `apps/api/src/automacoes/scheduler-worker.ts:517-534` — ramo de Ensaio força `{ok:false}` ANTES de `gravarEventos`, ler `unidade-de-trabalho.ts` confirma que `ok:false` sempre faz `rollback` sem gravar eventos |
| T-5-SC | 05-07 | Tampering | npm installs | mitigate | CLOSED | Nenhum pacote novo |
| T-5-03 | 05-08 | Spoofing | `Authorization: Bearer` da rota nova | mitigate | CLOSED | `../financeiro-tria/automation/src/http/notificar-canal-routes.ts:55,129-134` — `createHash`+`timingSafeEqual` RECRIADOS neste módulo (não importados), checados antes de ler o corpo (fluxo do handler, passo 1) |
| T-5-04 | 05-08 | Information Disclosure | destino do envio | mitigate | CLOSED | `notificar-canal-routes.ts:205-230` — nenhum número no payload; `DESTINO_INDISPONIVEL`/`ROTULO_DESCONHECIDO` são tudo-ou-nada (nenhum envio parcial) |
| T-5-25 | 05-08 | Repudiation / duplicate side-effect | replay do outbox | mitigate | CLOSED* | `notificar-canal-routes.ts:363-377` — `reivindicarReceipt` chamado ANTES de qualquer envio; `duplicado` responde 202 sem reprocessar. *Caveat operacional (não é gap de código): a migração `20260925120000_platform_event_receipts_retentavel_e_canal.sql` que amplia a CHECK para aceitar `falhou_retentavel`/`automacao.notificar-canal.v1` ainda NÃO foi aplicada em produção (confirmado por leitura do banner do arquivo e por `05-VERIFICATION.md`); enquanto isso, um `fecharReceipt` com esses valores falharia contra o schema real. Já rastreado como item de `human_verification` (05-23), não é mitigação ausente do código |
| T-5-26 | 05-08 | Information Disclosure | corpo de erro | mitigate | CLOSED | `notificar-canal-routes.ts:97-103` — `MENSAGENS_FIXAS` próprias, nunca eco do corpo/mensagem da Evolution/número; reforçado por WR-03 (`resumo` do erro nunca inclui `erro.message`, linha ~424-439) |
| T-5-27 | 05-08 | Denial of Service | envio parcial em lote | accept | CLOSED | Racional confirmado no código: `classificarErroDeEnvio` (comentário linhas ~283-296) — retry refaz o lote inteiro, receipt só fecha `concluido` quando todos os envios terminam |
| T-5-SC | 05-08 | Tampering | npm installs | mitigate | CLOSED | Só `express`/`zod`/`node:crypto`/`@supabase/supabase-js`, já presentes; nenhum pacote novo (confirmado por `git log -p` de `automation/package.json` — nenhum commit da fase o tocou) |
| T-5-28 | 05-09 | Tampering | conferidor contra produção | mitigate | CLOSED | `apps/api/src/bootstrap/conferir-contas-a-receber.ts:12,321,355` — comentário "NÃO HÁ CAMINHO DE ESCRITA", `begin`/sempre `rollback`; nenhum `insert`/`update`/`delete` no arquivo |
| T-5-29 | 05-09 | Information Disclosure | saída do CLI e relatório versionado | mitigate | CLOSED | `apps/api/src/bootstrap/conferir-contas-a-receber.cli.ts:13-16,32-58` — só ids/nomes de catálogo e contagens |
| T-5-30 | 05-09 | Repudiation | default acionado em silêncio | mitigate | CLOSED | `.planning/phases/05-.../05-CONFERENCIA-WS-N1.md` §5 — as duas datas (pergunta feita / default acionado, ambas 2026-09-24) e as três razões de D5-02 registradas |
| T-5-SC | 05-09 | Tampering | npm installs | mitigate | CLOSED | Nenhum pacote novo |
| T-5-31 | 05-10 | Tampering | R2/R4/R5 disparando sobre o passado | mitigate | CLOSED | `packages/dominio/src/operations/automations.ts:762-773` — barreira WR-11 (`disparo < inicioDoDiaDaImportacao` → skip) somada às duas originais; `MARCO_ZERO` já GRAVADO em produção para `(ws_n1, lst_contas_a_receber)` em 2026-09-24 (`05-11-SUMMARY.md`); simulação real bateu `skipped=717/717`. Nota: a liberação do relógio (`automacoes:liberar`) segue pendente por decisão do dono (05-25) — isso é um estado MAIS conservador que o exigido (nada executa), não uma lacuna de mitigação |
| T-5-32 | 05-10 | Information Disclosure | Comentário de cobrança gerado por R4/R5 | mitigate | CLOSED | `packages/dominio/src/seed-contas-a-receber.ts:180,186` — R4 usa `mentionClientOwner: true` (Membro/CRM), R5 usa `mentionMemberId: CP.aprovadorId` (Diretoria); nenhum dos dois usa `canal`/WhatsApp |
| T-5-33 | 05-10 | Tampering | evolver sobre Lista em produção | mitigate | CLOSED | `packages/dominio/src/contas-a-receber-evolver.ts` — mesmo padrão cria-ou-confere de T-5-06; dry-run contra `ws_n1` confirmou `0 criados, 23 conferidos, 0 divergentes` |
| T-5-34 | 05-10 | Repudiation | prazo alterado sem trilha | mitigate | CLOSED | `apps/api/src/bootstrap/contas-a-receber.ts:112-138` — `ajustarPrazosDeCobranca` recusa escalonamento invertido (`prazoR5 <= prazoR4`) e grava 2x `recordActivity` com antes/depois |
| T-5-SC | 05-10 | Tampering | npm installs | mitigate | CLOSED | Nenhum pacote novo |
| T-5-05 | 05-11 | Tampering | replay de histórico disparando R2–R6 | mitigate | CLOSED | `packages/dominio/src/operations/importacao-contas-a-receber.ts:218-231` — `createTask(..., { runAutomations: false })`; produção confirmou `automationExecutions` 0→0 e `integration_outbox` 0→0 depois de importar as 240 (05-11-SUMMARY passo 3) |
| T-5-35 | 05-11 | Repudiation | dado inventado durante a importação | mitigate | CLOSED | `apps/api/src/importacao/clickup/contas-a-receber.ts` — todas as 7 categorias de lacuna presentes (`saque-sem-valor`, `parcela-duplicada:<id>`, `cliente-nao-encontrado`, `subtarefa-desamarrada:<id>`, `total-de-parcelas-ausente`, `tipo-inferido`, `status-legado-desconhecido`, `data-de-pagamento-por-date-closed`) |
| T-5-36 | 05-11 | Information Disclosure | saída do CLI e Registros de lacuna | mitigate | CLOSED | `packages/dominio/src/operations/importacao-contas-a-receber.ts:329-341` — `recordActivity` da lacuna usa só a categoria (`detail: lacuna`), nunca nome de cliente/valor |
| T-5-37 | 05-11 | Tampering | reexecução duplicando as 240 | mitigate | CLOSED | Prova em PRODUÇÃO (05-11-SUMMARY passo 4): segunda execução `--apply` → `240 puladas, 0 importadas`, linha de `automacao_agenda` idêntica (`concluido_em` igual) |
| T-5-SC | 05-11 | Tampering | npm installs | mitigate | CLOSED | Nenhum pacote novo |
| T-5-38 | 05-12 | Tampering | preview divergindo do que o domínio cria | mitigate | CLOSED | `apps/web/src/features/estrutura/financeiro/serie-dialog.tsx:27-52` — `parseCivilLocal`/`vencimentoDaParcelaLocal` reproduzem `parseCivil`/`addMonths` do domínio; validação de "Vencimento inválido" usa a mesma regra estrita (não `Date.parse`), confirmado com script de 14 meses, zero divergência (caso do dia 31 incluído) |
| T-5-39 | 05-12 | Information Disclosure | preview numa tela compartilhada | accept | CLOSED | Racional válido: preview mostra só o que a própria sessão acabou de digitar, sem consulta a dado de terceiro |
| T-5-SC | 05-12 | Tampering | npm installs / registry | mitigate | CLOSED | Nenhum pacote novo; nenhum bloco de registry de terceiro |
| T-5-40 | 05-13 | Information Disclosure | `destinoDeCanal` modo campo, Empresa sem canal | mitigate | CLOSED | `packages/dominio/src/operations/automations.ts:366` `rotulosDaEmpresa = integracao.avisosPorCanal?.whatsapp` recusa nos dois modos; `CP.fields.empresa` só aparece em `fillTemplate` (linha 193), nunca em `destinoDeCanal` |
| T-5-41 | 05-13 | Tampering | R2/R4/R5 sobre as 240 importadas | mitigate | CLOSED | `automations.ts:766-767` `if (task.provenance?.kind === "import") { const importado = new Date(task.provenance.at); ...}` dentro de `runScheduledAutomations`; teste dedicado `automations-historico.test.ts` existe em disco |
| T-5-42 | 05-13 | Repudiation / duplicate side-effect | dois passos de Canal, mesma Execução | mitigate | CLOSED | `automations.ts` exporta `indicePasso` (4 ocorrências); `apps/api/src/persistencia/eventos-de-canal.ts:60` `aggregateId: \`${pedido.executionId}:${pedido.indicePasso}\`` — índice de banco só em 05-21 (ver T-5-70) |
| T-5-43 | 05-13 | Information Disclosure | Registro de Atividade do Canal | mitigate | CLOSED | Máscara de destino inalterada (não tocada por este plano); nenhuma recusa nova cita número/valor — confirmado por leitura de `destinoDeCanal`/`runAction` |
| T-5-SC | 05-13 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova — `package.json` do dominio/api não alterado por este plano |
| T-5-44 | 05-14 | Elevation of Privilege | `changeTaskStatus` para Status de outra Empresa | mitigate | CLOSED | `packages/dominio/src/operations/tasks.ts:214` `const naoDeclarado = statusNaoDeclaradoPelaEmpresa(state, task, target);` dentro de `changeTaskStatus`, antes de `entryAllowedMemberIds` |
| T-5-45 | 05-14 | Tampering | Tarefa sem Empresa alcançando Status restrito | mitigate | CLOSED | `tasks.ts:1019-1021`: `if (!empresa) { return "Este Status só vale para a Empresa que o declara..."; }` — fail-closed confirmado; `grep "if (!empresa) return undefined"` não retorna nada |
| T-5-46 | 05-14 | Information Disclosure | corpo da recusa no contrato v1 | accept | CLOSED (accepted risk registrado) | `05-14-PLAN.md` STRIDE table declara accept com racional ("envelope já sanitizado, 409 CONFLITO_DE_ORDEM, mensagem fixa"); confirmado por leitura de `apps/api/src/rotas/integracao-solicitacoes.ts` (mapa de erro fixo) — registrado formalmente neste documento como accepted-risk log |
| T-5-SC | 05-14 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova |
| T-5-47 | 05-15 | Repudiation | decisão de aprovação MP/FO descartada como `concluido` | mitigate | CLOSED | `../financeiro-tria/automation/src/http/webhooks-plataforma.ts`: `grep "ignored: true"` → 0 ocorrências; `TENANT_SEM_FONTE_PLATAFORMA` aparece 4×; `TENANTS_COM_FONTE_PLATAFORMA = new Set(["tria"])` (linha 315) checado em `resolverTenantDaTarefa` (linha 348) |
| T-5-48 | 05-15 | Denial of Service | falha transitória vira perda silenciosa (CR-03) | mitigate | CLOSED | `receipts-da-plataforma.ts` contém `falhou_retentavel` (11 ocorrências); `webhooks-plataforma.ts` consome `reivindicarReceipt`/`fecharReceipt` |
| T-5-49 | 05-15 | Tampering | reivindicação concorrente da mesma linha | mitigate | CLOSED | `receipts-da-plataforma.ts:133` `.update({ status: "recebido", attempts: proximaTentativa })` condicionado a `where status = 'falhou_retentavel'`, contagem de linhas afetadas decide `reivindicado` vs `duplicado` |
| T-5-50 | 05-15 | Tampering | aplicação acidental de `remove_anon_read_painel.sql` | mitigate | CLOSED (nível código) / ver 05-23 para status operacional | `supabase/migrations/20260925120000_..._canal.sql` contém banner "PROIBIDO rodar `supabase db push`..." citando o arquivo perigoso — controle presente independentemente de quando a migração é aplicada |
| T-5-51 | 05-15 | Information Disclosure | corpo de erro | mitigate | CLOSED | `MENSAGENS_FIXAS` sem interpolação (confirmado no plano/summary); nome de Empresa só em log — não re-verificado por grep direto nesta rodada, mas herdado de 05-04 e reafirmado por 05-15 |
| T-5-13 | 05-15 | Spoofing | tenant pelo corpo | mitigate | CLOSED | `webhooks-plataforma.ts:337` `const tenantId = tenantDaEmpresa(tarefa.fields.company);` — `tarefa` vem de `getTask`, nunca do corpo do webhook |
| T-5-SC | 05-15 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova |
| T-5-52 | 05-16 | Tampering | Data de pagamento D+1 (CR-06) | mitigate | CLOSED | `packages/dominio/src/operations/importacao-contas-a-receber.ts`: `grep "comoDiaCivilDoInstante\|slice(0, 10)"` → 0 ocorrências; `apps/api/src/importacao/clickup/contas-a-receber.ts:318` `export function instanteDaDataDePagamento(...)` usado por `mapearContaAReceber` |
| T-5-53 | 05-16 | Tampering | agenda aberta por importação parcial (WR-07) | mitigate | CLOSED | `politica-do-marco-zero.ts:59-63`: `if (rejeitadas > 0) return { acao: "recusar", ... }` antes de qualquer gravação |
| T-5-54 | 05-16 | Elevation of Privilege | `--so-marco-zero` escrevendo sem `--apply` | mitigate | CLOSED | `politica-do-marco-zero.ts:49-51`: `if (soMarcoZero) return apply ? {acao:"gravar"} : {acao:"relatar"};` — sem `--apply` só relata |
| T-5-SC | 05-16 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova |
| T-5-55 | 05-17 | Repudiation | Timeline "enfileirada" sem linha de outbox (CR-05) | mitigate | CLOSED | `apps/api/src/persistencia/unidade-de-trabalho.ts:100,132`: `idsAntes` capturado no laço; `eventos = [...opcoes.eventos?.(...), ...eventosDeNotificacaoPorCanal(antes.state, execucoesNovas(antes.state, idsAntes))]` — derivação incondicional dentro de `executar()` |
| T-5-56 | 05-17 | Tampering | evento de Canal gravado em dobro | mitigate | CLOSED | `grep -rn eventosDeNotificacaoPorCanal apps/api/src` (fora de `.test.ts`) só aparece na definição e em `unidade-de-trabalho.ts` — as derivações explícitas de `operacoes.ts`/`scheduler-worker.ts` foram removidas |
| T-5-57 | 05-17 | Tampering | importação gravando evento de saída | mitigate | CLOSED | `unidade-de-trabalho.ts:59,134`: `semEventosDeSaida?: true` lança se `eventos.length > 0`; ligado em `importar-contas-a-receber.ts:201` e `importar-contas-a-pagar.ts:215` (`semEventosDeSaida: true`) |
| T-5-58 | 05-17 | Denial of Service | formulário anônimo gerando WhatsApp em massa | accept | CLOSED (accepted risk registrado) | Racional no `05-17-PLAN.md`: rate-limit por IP (02-16) já vale; destino fixo por Empresa; só Empresa com canal declarado é notificada — não re-verificado o rate-limit em código nesta rodada (herdado de fase anterior) |
| T-5-SC | 05-17 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova |
| T-5-59 | 05-18 | Information Disclosure | envio pela instância MP para Tarefa de outra Empresa (WR-02) | mitigate | CLOSED | `notificar-canal-routes.ts:393-395`: `if (tenantDaEmpresa(tarefa.fields.company) !== "marcos-paulo") { ...422 EMPRESA_SEM_CANAL }` antes de resolver destino, nos dois modos |
| T-5-60 | 05-18 | Information Disclosure | número de telefone no log (WR-03) | mitigate | CLOSED | `grep "console.error(.*, erro)"` → 0 ocorrências; classificação de erro por `code`/`httpStatus`/`erro.name` (confirmado por leitura de `classificarErroDeEnvio` e do `catch`) |
| T-5-61 | 05-18 | Denial of Service | mensagem perdida em falha transitória (CR-03) | mitigate | CLOSED | Rota importa `reivindicarReceipt`/`fecharReceipt` de `./receipts-da-plataforma` (módulo neutro de 05-15); `ErroPermanenteDaPlataforma`/`ErroTransitorioDaPlataforma` checados antes da regex Evolution |
| T-5-62 | 05-18 | Tampering | destino escolhido por semelhança de Campo | mitigate | CLOSED | `CAMPO_ID_PARA_CHAVE = { fld_sp_z_whatsapp: "requesterWhatsApp" }` (linha 206) — `fd_cp_whatsapp` só resta em comentário histórico (linha 202) |
| T-5-03 | 05-18 | Spoofing | Bearer | mitigate | CLOSED | `notificar-canal-routes.ts:134` usa `timingSafeEqual` — inalterado |
| T-5-27 | 05-18 | Denial of Service | reenvio parcial de lote | accept | CLOSED (accepted risk registrado) | Racional no `05-18-PLAN.md`: reentrega reenvia o lote inteiro por desenho; alvo é aviso interno (Marcos Paulo), risco aceito desde 05-08 |
| T-5-SC | 05-18 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova |
| T-5-63 | 05-19 | Tampering | linhas de teste entregues como trabalho real (CR-07) | mitigate | CLOSED | `scheduler-worker.test.ts:125` `delete from plataforma.integration_outbox where workspace_id = $1` dentro de `limparWorkspace`; SUMMARY documenta 2 execuções verdes e consulta pós-execução |
| T-5-64 | 05-19 | Tampering | `delete` alcançando `ws_n1` | mitigate | CLOSED | `limpar-outbox-de-teste.ts`: `grep -c "<> 'ws_n1'"` = 6 ocorrências (levantamento e remoção); nenhuma seleção de `payload` |
| T-5-65 | 05-19 | Repudiation | remoção sem trilha | mitigate | CLOSED | SUMMARY 05-19 registra dry-run antes/depois, autorização verbatim do dono ("Remover as 9 (--apply)"), e a saída real do `--apply` (9 removidas) |
| T-5-66 | 05-19 | Information Disclosure | saída da CLI | mitigate | CLOSED | `limpar-outbox-de-teste.ts` — nenhuma seleção de `payload`/`taskId`/id de linha nas queries agregadas (confirmado por grep) |
| T-5-SC | 05-19 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova |
| T-5-67 | 05-20 | Tampering | configuração divergente aceita como "conferida" (WR-05) | mitigate | CLOSED | `configuracao-por-empresa-evolver.ts`: `grep -c "avisosPorCanal\|statusDeclarados"` = 9 ocorrências (criação/conferência via `canonico()`) |
| T-5-68 | 05-20 | Tampering | `--apply` em produção sem leitura | mitigate | CLOSED | SUMMARY 05-20: dry-run (`criados 8`) → autorização verbatim do dono ("Aplicar em ws_n1") → `--apply` → dry-run pós (`criados 0, conferidos 8, divergentes 0`) — idempotência provada |
| T-5-69 | 05-20 | Information Disclosure | rótulos/nomes na saída | mitigate | CLOSED | Saídas coladas no SUMMARY só com contagens (`criados`/`conferidos`/`divergentes`, "Integrações com empresa: 6" etc.) — nenhum nome de Empresa/rótulo de conta |
| T-5-SEC | 05-20 | Information Disclosure | segredo Omie na plataforma | mitigate | CLOSED | Herdado de 05-01, não editado por este plano; saída do `--apply` não contém `app_key`/`app_secret` |
| T-5-SC | 05-20 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova |
| T-5-70 | 05-21 | Repudiation / duplicate side-effect | aviso de WhatsApp em dobro (WR-04) | mitigate | CLOSED | `apps/api/migracoes/006-outbox-indice-unico-canal.sql`: `create unique index if not exists integration_outbox_notificar_canal_uniq ... where event_type = 'automacao.notificar-canal.v1'` — **aplicado em produção** (SUMMARY 05-21: `pg_indexes` confirma 1 linha, `plataforma.migracoes` registra `006-...` em 2026-09-24T20:22:18Z); teste `(a2)` de `integracao.test.ts` 7/7 verde 2× pós-migração |
| T-5-71 | 05-21 | Tampering | `npm run migrar` aplicando migração inesperada | mitigate | CLOSED | Dry-run pré-`--apply` (SUMMARY) confirmou 006 como única pendente (001-005 já aplicadas) antes da autorização |
| T-5-72 | 05-21 | Denial of Service | criação do índice falhando sobre dado existente | mitigate | CLOSED | Dry-run confirmou "duplicidade de Canal: 0 linhas" antes do `--apply` |
| T-5-SC | 05-21 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova |
| T-5-73 | 05-22 | Tampering | sobrescrever Data de pagamento editada à mão | mitigate | CLOSED | `packages/dominio/src/operations/importacao-contas-a-receber.ts:396-402`: `if (valorAtual !== entrada.esperadoAtual) return fail("Divergente — nada sobrescrito...")` |
| T-5-74 | 05-22 | Repudiation | correção sem trilha | mitigate | CLOSED | Registro de Atividade com `before`/`after`/`detail: "CR-06"` (confirmado por leitura da função); SUMMARY registra dry-run/relatório |
| T-5-75 | 05-22 | Tampering | correção disparando Automação ou outbox | mitigate | CLOSED | `setTaskFieldValue` não roda Automação; `aplicarCorrecoes` usa `executar(..., { semEventosDeSaida: true })` (herdado de 05-17); contagens de `automationExecutions`/outbox antes/depois idênticas no SUMMARY |
| T-5-76 | 05-22 | Tampering | export adulterado | mitigate | CLOSED | `aplicarCorrecoes` confere integridade contra manifesto antes de ler (herdado de T-3-27), conforme plano/SUMMARY |
| T-5-77 | 05-22 | Information Disclosure | saída da CLI | mitigate | CLOSED | SUMMARY: saída só com contagens (`lidas 240`, `afetadas por origem`, etc.); detalhe por linha gravado fora do git |
| T-5-SC | 05-22 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova |
| T-5-50 | 05-23 | Tampering | aplicação acidental da remoção de `anon_read` | mitigate | **OPEN-BY-OPERATION** | Controle de código presente (banner, ver 05-15); mas a Task 1 (aplicar migração) NUNCA foi executada — não existe `05-23-SUMMARY.md`, e o banner do `.sql` ainda diz "NOT YET APPLIED" (confirmado por grep: `APPLIED em` = 0 ocorrências) |
| T-5-81 | 05-23 | Tampering | migração sobre CHECK de nomes diferentes | mitigate | CLOSED (controle de código) / **OPEN-BY-OPERATION** (aplicação) | `conkey`-based removal presente na migração (verificado em 05-15); a aplicação em si nunca ocorreu |
| T-5-82 | 05-23 | Denial of Service | deploy antes da migração → receipts de Canal falham | mitigate | **OPEN-BY-OPERATION — sem impacto atual** | Gate processual ("Task 2 exige Task 1 concluída") nunca testado porque nem Task 1 nem Task 2 (deploy) ocorreram — `automation/` com as correções de 05-04/05-08/05-15/05-18 segue fora de produção |
| T-5-83 | 05-23 | Elevation of Privilege | deploy expondo rota nova sem auth | mitigate | **OPEN-BY-OPERATION — sem impacto atual** | Nenhum deploy ocorreu; fumaça (200/401/401) nunca executada — não aplicável enquanto não houver deploy |
| T-5-84 | 05-23 | Information Disclosure | segredo/variável no SUMMARY | mitigate | **OPEN-BY-OPERATION** | Não verificável — plano nunca produziu SUMMARY (execução não ocorreu) |
| T-5-SC | 05-23 | Tampering | npm installs | mitigate | N/A | Plano não executado |
| T-5-78 | 05-24 | Tampering | deriva silenciosa entre domínio e `automation/` (classe CR-02) | mitigate | CLOSED | `contratos/notificar-canal-v1/` com 3 fixtures existe; `apps/api/src/contratos/notificar-canal.contrato.test.ts` (gerador) e `../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts` (consumidor, usa `criarPlataformaAdapter` 3×) existem em disco; SUMMARY documenta duas provas de deriva feitas e revertidas (ambos os lados ficam vermelhos) |
| T-5-79 | 05-24 | Information Disclosure | dado real/telefone em fixture versionada | mitigate | CLOSED | `grep -cE "[0-9]{9,}" contratos/notificar-canal-v1/*.json` → 0 em todos os arquivos |
| T-5-80 | 05-24 | Spoofing | contrato validado contra DTO fabricado à mão | mitigate | CLOSED | Teste consumidor usa `criarPlataformaAdapter(...).getTask` real (schema `.strict()` do adapter), não um DTO à mão — confirmado por grep |
| T-5-SC | 05-24 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova |
| T-5-31 | 05-25 | Tampering | R2/R4/R5 disparando sobre o passado | mitigate | CLOSED (mas relógio segue desligado) | Três camadas confirmadas: `MARCO_ZERO` gravado (05-11), barreira WR-11 em código (05-13, ver T-5-41), e simulação pré-voo (717/717 pares pulados) documentada no SUMMARY 05-25 — o relógio foi deliberadamente ADIADO pelo dono ("Adiar o relógio (Recomendado)"), então o risco nem chega a ser exercitado em produção |
| T-5-85 | 05-25 | Tampering | processo de scheduler processando outra Lista inesperadamente | mitigate | CLOSED (mitigação = informar o dono) / **WARNING residual** | Task 1 listou toda Lista com agenda; achou 14 Espaços de TESTE com Automações temporais ativas no Postgres de produção (`ws_outbox_*`, `ws_spike*`, `ws_debug_automations`, `ws_teste_classificacoes_*`, `ws_teste_integracao_solicitacoes_*`) que a limpeza de 05-19 NÃO cobriu (só limpou outbox/agenda, não `registros`/`workspaces`). Documentado como "achado fora do escopo, não corrigido" — ver seção Unregistered abaixo |
| T-5-86 | 05-25 | Repudiation | liberação/R7 sem trilha | mitigate | CLOSED | Decisões do dono registradas verbatim com data no SUMMARY: R7 "Adiar R7"; relógio "Adiar o relógio (Recomendado)" |
| T-5-87 | 05-25 | Information Disclosure | títulos/valores no SUMMARY | mitigate | CLOSED | Tabela do pré-voo no SUMMARY só tem contagens/estados/códigos — nenhum título de Tarefa, nome de cliente ou valor de Campo |
| T-5-SC | 05-25 | Tampering | npm installs | mitigate | CLOSED | Nenhuma dependência nova (nenhum arquivo de código foi modificado — `files_modified: []`) |

*Status: open · closed · OPEN-BY-OPERATION (mitigação é um passo operacional ainda não executado)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| SEC-01 | T-5-15 (HIGH), T-5-16 (MEDIUM), T-5-17 (LOW) — 05-05, corte de Marcos Paulo e Family Office | A mitigação é o próprio procedimento do corte (D-28: desligar os webhooks ClickUp → 48h de silêncio → conferir gêmeas → arquivar as Listas 901109642259/901111928443), não executado por decisão D5-20. Risco hoje **dormente**: o `automation/` recusa MP/FO vindos da plataforma (`TENANTS_COM_FONTE_PLATAFORMA = {"tria"}`, `422 TENANT_SEM_FONTE_PLATAFORMA`), então não há caminho de double-write no Omie. **CONDIÇÃO:** SEC-01 reabre e BLOQUEIA qualquer fase ou mudança que libere a fonte "plataforma" para marcos-paulo/family-office sem executar o corte (05-05 Tasks 2/3, ordem D-28) antes. | dono do produto ("Aceitar com condição (Recomendado)") | 2026-09-25 |
| SEC-02 | T-5-50, T-5-81, T-5-82 (MEDIUM), T-5-83, T-5-84 — 05-23 | Controles de código presentes (banner NOT YET APPLIED, proibição de `supabase db push`, remoção de CHECK por `conkey`, rotas autenticadas). Falta o ato humano: aplicar `20260925120000_platform_event_receipts_retentavel_e_canal.sql` sozinha no Supabase do `automation/` e decidir o deploy. Efeito enquanto isso: as correções CR-01/02/03 e WR-02/03 não protegem produção (T-5-82); nenhuma superfície nova insegura aberta. **CONDIÇÃO:** fecham quando o 05-23 rodar (migração antes do deploy; fumaça 200/401/401); nenhuma Automação de Canal real é publicada em `ws_n1` antes disso. | dono do produto ("Aceitar com condição (Recomendado)") | 2026-09-25 |
| SEC-03 | T-5-08 (05-02), T-5-27 (05-08), T-5-39 (05-12), T-5-46 (05-14), T-5-58 (05-17), T-5-27 (05-18) | Riscos aceitos no próprio plano, com racional confirmado no código pelo auditor (ex.: `changeTaskStatus` aplica D5-06 no servidor além da dica de tela; reentrega reenvia o lote inteiro por desenho; mensagens de recusa fixas). T-5-58 herda o rate-limit por IP de 02-16, não re-verificado nesta rodada. | planos da fase (disposição `accept`) | 2026-09-24 |

*Riscos aceitos não ressurgem em auditorias futuras — exceto quando a CONDIÇÃO de SEC-01/SEC-02 for violada.*

---

## Superfície não registrada (WARNING, não bloqueante)

~14 Espaços de teste com Automações temporais ativas no Postgres de produção (`ws_outbox_*`,
`ws_spike*`, `ws_debug_automations`, `ws_teste_*`), achados no pré-voo de 05-25 (WR-A em
05-REVIEW.md). `apps/api/src/index.ts` não restringe o catálogo do scheduler por Espaço: um worker
ligado criaria agenda e rodaria Automação nesses Espaços. Dormente (nenhum worker em produção).
Pré-requisito do Critério 3 junto de PERS-08/D-15 — item 5 de 05-UAT.md.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-24 | 53 (05-01..05-12) | 50 | 3 (OPEN-BY-OPERATION, 05-05) | gsd-security-auditor (interrompido pelo limite de uso depois de gravar o resultado completo) |
| 2026-09-24 | 67 (05-13..05-25) | 62 | 5 (OPEN-BY-OPERATION, 05-23) | gsd-security-auditor |
| 2026-09-25 | 120 | 112 + 8 aceitas com condição | 0 | orquestrador, com aceite do dono (SEC-01/SEC-02) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-25 (com as condições de SEC-01 e SEC-02)
