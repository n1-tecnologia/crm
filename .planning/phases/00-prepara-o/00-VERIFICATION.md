---
phase: 00-prepara-o
verified: 2026-09-17T12:00:00Z
status: human_needed
score: 5/5 success criteria hold in the codebase (2 with documented caveats)
overrides_applied: 0
gaps: []
human_verification:
  - test: "Abrir no ClickUp as três Listas (901109104938, 901107637383, 901107648977) com filtro 'incluir fechadas'/'incluir arquivadas' e comparar o total de Tarefas de cada uma com `tarefas + tarefasArquivadas` do MANIFESTO.md; abrir 3 Tarefas por amostragem e conferir Comentários/anexos contra o disco; confirmar em Settings > ClickApps que 'Total time in Status' está ligado."
    expected: "Totais batem (ou a diferença é explicada por Tarefas criadas/apagadas depois da data do manifesto, 2026-09-17T02:40:34.413Z); Comentários/anexos das 3 Tarefas amostradas batem; time_in_status ligado bate com timeInStatusDisponivel: true já registrado no manifesto."
    why_human: "Exige comparar contra o ClickUp de produção com o token real e a UI — não reproduzível em CI sem repetir a exportação (00-VALIDATION.md classifica como Manual-Only; harvested do <human-check> de 00-05-PLAN.md Task 2)."
  - test: "Ler apps/api/README.md § 'Exportar o ClickUp' e, seguindo só o README, rodar `npm run exportar:clickup -w @n1/api -- --so-manifesto` e depois `git status`."
    expected: "O comando regenera MANIFESTO.md/.json a partir do disco sem pedir nada além do que o README diz; `git status` mostra no máximo os dois arquivos de manifesto e nada de apps/api/exportacoes/clickup/."
    why_human: "Prova que o dono consegue repetir a operação sem ler código, e é a última verificação de que nada da exportação vaza para o git no ambiente real (harvested do <human-check> de 00-07-PLAN.md Task 2). Não executado por este verificador para não sobrescrever a pasta versionada real (mesmo risco já documentado em 00-04/00-05 SUMMARY: `--so-manifesto` sem `--pasta` grava sobre o manifesto commitado)."
  - test: "Ler docs/07-processos/solicitacao-de-pagamento.md §3 (Status) e §4 (Campos) contra a exportação bruta (list.json, fields.json, as 19 Tarefas) e confirmar que §12 lista fielmente o que ficou aberto; dono/Financeiro valida as 5 lacunas devolvidas (L-01, L-03, L-07, L-09, L-11)."
    expected: "A spec reflete a Lista real (não inventa Status/Campo); as lacunas abertas em §12 são as que genuinamente exigem conhecimento humano fora do sistema."
    why_human: "Verificação de conteúdo de documento markdown — julgamento de domínio pelo dono/Financeiro, não reproduzível por grep (00-VALIDATION.md Manual-Only). Este verificador conferiu estruturalmente (12 seções, D6/D8 fechados, citações a Tarefas por id, ausência de PII, referências cruzadas ao manifesto e ao automation/ consistentes) mas não substitui a validação de domínio do dono."
---

# Phase 0: Preparação — Verification Report

**Phase Goal:** Tudo o que a Fase 2 consome existe e é confiável — o processo de Solicitação de pagamento está escrito a partir da Lista real, o ClickUp está exportado como insumo e prova de paridade, os usuários do ClickUp têm Membro correspondente e nenhuma credencial exposta continua válida.

