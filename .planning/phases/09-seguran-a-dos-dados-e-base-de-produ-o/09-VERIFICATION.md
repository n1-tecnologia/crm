---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
verified: 2026-10-27T15:00:00Z
status: gaps_found
score: 5/12 must-haves verified
covered_files: [".github/workflows/check.yml",".github/workflows/deploy-api.yml",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-01-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-01-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-02-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-02-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-03-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-03-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-04-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-04-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-05-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-05-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-06-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-06-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-07-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-07-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-08-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-08-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-09-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-09-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-10-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-10-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-11-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-11-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-12-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-12-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-13-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-13-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-14-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-14-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-15-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-15-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-16-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-16-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-17-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-17-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-18-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-18-SUMMARY.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-19-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-20-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-21-PLAN.md",".planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-22-PLAN.md","apps/api/deploy/n1-crm-backup.sh","apps/api/deploy/n1-crm-limites.conf","apps/api/deploy/nginx-n1-crm-api.conf","apps/api/migracoes/009-seguranca-e-cofre.sql","apps/api/src/observabilidade/log.ts","apps/api/src/observabilidade/sentry.ts","apps/api/src/rotas/estado.ts","apps/api/src/rotas/operacoes.ts","apps/api/src/seguranca/matriz-de-papeis.test.ts","apps/api/src/servicos/cofre.ts","apps/web/src/instrumentation.ts","packages/dominio/src/derive-visibilidade.ts"]
covered_digest: "v3:sha256:ccdfcf5b4d4af13beb4664c3deefea4368b9b6a7e679df9b1edfe176f44204b9"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SEG-08: Homologação no ar com login e banco próprios; push na branch `homologacao` publica a api"
    status: failed
    reason: "09-17 foi pulado por decisão do dono (2026-10-23). Só existe o código no repositório (09-11: scripts por AMBIENTE, usuário n1crm-hml, job `homologacao` em deploy-api.yml). Não existe projeto Supabase de homologação, serviço n1-crm-api-hml, branch `homologacao` nem segredos do GitHub."
    artifacts:
      - path: ".github/workflows/deploy-api.yml"
        issue: "job `homologacao` escrito mas nunca disparou (a branch `homologacao` não existe no remoto)"
      - path: "apps/api/deploy/preparar-vps.sh"
        issue: "AMBIENTE=homologacao nunca executado na VPS"
    missing:
      - "Executar 09-17 (projeto Supabase de homologação, n1_api, serviço hml, segredos, Preview da Vercel)"
  - truth: "SEG-09: Backup diário cifrado (age) no bucket com chave só de escrita e expiração de 14 dias; restauração feita e anotada com count(*) igual ao de produção"
    status: failed
    reason: "09-18 foi pulado por decisão do dono (2026-10-27). O ciclo pg_dump -> age -> rclone -> restauração -> contagem só está provado em Docker, com `age` e `rclone` SUBSTITUÍDOS por stubs de teste (o stub do age apenas copia, não cifra). Nenhum bucket, timer na VPS, chave só de escrita ou restauração de dump real existe. Nenhum backup próprio de produção existe."
    artifacts:
      - path: "apps/api/deploy/provar-backup.sh"
        issue: "prova com stubs de age e rclone; `age` e `rclone` reais nem estão instalados nesta máquina; cifragem real nunca exercida"
      - path: "apps/api/deploy/n1-crm-backup.timer"
        issue: "nunca instalado na VPS"
    missing:
      - "Executar 09-18 (bucket B2 com ciclo de 14 dias e chave Write Only, age/rclone reais, timer na VPS, restauração no Mac do dono)"
      - "Decidir como o Storage e o schema auth do Supabase são cobertos (o dump é só --schema=plataforma)"
  - truth: "SEG-04: `009` aplicada em homologação e produção; o apps/api em produção conecta como `n1_api`; anon/authenticated sem USAGE em plataforma"
    status: partial
    reason: "Provado só em Postgres local (009 com e sem papéis do Supabase, n1_api sem DDL, drop table plataforma.migracoes recusado com 42501, recuperação idempotente via banco:conceder). Não aplicada em homologação nem em produção; D-06 (provar em homologação antes de produção) não pode ser cumprida sem o 09-17. O código desta fase nem foi enviado ao remoto."
    artifacts:
      - path: "apps/api/migracoes/009-seguranca-e-cofre.sql"
        issue: "irreversível depois de aplicada; segue sem prova no Supabase real (rls_auto_enable, entrada pelo Preview, cadastro aberto)"
    missing:
      - "09-17 (prova em homologação) e 09-20 (n1_api em produção, merge, aplicar a 009)"
  - truth: "SEG-06: o segredo de /v1/public/forms/<segredo> não fica nos logs do apps/api nem do nginx"
    status: partial
    reason: "apps/api: coberto por testes (log.test.ts, segredos-publicos.test.ts). nginx: provado em Docker (provar-nginx.sh, prova 3). A conf mascarada não está aplicada na VPS real (D-18: à mão), o que é passo do 09-20."
    artifacts:
      - path: "apps/api/deploy/n1-crm-limites.conf"
        issue: "não instalada na VPS"
    missing:
      - "09-20: aplicar o nginx à mão na VPS e conferir o log real"
  - truth: "SEG-10: Sentry na api e na web com scrub; erro forçado em homologação chega como alerta por e-mail em até 5 minutos"
    status: partial
    reason: "A metade de código está feita e testada (api: sentry.ts + ramo 500; web: instrumentation.ts, instrumentation-client.ts, global-error.tsx, limpar-evento.ts). A metade que define o requisito (alerta por e-mail em até 5 minutos em homologação) depende de 09-17 e 09-19 e não aconteceu: nenhum projeto Sentry, DSN nem regra de alerta foi criado."
    artifacts:
      - path: "apps/api/src/app.ts"
        issue: "rota GET /diagnostico/erro-de-prova existe (ligada só por ERRO_DE_PROVA_ATIVO=true); a retirada é tarefa do 09-22"
    missing:
      - "09-19 (projetos e regras no Sentry, prova do alerta) e 09-22 (retirar a rota de prova)"
  - truth: "SEG-11: painel da Evolution API responde por HTTPS na VPS nova e a chave de API está anotada"
    status: failed
    reason: "Só os arquivos no repositório (apps/api/deploy/evolution/*). Nenhuma VPS nova, HTTPS ou chave anotada. 09-19 não iniciado."
    artifacts:
      - path: "apps/api/deploy/evolution/docker-compose.yml"
        issue: "nunca executado"
    missing:
      - "09-19 (parte da Evolution)"
  - truth: "SEG-12: suíte adversarial verde no npm run check e no job `seguranca` do CI; 09-PENTEST.md com autorização do dono, achados por severidade e nenhum crítico ou alto aberto"
    status: partial
    reason: "A suíte adversarial está verde localmente (125 passam + 3 expected-fail, reproduzido por mim contra Postgres 16 como n1_api). O job `seguranca` existe em check.yml mas nunca rodou no GitHub (commits da fase não estão no remoto). 09-PENTEST.md NÃO existe, a autorização do dono não foi colhida, a passada exploratória não aconteceu (09-21 depende da homologação). Além disso há 3 lacunas de domínio conhecidas, sem plano de correção; `removeMember` é de gravidade alta."
    artifacts:
      - path: "packages/dominio/src/operations/members.ts"
        issue: "removeMember não confere quem chama: qualquer Membro, Convidado incluído, remove outro Membro (só o Proprietário é protegido) e escolhe o Sucessor que herda os registros. Marcado it.fails em matriz-de-papeis.test.ts."
      - path: "packages/dominio/src/operations/collaboration.ts"
        issue: "spawnNextOccurrence não confere quem chama nem o alcance da Tarefa (it.fails)"
      - path: "packages/dominio/src/operations/financeiro.ts"
        issue: "runLancamentoAgent não recusa Convidado nem Membro não ativo (it.fails em lacunas-do-dominio.test.ts)"
    missing:
      - "Plano de correção para removeMember (alta), spawnNextOccurrence (média) e runLancamentoAgent; o `it.fails` vira `it` no dia do conserto"
      - "09-21: autorização escrita, passada exploratória e 09-PENTEST.md"
deferred: []
---

# Phase 9: Segurança dos dados e base de produção — Relatório de Verificação

**Objetivo da fase:** fechar a segurança dos dados e montar a base de produção antes de qualquer dado real de cliente entrar (WhatsApp não oficial em diante), em sete frentes (1.1 recorte de `GET /estado` e `POST /operacoes`; 1.2 escritas com conferência; 1.3 banco fechado; 1.4 cofre; 1.5 logs sem segredo; 1.6 `limit_req`; 1.7 homologação, backup, Sentry e Evolution), mais o teste de invasão (1.8).
**Verificado em:** 2026-10-27
**Status:** gaps_found
**Re-verificação:** Não, verificação inicial.

## Veredito curto

A fase está **parcial por decisão do dono**: 16 dos 22 planos foram executados, 09-17 e 09-18 foram pulados e 09-19 a 09-22 não começaram. O objetivo da fase **não foi alcançado**: a metade que vive no repositório (recorte do servidor, conferência de quem chama, banco fechado, cofre, logs, nginx, suíte adversarial, Sentry) está presente, ligada e provada por testes que eu reproduzi. A metade que precisa de infraestrutura real (homologação, `009` e `n1_api` em produção, backup em produção, alerta do Sentry, Evolution API, teste de invasão) **não existe**. Nenhum código da fase chegou à `main` nem ao remoto, então **nada disto está em produção**.

Estado do git: a branch `feat/webhook-meta-instagram` está 104 commits à frente de `origin/main`, e nenhum commit da fase está em branch remota (`git branch -r --contains` vazio). `origin/main` tem só o webhook da Meta.

## Requisito por requisito

| ID | Veredito | O que está PROVADO | O que NÃO está |
|----|----------|--------------------|----------------|
| SEG-01 | VERIFICADO | Recorte no servidor (`recortarRegistro`, `recortarDiferenca`, `recortarValor`, `membroVeSessaoDeChat`) aplicado em `GET /estado` e nos dois ramos de `POST /operacoes` (incl. `SERVICOS`/`inviteMember` e `value`); Arquivo órfão dá 404. Testes de vazamento com dois Membros reais passam. | — |
| SEG-02 | VERIFICADO | Convidado recebe `agents`, `automations`, `documents`, `collections`, `skills` como `[]`; assunto IA some do trilho (`veAssuntoIa` ligado em `app-shell.tsx:369`); `/ia/layout.tsx` mostra "sem acesso". | — |
| SEG-03 | VERIFICADO (com ressalva) | Suspenso recebe 403 antes de validar e antes do banco; `restoreList`, `createReceivableSeries` e CRM antigo conferem quem chama; tabela "Quem pode" cobre o `REGISTRO` e é cobrada por teste. | A tabela registra honestamente 3 operações como LACUNA/conferência fraca (ver SEG-12). |
| SEG-04 | PARCIAL (só local) | `009` + `n1_api` + `banco:conceder` provados em Postgres local; `drop table plataforma.migracoes` por `n1_api` dá `42501`. | Nada em homologação/produção; D-06 sem cumprir. |
| SEG-05 | VERIFICADO | AES-256-GCM com IV novo e AAD amarrado ao dono; chave errada, linha copiada para outro dono e etiqueta/texto adulterados lançam; só cifrado no banco; teste garante que nenhum arquivo de `rotas/` importa o cofre. | Sem consumidor em produção ainda (esperado: é infra das Sessões 4/7/8/9); `COFRE_CHAVE` de cada ambiente é ação do dono. |
| SEG-06 | PARCIAL | Log do `apps/api` mascarado (testes); nginx sem segredo no `access_log`/`error_log` e saída do contêiner (Docker). | Conf não aplicada na VPS real (09-20). |
| SEG-07 | VERIFICADO (em Docker, como o critério exige) | `provar-nginx.sh` rodado por mim: 39 de 50 POST com 429, o primeiro na chamada 12; 50 GET sem nenhum 429; `TRUST_PROXY` documentado em `.env.example`. | Repetição na VPS é passo do 09-20. |
| SEG-08 | NÃO CUMPRIDO | Só o código do repositório (09-11). | Todo o ambiente (09-17 pulado). |
| SEG-09 | NÃO CUMPRIDO em produção / PARCIAL (só Docker) | Pipe, contagem antes/depois, recusa de `pg_dump` mais velho, divergência detectada: 6 provas OK (rodei `provar-backup.sh`). | `age` e `rclone` são stubs na prova (nada é cifrado de verdade); sem bucket, chave só de escrita, expiração, timer ou restauração de dump real (09-18 pulado). |
| SEG-10 | PARCIAL (código) / NÃO CUMPRIDO (alerta) | Scrub na api e na web com testes (web: 16 testes; api: `sentry.test.ts`); `withSentryConfig` sem rede. | Alerta por e-mail em ≤ 5 min em homologação: nunca provado; sem DSN. |
| SEG-11 | NÃO CUMPRIDO | Arquivos da Evolution no repositório. | VPS, HTTPS, chave anotada (09-19). |
| SEG-12 | PARCIAL / NÃO CUMPRIDO | Suíte adversarial verde (reproduzida). | `09-PENTEST.md` inexistente; sem autorização, sem passada; job `seguranca` nunca rodou no GitHub; 3 lacunas de domínio abertas. |

## Verdades observáveis

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | SEG-01: nenhum Membro recebe Sessão de Chat, pasta, Memória, Visão pessoal, e-mail de convite de outro; segredos de link só para quem administra a Lista, em `GET /estado` e `POST /operacoes` | ✓ VERIFIED | `packages/dominio/src/derive-visibilidade.ts` (recortarRegistro/Diferenca/Valor, 316 linhas, sem atalho "nada oculto"); `rotas/operacoes.ts:377-389` chama `visibilidadePara` uma vez e recorta `diferenca` e `value`; `rotas/estado.ts:46`. `estado.test.ts` 13 passam (incl. vazamento e Arquivo órfão), `dados-de-outro-membro.test.ts` 15 passam |
| 2 | SEG-02: Convidado sem as cinco coleções de IA; IA some do trilho; `/ia/*` "Sem acesso" | ✓ VERIFIED | `derive-visibilidade.ts:163-173`; `assuntos-do-trilho.ts`; `app-shell.tsx:369`; `ia/layout.tsx`. Testes web de shell/link público: 32 passam |
| 3 | SEG-03: suspenso 403; Convidado `ok:false` nas cinco operações; "Quem pode" cobre o REGISTRO | ✓ VERIFIED | `operacoes.ts:262-264`; `tasks.ts:817-825` (`restoreList`), `financeiro.ts:1807-1812` (`createReceivableSeries`); `quem-pode.test.ts` passa; `inventario-de-rotas.test.ts` 7 passam; `operacoes/` do domínio 1066 passam |
| 4 | SEG-04: schema fechado, `009` aplicada em homologação e produção, api como `n1_api` em produção | ✗ PARTIAL | Só local (`banco-n1-api.test.ts`, 5 passam como `n1_api`); nada em Supabase real |
| 5 | SEG-05: cofre cifrado, chave fora do banco, nenhuma rota devolve o segredo | ✓ VERIFIED | `cofre.ts` (`aes-256-gcm`, `setAAD`); `cofre.test.ts` 18 passam (incl. banco real e "nenhum arquivo de rotas/ importa servicos/cofre") |
| 6 | SEG-06: segredo fora dos logs do api e do nginx | ✗ PARTIAL | api e Docker provados; VPS não |
| 7 | SEG-07: 50 POST, ≥ 30 com 429, primeiro entre 11 e 20; GET com teto próprio; `TRUST_PROXY` documentado | ✓ VERIFIED | `provar-nginx.sh` executado por mim; `n1-crm-limites.conf` (30r/m burst 10 POST; 120r/m burst 60 GET); `apps/api/.env.example:47` |
| 8 | SEG-08: homologação no ar | ✗ FAILED | 09-17 pulado |
| 9 | SEG-09: backup cifrado em bucket, restauração anotada | ✗ FAILED | 09-18 pulado; Docker com stubs |
| 10 | SEG-10: Sentry com scrub e alerta em ≤ 5 min | ✗ PARTIAL | código sim; alerta não |
| 11 | SEG-11: Evolution em HTTPS | ✗ FAILED | não iniciado |
| 12 | SEG-12: suíte verde + `09-PENTEST.md` sem crítico/alto | ✗ PARTIAL | suíte sim; relatório e passada não; lacuna alta aberta |

**Score:** 5/12 verdades verificadas (0 presentes com comportamento não verificado).

### Itens adiados (Etapa 9b)

Nenhum. Os requisitos não cumpridos são da própria Fase 9 (planos 09-17 a 09-22, dependentes de ação do dono); a Fase 9 é a última do marco corrente que cobre SEG, e nenhuma fase posterior os assume. Por isso nada foi movido para `deferred`.

## Artefatos obrigatórios

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `packages/dominio/src/derive-visibilidade.ts` | recorte completo | ✓ VERIFIED | substancial, ligado em `estado.ts` e `operacoes.ts` |
| `apps/api/migracoes/009-seguranca-e-cofre.sql` | banco fechado + cofre | ✓ VERIFIED (local) | aplicada por mim em Postgres 16 limpo, com `n1_api` criado antes |
| `apps/api/src/persistencia/conceder-n1-api.*` + `deploy/conceder-n1-api.sql` | recuperação idempotente | ✓ VERIFIED | `banco:conceder` rodou; teste (b) cobre papel criado depois |
| `apps/api/src/servicos/cofre.ts` | cofre AES-256-GCM | ✓ VERIFIED | |
| `apps/api/src/observabilidade/log.ts`, `sentry.ts` | log e Sentry sem segredo | ✓ VERIFIED | |
| `apps/api/deploy/n1-crm-limites.conf`, `nginx-n1-crm-api.conf` | limite e máscara | ✓ VERIFIED (Docker) | |
| `apps/api/deploy/n1-crm-backup.{sh,service,timer}`, `restaurar-backup.sh`, `instalar-backup.sh` | backup | ⚠️ ORPHANED | existem, nunca instalados |
| `apps/api/deploy/evolution/*` | Evolution | ⚠️ ORPHANED | existem, nunca executados |
| `apps/web/src/instrumentation*.ts`, `global-error.tsx`, `next.config.ts` | Sentry web | ✓ VERIFIED (código) | sem DSN configurado |
| `.github/workflows/check.yml` job `seguranca` | regressão no CI | ⚠️ ORPHANED | escrito, nunca rodou no GitHub |
| `.github/workflows/deploy-api.yml` job `homologacao` | deploy de homologação | ⚠️ ORPHANED | branch `homologacao` não existe |
| `09-PROVAS.md`, `09-PENTEST.md` | provas de infraestrutura e relatório | ✗ MISSING | não criados (esperado: 09-18..09-22) |

## Verificações comportamentais e sondas (reproduzidas por mim)

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Suíte do job `seguranca` (como `n1_api`, Postgres 16 descartável em Docker, `009` + `banco:conceder`) | `npx vitest run src/seguranca src/servicos/cofre.test.ts src/rotas/estado.test.ts` | 11 arquivos, 125 passam + 3 expected-fail, 0 pulados, 0 falhas | ✓ PASS |
| Domínio: recorte e Quem pode | `npx vitest run src/derive-visibilidade.test.ts src/quem-pode.test.ts` | 37 passam | ✓ PASS |
| Domínio: operações | `npx vitest run src/operations/` | 74 arquivos, 1066 passam | ✓ PASS |
| Web: shell, link público, share | `npx vitest run src/features/shell src/features/estrutura/link-publico src/features/estrutura/share-task` | 32 passam | ✓ PASS |
| Web: Sentry | `npx vitest run src/features/observabilidade src/app/global-error.test.tsx` | 16 passam | ✓ PASS |
| Api: suspenso, operações, observabilidade, e2e de Canais, persistência (como `n1_api`) | `npx vitest run src/rotas/operacoes*.test.ts src/observabilidade src/e2e/canais-fluxo.test.ts src/persistencia` | 184 passam, 3 falham (ver abaixo) | ✓ PASS (com nota) |
| Typecheck da api | `npx tsc --noEmit` | sem erro | ✓ PASS |

As 3 falhas desse último lote são **de ambiente de teste, não da fase**: 2 testes (`canais-projetados.test.ts`, `migrar-seco.test.ts`) executam `create database` e `n1_api` não tem esse privilégio (rodei como `n1_api` de propósito, para imitar o CI); 1 teste (`colunas-geradas.test.ts`) depende do plano do otimizador do Postgres escolher outro índice. Nenhum deles faz parte do job `seguranca`. O caso (e) de `canais-fluxo.test.ts`, que o `deferred-items.md` registrava como 500 por `userMemory` ausente, **passa**: o conserto `4aec7b7` está no código (`recortarMembro` tolera Membro sem `userMemory`). Esse item adiado está resolvido.

### Execução de sondas (Etapa 7c)

| Sonda | Comando | Resultado | Status |
|-------|---------|-----------|--------|
| `apps/api/deploy/provar-nginx.sh` | `bash apps/api/deploy/provar-nginx.sh` | `nginx -t` OK; POST 39/50 com 429, primeiro na 12ª; GET 50 sem 429; nenhum log guarda o segredo | PASS |
| `apps/api/deploy/provar-backup.sh` | `bash apps/api/deploy/provar-backup.sh` | 6 provas OK (dump mais velho recusado; contagem antes=3/depois=3; restauração OK; contagem adulterada diverge). **`age` e `rclone` são stubs** | PASS (escopo limitado, ver SEG-09) |

Os contêineres e a pasta temporária das sondas saíram sozinhos; o Postgres descartável que subi (`n1-verif-pg0901`) foi removido ao fim. Nenhum arquivo `.env` foi lido por mim; o `carregarEnv()` do próprio código de teste o lê, mas com `DATABASE_URL`/`DATABASE_URL_MIGRACAO` definidas na linha de comando apontando para `localhost`, e os testes recusam banco remoto por desenho (`banco-crm.ts`).

## Ligações-chave

| De | Para | Via | Status |
|----|------|-----|--------|
| `rotas/estado.ts` | `derive-visibilidade.ts` | `visibilidadePara` | ✓ WIRED |
| `rotas/operacoes.ts` (dois ramos, incl. `SERVICOS`) | `recortarDiferenca`/`recortarValor` | um único `visibilidadePara` sobre o estado depois | ✓ WIRED |
| `rotas/operacoes.ts` | 403 do suspenso | `recusaDeSuspenso` antes de validar | ✓ WIRED |
| `app-shell.tsx` | `veAssuntoIa` | filtro do trilho | ✓ WIRED |
| `instalar-release.sh` | `migrar` + `banco:conceder` | a cada deploy | ✓ WIRED (nunca executado em VPS) |
| `app.ts` ramo 500 | `capturarErroNoSentry` | `setErrorHandler` | ✓ WIRED |
| `index.ts` | `iniciarSentry`/`fecharSentry` | boot e desligamento | ✓ WIRED |
| Cofre | qualquer consumidor de produto | — | ⚠️ sem consumidor (esperado nesta fase) |

## Cobertura de requisitos

Todos os 12 IDs (SEG-01..SEG-12) aparecem nos planos; nenhum órfão. `REQUIREMENTS.md` marca SEG-01, 02, 03 e 05 como `[x]` e os demais como pendentes, o que **bate** com o que verifiquei, exceto por duas observações: SEG-07 está `[ ]` mas o critério ("em Docker") está cumprido e provado (o que falta é só repetir na VPS, no 09-20), e SEG-03 está `[x]` com 2 lacunas de domínio fora do seu texto literal (`removeMember`, `spawnNextOccurrence`) que pertencem ao espírito de SEG-12.

## Decisões do dono (09-CONTEXT) honradas?

| Decisão | Situação |
|---------|----------|
| D-01/D-22 (recorte, `agentExecutions` de Sessão, o que fica fora) | Honrada |
| D-02/D-03 (Convidado sem IA, trilho, `/ia/*`) | Honrada |
| D-05 (sem RLS, `009` desliga RLS, explicação em `persistencia/CONTEXT.md`) | Honrada |
| D-06 (`009` só em produção depois de provada em homologação) | **Não cumprível** sem o 09-17 (e o 09-20 repete a pré-condição) |
| D-07 (`DATABASE_URL_MIGRACAO`) | Honrada no código (`migrar`, `banco:conceder`, backup) |
| D-10 (backup cifrado em bucket, chave privada só com o dono) | Honrada no desenho; nada executado |
| D-11 (Claude entrega, dono executa; sem SSH) | Honrada (os passos do dono ficaram pendentes, não improvisados) |
| D-14/D-15 (suíte + `09-PENTEST.md`; crítico/alto trava a fase) | Suíte feita; relatório ausente; **há lacuna alta aberta (`removeMember`)** |
| D-20 (limit_req só POST por IP, GET com zona própria) | Honrada |

## Anti-padrões encontrados

Varredura em 116 arquivos de `apps/`, `packages/` e `.github/` alterados em relação a `origin/main`: **nenhum `TBD`/`FIXME`/`XXX`**. Os casos de "TODO" que o `grep` achou são a palavra portuguesa "todo" (= inteiro), não marcador de dívida. Nenhum stub de renderização encontrado nos arquivos da fase.

| Arquivo | Padrão | Severidade | Impacto |
|---------|--------|------------|---------|
| `apps/api/src/app.ts:235` | rota `GET /diagnostico/erro-de-prova` atrás de `ERRO_DE_PROVA_ATIVO` | ℹ️ Info | desligada por padrão; precisa ser retirada no 09-22 |
| `apps/api/deploy/provar-backup.sh` | substitutos de `age` e `rclone` | ⚠️ Warning | a prova de "cifrado" é só de encanamento, não de cifra real |
| `package-lock.json` (`@sentry/cli` 2.58.6) | `hasInstallScript`, `postinstall` baixa binário | ⚠️ Warning | já sabido; instalação passa a fazer rede no `npm ci` da web (CI e Vercel). Veio por `@sentry/nextjs` e todas as 111 entradas novas são de `registry.npmjs.org` (09-16-SUMMARY) |

## Lacunas de segurança de domínio conhecidas (confirmadas no código)

| Operação | Código | Efeito real | Gravidade |
|----------|--------|-------------|-----------|
| `removeMember` | `members.ts:217` não usa `actingMemberId` | qualquer Membro, Convidado incluído, remove outro (menos o Proprietário) e escolhe o Sucessor que herda Contatos, Empresas, Negócios, Agentes etc. | **Alta** (escalada de privilégio e perda de dados; pela D-15 trava o fechamento da fase) |
| `spawnNextOccurrence` | `collaboration.ts` | cria a próxima ocorrência de qualquer Tarefa recorrente já concluída, mesmo para Convidado e sem alcance | Média |
| `runLancamentoAgent` | `financeiro.ts` | Convidado dispara o Agente de lançamento (mediu `ok: true` com Comentário gravado) | Média |

Todas têm teste `it.fails` com a asserção correta (3 `expected fail` na minha execução) e linha "LACUNA" na tabela "Quem pode". **Nenhum plano (09-19..09-22 incluídos) as corrige**; o 09-21 só trataria achados do teste de invasão. Para a fase fechar sob D-15 é preciso um plano novo (pelo menos para `removeMember`).

## Verificação humana necessária

Estes itens dependem de ação do dono e hoje não têm evidência alguma. Eles não alteram o status (já é `gaps_found`), servem como lista de saída.

1. **Homologação (SEG-08):** criar o projeto Supabase de homologação, o papel `n1_api`, o serviço `n1-crm-api-hml`, os segredos do GitHub e as variáveis do Preview; empurrar a branch `homologacao`. Esperado: `/saude` responde na URL de homologação e login funciona com usuário próprio.
2. **`009` provada no Supabase real (SEG-04):** `has_schema_privilege('anon'/'authenticated','plataforma','USAGE')` é `false`; RLS desligada nas tabelas; `drop table` recusado ao `n1_api`; cadastro aberto desligado.
3. **Backup em produção (SEG-09):** bucket com ciclo de 14 dias e chave só de escrita, `age`/`rclone` reais, timer instalado, `rclone lsf` com a chave da VPS falha, restauração no Mac do dono com `count(*)` igual.
4. **Sentry (SEG-10):** erro forçado em homologação chega por e-mail em até 5 minutos.
5. **Evolution API (SEG-11):** painel por HTTPS na VPS nova e chave anotada.
6. **Nginx na VPS (SEG-06/07):** aplicar `n1-crm-limites.conf` e o site à mão e repetir a prova com o segredo no log real.
7. **Teste de invasão (SEG-12):** autorização escrita do dono em `09-PENTEST.md`, passada exploratória só em homologação.

## Resumo das lacunas

**Raiz 1 — infraestrutura nunca montada (SEG-08, 09, 10, 11, parte de 04/06):** tudo que a fase prometia fora do repositório depende dos planos 09-17..09-22. O código que prepara cada passo existe e foi provado onde dava (Postgres local, nginx e backup em Docker), mas nada rodou em Supabase, VPS, bucket ou Sentry.

**Raiz 2 — suíte adversarial sem fechamento (SEG-12):** a regressão está verde, mas a fase só fecha com `09-PENTEST.md` e nenhum crítico/alto aberto, e há uma lacuna alta (`removeMember`) sem plano.

**Riscos que o orquestrador deve ter em mente antes de qualquer merge:**
- O deploy de produção aplica as migrações sozinho a cada merge na `main` (`instalar-release.sh`, `migrar` + `banco:conceder`). Mergear a branch hoje aplicaria a `009` (irreversível; correção seria a `010`) sem homologação (D-06 não cumprida) e sem backup próprio de produção (09-18 pulado). O 09-20 prevê que o dono crie `n1_api` em produção antes do merge; sem isso a `009` passa sem conceder nada e o recuperador `banco:conceder` roda no mesmo deploy.
- `/gsd-ship` segue bloqueado enquanto `.planning/WINDOWS.md` tiver janela aberta.
- Dados reais de cliente (Sessão 4 em diante) **não devem entrar** enquanto SEG-04, 08, 09 e a lacuna `removeMember` estiverem abertos.

---

_Verificado: 2026-10-27_
_Verificador: Claude (gsd-verifier)_