**Verified:** 2026-09-17
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `docs/07-processos/solicitacao-de-pagamento.md` existe, no padrão de `contas-a-pagar.md`, lido da Lista real, responde D6/D8 e absorve OQ-CMP-01/02/04 | ✓ VERIFIED | 326 linhas, 12 seções `## N.` exatas (§1–§12); §2 fecha D6 (Lista própria + Vínculo); §8 fecha D8 (clique oficial + fallback 90 dias, S1-S8, 8 linhas `\| S[0-9]+ \|`); §4 mostra `Cartão` absorvido como 4ª opção do Campo (OQ-CMP-01), `em revisão` confirmado ausente e não replicado (OQ-CMP-02), validação CPF/CNPJ documentada como residente no `automation/` (OQ-CMP-04); 10 `RN-SP-0N`, 1 `INV-SP-01`; 0 marcadores `⚠ A confirmar` inline; 0 e-mail/CPF/CNPJ no arquivo (`grep -c "@"` = 0); cabeçalho cita a exportação real (`MANIFESTO.md`, commit `d35183c`, 19 Tarefas, 8 ids amostrados) |
| 2 | As três Listas (`901109104938`, `901107637383`, `901107648977`) estão exportadas em disco com Tarefas, Campos, Comentários, histórico de status e anexos, paginadas — dá para contar e comparar | ✓ VERIFIED (com ressalva CR-01, ver Anti-Patterns) | `apps/api/exportacoes/clickup/<listId>/` confirmado em disco com `list.json`, `fields.json`, `members.json`, `task/`, `tasks/`, `tasks-arquivadas/`, `comments/`, `time-in-status/`, `attachments/` para as 3 Listas; `MANIFESTO.json` (commitado, `git ls-files` confirma) recontado nesta verificação: `arquivos.length` 11001, `hashAgregado` presente, `listas[]` com as 3 Listas e contagens (2.859+2 / 240 / 19 Tarefas, 4.412 Comentários, 3.120 `time_in_status`, 1.595 anexos) — batem exatamente com o que o 00-05-SUMMARY declara; `git status --porcelain apps/api/exportacoes/` vazio (nada da pasta `clickup/` rastreada); 0 e-mail em `MANIFESTO.json`/`.md` |
| 3 | Tabela de de-para dos 6 IDs de usuário do ClickUp (+ 38 variáveis `CLICKUP_*`) para Membros, pronta para as Fases 2/3 | ✓ VERIFIED (com ressalva documentada) | `apps/api/src/importacao/clickup/de-para-usuarios.ts` (650 linhas): `DE_PARA_USUARIOS` com exatamente 6 `clickupUserId` (Elifas `81591229`, Fabíola `81581798`, Thiago `81581826`, Iallas `81582295`, Financeiro `81581816`→`mem_maryane`, revisor FO `81581802`); `CATALOGO_CLICKUP` com 62 entradas (`nome:` contado); 0 ocorrências de `senha|password|secret|pk_...`; 47/47 testes do módulo passam (`npm run test -w @n1/api -- importacao/clickup`), incluindo `de-para-usuarios.test.ts`. Ressalva honesta: 1/6 e-mails (revisor FO) tem `fonteDoEmail: "nao-resolvido"`/`email: ""` — `inviteMember` recusa e-mail vazio por si só, então a entrada não pode virar Membro fantasma; REQUIREMENTS.md já documenta isso como aceite satisfeito ("não especificado além da tabela") |
| 4 | (risco aceito pelo dono, D-13 — não cobrar) Credenciais Omie continuam em uso | N/A — excluído da verificação por instrução explícita do usuário (D-13, `00-CONTEXT.md`) | `.planning/REQUIREMENTS.md` linha PREP-05 e tabela de rastreabilidade confirmam "risco aceito pelo dono em 2026-09-16, D-13"; `docs/08-migracao-financeiro/03-plano-de-migracao.md:100` risca a linha com a mesma decisão datada; `.planning/ROADMAP.md` critério 4 já reflete o texto de risco aceito. Nada a cobrar aqui. |
| 5 | (já verdadeiro) Schema `plataforma` existe, `npm run migrar` o aplica; volume do legado medido | ✓ VERIFIED | `apps/api/migracoes/001-plataforma.sql` existe (`create schema if not exists plataforma`); `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §5.7 tem a tabela de volume (`omie_clientes` 9.510, `solicitacoes_pagamentos` 1.110 etc.) — já verificado na Fase 1 |

**Score:** 5/5 criteria hold (criterion 4 excluded from grading per explicit D-13 instruction; criteria 2 and 3 carry documented, non-blocking caveats — see below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/07-processos/solicitacao-de-pagamento.md` | Spec §1–§12 lida da Lista real | ✓ VERIFIED | 326 linhas, todas as seções presentes, conteúdo específico (Tarefa `868jxd42g` como fio condutor, ids reais de 8 Tarefas amostradas) |
| `apps/api/exportacoes/MANIFESTO.md` / `.json` | Prova de paridade, sem PII | ✓ VERIFIED | Commitados (`git ls-files`), 0 e-mail/CPF/CNPJ, `versao:1`, `amostra:false`, `hashAgregado` presente, 11.001 arquivos |
| `apps/api/exportacoes/clickup/` (dados brutos) | 3 Listas em disco, fora do git | ✓ VERIFIED | Confirmado em disco (estrutura completa por Lista); `git status --porcelain` limpo |
| `apps/api/src/importacao/clickup/de-para-usuarios.ts` | 6 entradas + catálogo 62 vars | ✓ VERIFIED | Tipado, testado, sem segredo |
| `apps/api/src/importacao/clickup/{cliente,paginacao,exportar,manifesto}.ts` | Módulo exportador completo | ✓ VERIFIED | 47/47 testes do módulo passam; `npm run check` verde (api 120, web 53, dominio 253) |
| `.planning/REQUIREMENTS.md` | PREP-01..06 com status e prova | ✓ VERIFIED | Todas as 6 linhas `[x]`/Complete com commit ou decisão datada; tabela de rastreabilidade sem orphans |
| `apps/api/README.md` | Roteiro de exportação do ClickUp | ✓ VERIFIED | § 4 "Exportar o ClickUp" presente com comando, flags, LGPD, manifesto |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `docs/07-processos/solicitacao-de-pagamento.md` | `apps/api/exportacoes/clickup/901109104938/` | Fonte dos dados | ✓ WIRED | Cabeçalho cita data do manifesto (`2026-09-17T02:40:34.413Z`), commit `d35183c`, `list.json`/`fields.json`, 8 ids de Tarefa amostrados |
| `docs/07-processos/solicitacao-de-pagamento.md` | `docs/07-processos/contas-a-pagar.md` | Vínculo Solicitação → Conta a pagar (D6) | ✓ WIRED | §1 e §2 citam o RESUMO (`contas-a-pagar.md` §6.3) como a ponte hoje; Vínculo estruturado descrito como o que falta na plataforma |
| `apps/api/exportacoes/MANIFESTO.json` | `apps/api/exportacoes/clickup/<listId>/...` | `arquivos[].caminho` + `sha256` recontados do disco | ⚠ PARTIAL (ver CR-01) | Contagens e hashes corretos para os 11.001 arquivos; os 1.595 caminhos de anexo (`<listId>/attachments/<taskId>/<attId>`) estão truncados aos 8 primeiros caracteres hex do id real (UUID), quebrando o contrato documentado (`<attachmentId>` completo) — ver Anti-Patterns/CR-01 |
| `apps/api/src/importacao/clickup/de-para-usuarios.test.ts` | `packages/dominio/src/bootstrap-gestao.ts` | `buildGestaoBootstrap().roles/.members` | ✓ WIRED | Teste cruza `roleIdEsperado` e `mem_maryane` contra o bootstrap real |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Módulo do exportador ClickUp passa (unit + integração real) | `npm run test -w @n1/api -- importacao/clickup` | 6 test files, 47/47 passed | ✓ PASS |
| `npm run check` verde nos 3 workspaces | `npm run check` | api 120/120, web 53/53, dominio 253/253, lint/tokens ok | ✓ PASS |
| MANIFESTO.json recontado bate com o SUMMARY | `node -e` sobre o JSON | 11.001 arquivos, 3 listas, contagens idênticas às do 00-05-SUMMARY | ✓ PASS |
| Nenhum PII no manifesto commitado | `grep -c "@"` em `MANIFESTO.{md,json}` | 0/0 | ✓ PASS |
| Nenhum PII na spec commitada | `grep -E` e-mail/CPF/CNPJ em `solicitacao-de-pagamento.md` | 0/0 | ✓ PASS |
| Sem colisão de caminho no manifesto (risco do CR-01) | comparação de `arquivos[].caminho` | 11.001 únicos / 11.001 totais, 0 duplicados | ✓ PASS (mitiga o pior caso do CR-01 nesta exportação específica) |
| `apps/api/exportacoes/clickup/` fora do git | `git status --porcelain` / `git ls-files` | Nenhuma entrada da pasta `clickup/` rastreada | ✓ PASS |
| Debt markers (`TBD`/`FIXME`/`XXX`) nos arquivos da fase | `grep -nE` nos arquivos criados/modificados | 0 ocorrências | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PREP-01 | 00-07 (referenciado) | Schema `plataforma` criado | ✓ SATISFIED | `apps/api/migracoes/001-plataforma.sql` (já feito antes da fase, commit `b20597d`) |
| PREP-02 | 00-01, 00-03, 00-04, 00-05 | Exportação completa das 3 Listas | ✓ SATISFIED (com CR-01) | Ver truth #2 acima |
| PREP-03 | 00-06 | Spec da Solicitação de pagamento | ✓ SATISFIED | Ver truth #1 acima; 5 lacunas (L-01/03/07/09/11) explicitamente abertas em §12, permitido pelo próprio critério do ROADMAP |
| PREP-04 | 00-02 | De-para de usuários ClickUp | ✓ SATISFIED (aceite = tabela existir) | Ver truth #3; ressalva do revisor FO documentada e sem risco de Membro fantasma |
| PREP-05 | 00-07 | Rotação de credenciais Omie | N/A — risco aceito (D-13) | Não coberto por instrução explícita do usuário |
| PREP-06 | (já feito) | Volume do legado medido | ✓ SATISFIED | `01-inventario-financeiro-tria.md` §5.7 |

Nenhum requisito órfão: todos os IDs PREP-01..06 do ROADMAP aparecem no campo `requirements:` de pelo menos um PLAN desta fase (00-01 a 00-07), e todos aparecem em `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/importacao/clickup/manifesto.ts` | 257 (`CAMINHO_DE_ANEXO`) | CR-01 (00-REVIEW.md): regex de anexo captura só até o primeiro `-`, truncando todo `attachmentId` real (UUID) a 8 caracteres hex; contrato documentado (`<attachmentId>` completo) violado para os 1.595 anexos do manifesto commitado | ⚠ WARNING (não BLOCKER) | Verificado nesta sessão: os 1.595 caminhos de anexo do `MANIFESTO.json` commitado têm exatamente 8 caracteres no último segmento; **0 colisões de caminho** nos 11.001 arquivos atuais (confirmado por comparação direta), então a contagem e a comparação agregada ("dá para contar e comparar") continuam corretas hoje. O que está degradado é a identificação individual e precisa de um anexo específico por id completo — um verificador de paridade que tente casar um anexo da Fase 2/3 pelo id completo precisaria de busca por prefixo. Julgamento deste verificador: **não invalida o critério 2 do ROADMAP** (contar/comparar agregado funciona), mas é um item real, já documentado pelo code review, apropriado para `--fix` antes que a importação (Fase 2/3) dependa de correspondência exata por `attachmentId`. Não bloqueia o fechamento desta fase. |
| (demais 8 warnings + 8 info do `00-REVIEW.md`) | — | Robustez de re-execução (download de anexo sem try/catch, redirect não revalidado, `--pasta` sobrescrevendo o manifesto versionado, etc.) | ℹ INFO | Afetam **futuras** re-exportações/robustez, não os dados já commitados e usados por esta fase (a exportação real de 00-05 completou sem interrupção, sem retry, sem 429 persistente). Não bloqueiam o goal desta fase; recomendado tratar antes de uma re-exportação para a Fase 2/3 confiar em retomada automática. |

Nenhum marcador `TBD`/`FIXME`/`XXX` sem referência nos arquivos criados/modificados pela fase.

## Human Verification Required

### 1. Manifesto commitado bate com as contagens reais das 3 Listas

**Test:** Abrir no ClickUp (produção) as três Listas com filtro "incluir fechadas"/"incluir arquivadas" e comparar o total de Tarefas de cada uma com `tarefas + tarefasArquivadas` do `MANIFESTO.md`; abrir 3 Tarefas por amostragem e conferir Comentários/anexos contra o disco; confirmar em Settings › ClickApps que "Total time in Status" está ligado.
**Expected:** Totais batem (ou diferença explicada por Tarefas criadas/apagadas depois de 2026-09-17T02:40:34Z); amostra de Comentários/anexos bate; ClickApp ligado bate com `timeInStatusDisponivel: true`.
**Why human:** Exige o ClickUp de produção com token e UI — não reproduzível em CI sem repetir a exportação inteira (~2h). Classificado como Manual-Only em `00-VALIDATION.md`; harvested do `<human-check>` de `00-05-PLAN.md` Task 2, nunca executado por nenhum executor até agora.

### 2. README de exportação é suficiente para o dono repetir a operação sozinho

**Test:** Seguindo só `apps/api/README.md` § "Exportar o ClickUp", rodar `npm run exportar:clickup -w @n1/api -- --so-manifesto` e depois `git status`.
**Expected:** O comando regenera o manifesto a partir do disco sem exigir nada além do que o README documenta; `git status` mostra no máximo os dois arquivos de manifesto e nada de `apps/api/exportacoes/clickup/`.
**Why human:** Harvested do `<human-check>` de `00-07-PLAN.md` Task 2 — prova de usabilidade do README, não reproduzível por grep. Este verificador optou por não rodar o comando para não sobrescrever `MANIFESTO.*` versionado por engano (risco já documentado em 00-04/00-05 SUMMARY: rodar sem `--pasta` grava sobre o manifesto real).

### 3. Conteúdo da spec valida contra o conhecimento de domínio do Financeiro

**Test:** Ler §3 (Status) e §4 (Campos) de `docs/07-processos/solicitacao-de-pagamento.md` contra a exportação bruta e confirmar que §12 reflete fielmente as 5 lacunas genuinamente abertas (L-01, L-03, L-07, L-09, L-11).
**Expected:** Nenhuma invenção de Status/Campo; as lacunas abertas são as que exigem conhecimento humano fora do sistema (ex.: como a Conta nasce da Solicitação hoje).
**Why human:** Verificação de conteúdo de documento — julgamento de domínio, não reproduzível por grep (`00-VALIDATION.md` Manual-Only). Este verificador conferiu estrutura, ausência de PII, presença das 12 seções e coerência interna (citações a ids reais, contagens que batem com o manifesto), mas isso não substitui a validação do dono/Financeiro sobre a exatidão do processo descrito.

## Gaps Summary

Nenhum gap bloqueante encontrado. Os cinco critérios de sucesso do ROADMAP (excluído o 4º por instrução explícita D-13) se sustentam na codebase com evidência direta: a spec existe no padrão exigido e fecha D6/D8; as três Listas estão exportadas, paginadas, e o manifesto de paridade está commitado sem PII; a tabela de de-para existe, é tipada e testada; o schema `plataforma` e a medição de volume já eram verdadeiros.

Duas ressalvas honestamente documentadas pelas próprias SUMMARYs (não escondidas) não bloqueiam o fechamento:
- 1 dos 6 e-mails do de-para (revisor FO, `81581802`) continua sem valor real, mas o código impede que essa entrada vire Membro por acidente, e o aceite formal do requisito ("não especificado além da tabela") está satisfeito.
- O manifesto trunca ids de anexo a 8 caracteres hex (CR-01 do code review) — degrada a precisão de comparação por anexo individual, mas não invalida a contagem/comparação agregada que o critério 2 exige, e não há colisão nos dados atuais.

O que falta para status `passed` é puramente humano: 3 verificações que nenhum comando pode substituir (comparação contra o ClickUp de produção, teste de usabilidade do README, e validação de domínio do conteúdo da spec pelo dono/Financeiro) — todas já documentadas como Manual-Only nas próprias plans/validation desta fase, nunca executadas por nenhum executor até agora.

---

_Verified: 2026-09-17_
_Verifier: Claude (gsd-verifier)_
