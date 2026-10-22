# Phase 9: Segurança dos dados e base de produção - Context

**Gathered:** 2026-10-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Fechar a segurança dos dados e montar a base de produção **antes de qualquer dado real de cliente entrar** (WhatsApp não oficial, Sessão 4 do plano em diante). A fase espelha a Sessão 1 de `docs/09-planejamento/TAREFAS-POR-SESSAO.md` (linhas 168 a 403), tarefa por tarefa, e **mais** o teste de invasão (1.8), que entrou por decisão do dono nesta conversa. Oito frentes, na ordem do documento:

1. **1.1 Recorte do `GET /estado` e do `POST /operacoes`** — sai o que é pessoal de outro Membro (Sessão de Chat, pasta de chat, Memória de Usuário, e-mail de convite, Visão pessoal) e os segredos de link público (`publicShare.secret`, `Form.secret`) de quem não administra a Lista; Convidado deixa de receber as coleções de IA (D-02).
2. **1.2 Escritas com conferência** — Membro `suspenso` recebe 403 em `POST /operacoes`; o CRM antigo e as duas operações soltas (`restoreList`, `createReceivableSeries`) passam a conferir quem chama; `packages/dominio/CONTEXT.md` ganha a tabela "Quem pode" cobrindo todo o `REGISTRO`.
3. **1.3 Banco fechado** — migração `009`, papel `n1_api` sem superusuário, migrações e backup em `DATABASE_URL_MIGRACAO`. **Sem RLS** (D-05).
4. **1.4 Cofre de credenciais** — `plataforma.credenciais`, AES-256-GCM, chave fora do banco.
5. **1.5 Logs sem segredo** — `apps/api` (`redact` + URL mascarada) e nginx (`map` + `log_format`).
6. **1.6 `limit_req` no nginx** para `/v1/public/` e `TRUST_PROXY` documentado.
7. **1.7 Ambientes, backup e monitoramento** — homologação com login e banco próprios, backup diário com restauração testada, Sentry na api e na web, servidor da Evolution API preparado.
8. **1.8 Teste de invasão** — suíte adversarial no `npm run check` + passada exploratória em homologação, com `09-PENTEST.md` (D-14 a D-16).

**Fora do escopo:** conectar provedor real; RLS por `workspace_id` (adiada, D-05); regra de visibilidade por registro para Documentos e Agentes (Sessão 17); superadmin e convite por e-mail (Sessão 12); LGPD de Contato (Sessão 19); remover o CRM antigo (Sessão 3).

**Escopo fixado pelo ROADMAP:** o conteúdo das tarefas 1.1 a 1.7 (o quê, onde no código, "Pronto quando") **não foi rediscutido** e vale como está no documento de tarefas. Este arquivo registra só as decisões do dono, as restrições novas e o que o documento deixou aberto.

</domain>

<decisions>
## Implementation Decisions

### O que o `GET /estado` esconde

- **D-01:** As tarefas 1.1.1, 1.1.2, 1.1.3, 1.1.5 e 1.1.6 entram **como escritas** em `TAREFAS-POR-SESSAO.md`: `membroVeSessaoDeChat`, `recortarRegistro`, `recortarDiferenca` em `packages/dominio/src/derive-visibilidade.ts`; mesmo recorte na resposta de `POST /operacoes` (inclusive no caminho de `SERVICOS`, onde `inviteMember` volta sem recorte); teste de vazamento de ponta a ponta com dois Membros reais em `apps/api/src/rotas/estado.test.ts`. A Administradores e Proprietários vale a mesma regra de Sessão de Chat (só o dono e quem recebeu compartilhada — DO-CHT-09): nem eles leem a Sessão de outro Membro.
- **D-02 (1.1.4, escolha A):** **Convidado não recebe `agents`, `automations`, `documents`, `collections` nem `skills`**; os demais Papéis recebem tudo, como hoje. O CRM antigo (`contacts`, `deals`, `conversations`) fica como está até a Sessão 3 removê-lo (Convidado continua lendo o CRM — Fase 7 D7-14). A regra fina por registro (dono, Equipe, compartilhamento) vai para a Sessão 17. Custo estimado: cerca de meio dia, só em `visibilidadePara`. — **Reversibility:** reversible — é filtro de leitura do servidor; voltar atrás é remover o filtro.
- **D-03:** **O assunto "IA" some do trilho do Convidado** e a rota `/ia/*` mostra "Sem acesso", do mesmo jeito que o assunto Financeiro já some pelo alcance (`assuntosVisiveis`, `apps/web/src/features/shell/app-shell.tsx`, perto da linha 365). Os Convidados que existem hoje (o Agente do pipeline e as Pessoas das contas) não usam IA pela tela. A Sessão 12 (permissões) pode reabrir. **Atenção à pesquisa:** conferir que nenhuma tela da Tarefa, do fio ou da timeline lê `agents`/`automations` para um Convidado (a Pessoa da conta vê a Tarefa dela); se ler, mostrar o nome de outro jeito, não devolver a coleção.

### Proteção do banco

- **D-04 (1.3.1, parte de banco já fechada):** A conferência de 22/10 (`09-NOTAS-DA-CONFERENCIA.md`) provou que `anon` e `authenticated` não têm `USAGE` em `plataforma`, não têm `SELECT` nas 21 tabelas, que a REST responde `PGRST106` e que não há `pg_default_acl` para o schema. A `009` torna isso **declarativo e reproduzível** (a homologação nasce de um projeto novo), não corrige uma brecha aberta.
- **D-05 (1.3.2, escolha A):** **Banco só fechado + `n1_api`; sem RLS nesta fase.** RLS por `workspace_id` fica registrada como **adiada pela decisão 12.1** (mais de uma empresa no sistema), não esquecida. Motivo medido: são 103 usos de `pool()` em cerca de 40 arquivos e vários caminhos consultam antes de saber o Espaço (rotas públicas de Formulário e Tarefa, credencial de serviço, outbox, agenda), então RLS pediria papel com bypass ou exceção de policy; e há 1 Espaço de Trabalho em produção hoje. — **Reversibility:** costly — adicionar RLS depois toca `executar` (`unidade-de-trabalho.ts`), os repositórios do CRM e cada um desses caminhos, para abrir toda transação com `set_config('app.workspace_id', …)`.
- **D-06:** **Conteúdo da `009`** (`apps/api/migracoes/009-seguranca-e-cofre.sql`): (a) `revoke all on schema plataforma from public, anon, authenticated`, `revoke all on all tables …`, `alter default privileges … revoke`; (b) bloco `do $$` que, **se o papel `n1_api` existir**, dá `usage` no schema e `select, insert, update, delete` nas tabelas (e o mesmo nos privilégios padrão); (c) a tabela `plataforma.credenciais` (D-17); (d) `alter function … set search_path = …` nas três funções `crm_toque_atualizado_em`, `crm_exige_admin_na_empresa` e `crm_confere_admin` (a 007 é imutável); (e) `revoke execute` em `public.rls_auto_enable()` para `anon`/`authenticated`/`public` — função de gatilho de evento do **Supabase**, no schema `public`: **só entra depois de testada na homologação**, e a pesquisa deve confirmar que ela existe num projeto novo e que a revogação não quebra o provisionamento do Supabase. — **Reversibility:** one-way — migração aplicada é imutável (D-DEC-10); correção é a `010`.
- **D-07:** **`DATABASE_URL_MIGRACAO` mora no `api.env`**, ao lado de `DATABASE_URL` (`n1_api`), como o plano diz. `migrar.cli.ts` usa `DATABASE_URL_MIGRACAO` quando existir e `DATABASE_URL` quando não; o backup (D-10) usa a mesma. **Risco residual registrado, aceito pelo dono:** `n1_api` protege contra falha de SQL e erro de código (não dá `drop table`, não lê o schema `auth` do Supabase), mas quem conseguir ler o `api.env` na VPS volta a ter o banco inteiro. — **Reversibility:** reversible — o endurecimento (credencial só no deploy + papel `n1_backup` de leitura) é aditivo e está nas ideias adiadas.

### Homologação, backup e quem faz o quê

- **D-08 (1.7.1, escolha A):** **Homologação é um segundo projeto Supabase**, na organização "N1", na mesma região de produção (`us-west-2`, decisão da Fase 2 / 02-15; trocar de região não é desta fase). Separa banco, Auth e Storage. É nele que a `009`, o `n1_api` e a restauração de backup são provados antes de produção. — **Reversibility:** costly — usuários, dados e arquivos de homologação ficam num projeto próprio; mudar para "outro `WORKSPACE_ID` no mesmo projeto" seria migrar.
- **D-09:** **Branch `homologacao`**: o `deploy-api.yml` ganha um job com `environment: homologacao` e segredos próprios (hoje só conhece `production`); serviço `n1-crm-api-hml` na VPS (`PORT=3021`, `/opt/n1-crm-hml`) e site nginx `crm-n1-api-hml.85.155.186.214.nip.io` com certificado próprio; a Vercel aponta as três `NEXT_PUBLIC_*` do ambiente **Preview** para a homologação (tarefa 1.7.2, como escrita).
- **D-10 (1.7.3):** **Backup diário cifrado vai para bucket S3-compatível** (Cloudflare R2 ou Backblaze B2), enviado pela VPS com `rclone`. `systemd timer` `n1-crm-backup`: `pg_dump --schema=plataforma` com `DATABASE_URL_MIGRACAO`, cifra com **chave pública (`age`)** — a chave **privada fica com o dono, nunca na VPS** —, expiração de 14 dias configurada **no bucket**, e a chave de acesso do bucket só de escrita. A restauração é testada na homologação e a data fica em `apps/api/deploy/CONTEXT.md`. A pesquisa deve também registrar o que o plano do Supabase já guarda (Database › Backups); o conector do claude.ai desta sessão está na organização errada (ver Ações do dono).
- **D-11:** **Claude entrega, dono executa.** O Claude escreve no repositório tudo o que dá (conf do nginx, unit do systemd e do timer, scripts, workflow de homologação, código de Sentry e cofre, runbook com comandos prontos). O dono executa na VPS compartilhada e nos painéis (Supabase, Sentry, bucket, Evolution) e cola a saída; **cada passo assim é um checkpoint `[BLOCKING]`**, no padrão das Fases 2, 5 e 8. O Claude **não** executa por SSH: a VPS é compartilhada com outros 8 projetos e está com o firewall desligado.
- **D-12 (1.7.5):** **A Evolution API roda em VPS nova, só para ela** (Docker com Postgres e Redis próprios, HTTPS, firewall ligado). A Fase 9 só a deixa respondendo por HTTPS e com a chave de API anotada para o cofre; **conectar números é a Sessão 4**. Descartadas: Docker na VPS compartilhada e reusar a Evolution do `automation/`.
- **D-13 (1.7.4, do plano, não rediscutido):** **Sentry** na api (`@sentry/node`, iniciado antes de `buildApp`, `captureException` no `setErrorHandler`) e na web (`@sentry/nextjs` pelo arquivo de instrumentação do Next 16 — **ler antes o guia em `node_modules/next/dist/docs/`**, ver `AGENTS.md`), com `beforeSend` que apaga corpo, cabeçalhos e a parte da URL com segredo, e regra de alerta por e-mail em produção e homologação. O dono viu o desenho (SaaS com scrub) ao fechar a área e não pediu mudança.

### Teste de invasão (tarefa 1.8, nova)

- **D-14:** **Entra na fase, com as duas camadas.** (1) **Suíte adversarial em `apps/api` por HTTP, dentro do `npm run check`**, como regressão (cerca de 1 dia): matriz Papel × rota (sem token, token adulterado ou expirado, Convidado, Membro, Administrador, `suspenso`); acesso a registro de outro Membro e de outro Espaço; enumeração e força bruta de segredo de link público; `X-Forwarded-For` forjado contra `TRUST_PROXY`; URL assinada de anexo de Tarefa que o Membro não alcança; corpo grande ou de tipo errado. (2) **Passada exploratória em homologação** (cerca de 0,5 dia), ao fim da fase, com relatório `09-PENTEST.md` por severidade. Só começa depois de 1.1, 1.2, 1.5, 1.6 e da homologação (1.7.2) prontas. O `/gsd-secure-phase 9` (mitigações do modelo de ameaças existem no código) e o teste de invasão (tentar quebrar por fora) se complementam.
- **D-15:** **Severidade que trava o fim da fase:** achado **crítico ou alto** precisa estar corrigido **e coberto pela suíte** para a Fase 9 fechar. **Médio e baixo** entram em `.planning/WINDOWS.md` como janela aberta e só saem corrigidos ou dispensados com motivo escrito (enquanto houver janela aberta, o `/gsd-ship` fica bloqueado).
- **D-16:** **Quem faz a passada exploratória:** o Claude, **só contra a homologação, nunca produção, sem carga contra a VPS compartilhada**, e **só depois de a autorização escrita do dono** (escopo, alvo, janela) estar registrada no topo de `09-PENTEST.md`. Dentro da política de testes de segurança do Supabase (<https://supabase.com/docs/guides/security/security-testing>): permitido testar o próprio projeto (Auth, banco, Storage); proibido negação de serviço, inundação de requisições e ataque a outros clientes; **scanner automatizado exige aviso prévio a `security@supabase.com`**. Não se ataca a infraestrutura do Supabase além da API do próprio projeto.

### Cofre, logs e nginx (do documento de tarefas, parâmetros travados)

- **D-17 (1.4):** `plataforma.credenciais` com `id`, `workspace_id`, `dono_tipo` (`canal` ou `integracao`), `dono_id`, `tipo`, `segredo_cifrado bytea`, `iv bytea`, `etiqueta bytea`, `versao_da_chave int`, `criado_em`, `atualizado_em`, `revogado_em`; índice único em (`workspace_id`, `dono_tipo`, `dono_id`, `tipo`) onde `revogado_em is null`. `apps/api/src/servicos/cofre.ts` com `guardarCredencial`/`lerCredencial`, **AES-256-GCM do `node:crypto`**, IV novo a cada gravação; chave em `COFRE_CHAVE` (32 bytes em base64) e `COFRE_CHAVE_VERSAO`, **cada ambiente com a sua**; nenhuma rota devolve o segredo. Chave fora do banco (não Supabase Vault): quem levar uma cópia do banco não leva os segredos. O backup contém só o texto cifrado, então **a `COFRE_CHAVE` precisa de cópia fora da VPS com o dono** (perder a chave perde as credenciais). — **Reversibility:** one-way — o formato das colunas vai na `009`; trocar o esquema de cifra é migrar credenciais.
- **D-18 (1.5):** `apps/api/src/observabilidade/log.ts` com `opcoesDoLogger()` (`LOG_LEVEL`, `redact` de `req.headers.authorization` e de `*.segredo`, `*.secret`, `*.token`, `*.senha`, censura "[oculto]", serializador de `req` que troca o segmento depois de `/v1/public/forms/` e `/v1/public/tasks/` por `***`); no nginx, um `map` sobre `$request_uri` e um `log_format` próprio. **A mudança do nginx vale na VPS à mão** (depois da primeira emissão do certificado o arquivo da VPS é a fonte; `preparar-vps.sh` não o reescreve).
- **D-19 (1.6):** `limit_req_zone … zone=n1_publico:10m rate=30r/m`, `location /v1/public/` com `burst=10 nodelay` e `limit_req_status 429`; o limite em memória (`limite-de-taxa.ts`) continua como segunda camada, com o comentário corrigido; `TRUST_PROXY` entra no `.env.example` com explicação (vazio em desenvolvimento, `loopback` atrás do nginx).

### Requisitos derivados (proposta; registrar em `REQUIREMENTS.md` ao planejar)

O ROADMAP deixou "Requirements: TBD (a derivar no discuss)". Derivação por tarefa:

| ID | Cobre | Critério |
|---|---|---|
| SEG-01 | 1.1.1–1.1.3, 1.1.5, 1.1.6 | Nenhum Membro recebe Sessão de Chat, pasta de chat, Memória de Usuário, Visão pessoal nem e-mail de convite de outro; quem não administra a Lista não recebe `publicShare.secret` nem `Form.secret`, nem por `GET /estado` nem por `POST /operacoes` |
| SEG-02 | 1.1.4, D-02, D-03 | Convidado não recebe as cinco coleções de IA; assunto IA some do trilho dele |
| SEG-03 | 1.2.1–1.2.4 | Suspenso recebe 403 em `POST /operacoes`; Convidado recebe `ok: false` em `trashContact`, `sendMessage`, `winDeal`, `restoreList`, `createReceivableSeries`; tabela "Quem pode" cobre todo o `REGISTRO` |
| SEG-04 | 1.3.1–1.3.4 | `has_schema_privilege('anon','plataforma','USAGE')` e o de `authenticated` são `false`; `009` aplicada em homologação e produção; `apps/api` em produção conecta como `n1_api`; `drop table plataforma.migracoes` por `n1_api` é recusado |
| SEG-05 | 1.4 | Credencial gravada aparece só cifrada no banco, lê de volta o mesmo valor, chave errada falha, nenhuma rota devolve o segredo |
| SEG-06 | 1.5 | `/v1/public/forms/<segredo>` não deixa o segredo no log do `apps/api` nem no do nginx |
| SEG-07 | 1.6 | 50 chamadas seguidas do mesmo IP a `/v1/public/forms/x` recebem `429` a partir de cerca da 40ª |
| SEG-08 | 1.7.1–1.7.2 | Homologação no ar com login e banco próprios; push na branch `homologacao` publica a api |
| SEG-09 | 1.7.3 | Restauração feita e anotada; `count(*)` de `plataforma.registros` em homologação bate com produção na hora do backup |
| SEG-10 | 1.7.4 | Erro forçado em homologação chega como alerta por e-mail em até 5 minutos |
| SEG-11 | 1.7.5 | Painel da Evolution responde por HTTPS e a chave de API está anotada para a Sessão 4 |
| SEG-12 | 1.8, D-14–D-16 | Suíte adversarial verde no `npm run check`; `09-PENTEST.md` com autorização, achados por severidade e nenhum crítico ou alto aberto |

### Claude's Discretion

- Forma exata de `membroVeSessaoDeChat`, `recortarRegistro` e `recortarDiferenca`, nomes de módulos e de testes, e como o recorte do `GET /estado` convive com a **projeção de Canais relacionais** da Fase 8 (D-11 da Fase 8: `acrescentarCanaisProjetados` roda antes de `visibilidadePara`) e com o contrato do outbox `automacao.notificar-canal.v1`.
- **Como o papel `n1_api` recebe grants quando é criado depois da `009`.** O bloco `if exists` só concede se o papel já existir no momento da migração, e o deploy aplica a `009` sozinho a cada merge na `main`. **Restrição de ordem:** o dono cria `n1_api` à mão em homologação **e** em produção **antes** do merge da `009`. O planejador deve ainda prever um caminho de recuperação que não seja editar a `009` aplicada (por exemplo, um script idempotente fora de `migracoes/`).
- Como provar `n1_api` no Postgres local dos testes (criar o papel no `beforeAll` ou ler de variável) e como os testes que pulam sem `DATABASE_URL` se comportam com a suíte adversarial.
- Texto das telas ("Sem acesso", "Só quem administra a Lista vê o link", "Convite pendente"), a remoção do número de Sessões de Chat do diálogo de remover Membro (a tela passa a contar zero com o recorte, 1.1.1) e o formato do `09-PENTEST.md`.
- Escolha entre Cloudflare R2 e Backblaze B2, e detalhes de `age` (formato de recipient, rotação), conforme o que o dono já tiver conta.
- Se o recorte do cofre precisa de rotação de chave (`versao_da_chave` já está no desenho) além de leitura por versão.

### Ações do dono (não são código; entram como checkpoints do plano)

- **Desligar "Allow new users to sign up"** (Authentication › Sign In / Providers) no projeto de produção e no de homologação. Hoje `GET /auth/v1/settings` responde `disable_signup: false`. Depois, repetir a leitura. Verificar na homologação que `npm run usuarios:criar` (ainda não commitado) segue funcionando com o cadastro desligado, já que ele cria o Usuário pela Admin API.
- **Criar o papel `n1_api`** à mão em cada banco (`create role n1_api login password '<senha forte>'`); a senha nunca entra em arquivo versionado.
- **Ligar "Leaked password protection"** (Authentication › Password security), se o plano do Supabase permitir.
- **Confirmar que o bucket `guias` é público de propósito** (provável vídeo do Guia do Financeiro) e que não há nada sensível nele.
- **Reconectar o conector do Supabase do claude.ai à organização "N1"** (`list_projects` deve trazer `epomplsskqpluxuujpxl`); hoje ele enxerga a organização "n1-tecnologia" (projeto `rede-social`). Só leitura (`execute_sql` com `select`, `get_advisors`); DDL passa por `npm run migrar`, nunca por `apply_migration`.
- **Conferir em Database › Backups** o que o plano do Supabase de produção guarda e por quantos dias.
- **Contas e máquinas novas:** projeto Supabase de homologação, conta no Cloudflare R2 ou Backblaze B2, conta Sentry, VPS da Evolution; guardar a **chave privada do `age`** e uma cópia da `COFRE_CHAVE` fora da VPS.
- **Pendência herdada (STATE.md, Plan 02-25):** as duas linhas `FINANCEIRO_TRIA_DATABASE_URL_LEITURA` com o superusuário `postgres` no `apps/api/.env` — só o dono consegue apagá-las; conferir.
- **Autorização escrita do teste de invasão** (D-16) antes da passada exploratória.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo da fase (fonte principal)
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` §"Sessão 1 · Segurança dos dados e base de produção" (linhas 168–403) — as tarefas 1.1 a 1.7 com "Hoje", "O que fazer" e "Pronto quando", arquivo e linha; **escopo fixado**, não repetido neste CONTEXT
- `docs/09-planejamento/PLANO-DE-IMPLEMENTACAO.md` — Sessão 1 e as sessões que dependem dela (4, 7, 8, 9, 12, 15, 19)
- `.planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-NOTAS-DA-CONFERENCIA.md` — conferência do projeto Supabase de 22/10 (o que está confirmado, o que está pendente com o dono, achados dos advisors, proposta do teste de invasão)
- `.planning/ROADMAP.md` (Phase 9), `.planning/WINDOWS.md` (janelas #6 e #7 abertas; bloqueiam `/gsd-ship`), `.planning/STATE.md`

### Camadas e regras
- `CONTEXT.md` (raiz) — mapa das camadas; web e api nunca dependem uma da outra; a `008` está aplicada e imutável, qualquer ajuste de schema é a `009`
- `AGENTS.md` — Next.js 16 difere do conhecido: ler `node_modules/next/dist/docs/` antes de codar (Sentry na web)
- `apps/api/src/persistencia/CONTEXT.md`, `apps/api/src/rotas/CONTEXT.md`, `apps/api/src/repositorios/CONTEXT.md`, `apps/api/src/servicos/CONTEXT.md`, `apps/api/src/observabilidade/CONTEXT.md`, `packages/dominio/CONTEXT.md` (ganha a tabela "Quem pode")

### Deploy e infraestrutura
- `apps/api/deploy/CONTEXT.md` — VPS compartilhada, serviço `n1-crm-api`, `api.env`, caminho de uma mudança, segredos do GitHub, como voltar uma versão
- `apps/api/deploy/nginx-n1-crm-api.conf`, `apps/api/deploy/n1-crm-api.service`, `apps/api/deploy/instalar-release.sh` (aplica migração sozinho a cada deploy), `apps/api/deploy/publicar.sh`, `apps/api/deploy/preparar-vps.sh`
- `.github/workflows/deploy-api.yml`, `.github/workflows/check.yml`
- `docs/08-migracao-financeiro/` — decisão de região e topologia da Fase 2 (02-15): `us-west-2`, pooler do Supabase, TLS verificado por `DATABASE_CA_CERT`/`DATABASE_CA_PATH`

### Código a mudar
- `packages/dominio/src/derive-visibilidade.ts` (`visibilidadePara`, `filtrarDiferenca`, `filtrarOrdens`, `membroVeArquivo`), `packages/dominio/src/derive.ts` (`containerAdminRefusal`, `memberSeesTask`), `packages/dominio/src/operations/registro.ts` (`REGISTRO`), `packages/dominio/src/crm/permissoes.ts` (`podeNoCrm`)
- `apps/api/src/rotas/estado.ts` (`GET /estado`, `GET /anexos/:fileId/url`), `apps/api/src/rotas/operacoes.ts`, `apps/api/src/plugins/autenticacao.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/src/persistencia/conexao.ts`, `apps/api/src/persistencia/migrar.cli.ts`, `apps/api/src/servicos/limite-de-taxa.ts`, `apps/api/src/persistencia/canais-projetados.ts`
- `apps/web/src/features/shell/app-shell.tsx` (trilho de assuntos, `isGuest`, `assuntosVisiveis`), `apps/web/src/app/(shell)/ia/chat/[sessao]/page.tsx`, `apps/web/src/app/(shell)/configuracoes/membros/page.tsx`
- `apps/api/.env.example` (ganha `DATABASE_URL_MIGRACAO`, `TRUST_PROXY`, `COFRE_CHAVE`, `COFRE_CHAVE_VERSAO`, `SENTRY_DSN`)

### Decisões herdadas
- `.planning/PROJECT.md` — D-DEC-08 (banco próprio), D-DEC-10 (migrações numeradas e imutáveis), D7-10/D7-14 (Papel e isolamento no backend), D7-12 (migração só após `--seco` e conferência)
- `.planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-CONTEXT.md` — D-11 (projeção de Canais em `GET /estado`, que o recorte não pode quebrar)
- `.planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-CONTEXT.md` — matriz de Papéis do CRM novo

### Externas
- <https://supabase.com/docs/guides/security/security-testing> — política de testes de segurança do Supabase (D-16)
- `ontologia/` — DO-CHT-09 (quem lê uma Sessão de Chat), B38 (privacidade de contêiner)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `visibilidadePara`, `filtrarDiferenca` e `filtrarOrdens` (`derive-visibilidade.ts`): o recorte da Estrutura já existe e devolve o conjunto `ocultos`; `recortarRegistro`/`recortarDiferenca` estendem o mesmo desenho.
- `containerAdminRefusal`, `memberSeesTask`, `memberReachesContainer`, `taskWriteRefusal`, `listWriteRefusal` (`derive.ts`, `tasks.ts`): as conferências a reaproveitar em 1.1.3 e 1.2.
- `podeNoCrm` (`crm/permissoes.ts`) e `exigir` (`servicos/crm/acesso.ts`): a regra de escrita do CRM novo, base de `recusaDeEscritaNoCrmAntigo` (1.2.2).
- `criarLimiteDeTaxa` (`servicos/limite-de-taxa.ts`), `construirSsl`/`carregarEnv`/`pool()` (`persistencia/conexao.ts`), `inicioDaTransacao` (`unidade-de-trabalho.ts`).
- `assuntosVisiveis` + `vePastaFinanceiro` (`app-shell.tsx`): o mesmo mecanismo esconde o assunto IA do Convidado (D-03).
- `usuarios:criar` (`apps/api/src/autenticacao/criar-usuario.cli.ts`, ainda não commitado): ponte de criação de Usuário e Membro ativo até o convite da Sessão 12.
- `storage:conferir`, `npm run migrar -- --seco`, `npm run bootstrap:gestao`: já existem para a homologação.

### Established Patterns
- Testes de `apps/api` pulam sem `DATABASE_URL`; migrações numeradas, imutáveis, conferidas com `--seco` antes de aplicar; `app.inject` + repositório contra Postgres local.
- Operações do domínio devolvem `OperationResult` (`ok: false`), nunca exceção; a recusa mora no domínio e a rota só traduz. A recusa de Membro `suspenso` em `POST /operacoes` é a exceção: mora na rota (403), porque vale para toda operação do registro.
- Deploy: PR → `check` → merge na `main` → `deploy-api` → `instalar-release.sh` (aplica migração e reinicia, com volta automática se `/saude` não responder em 40 s).
- Passos de operador com checkpoint `[BLOCKING]` e resultado colado pelo dono (Fases 2, 5, 8).

### Integration Points
- `estado.ts`: `acrescentarCanaisProjetados` roda **antes** de `visibilidadePara`; os Canais relacionais passam pelo mesmo recorte.
- `operacoes.ts` (perto da linha 252, depois de `ehNomeDeOperacao`): ponto do 403 de Membro suspenso; perto das linhas 364–365, `filtrarDiferenca` vira `recortarDiferenca`; o caminho `SERVICOS` (`convidarMembro`) hoje volta sem recorte.
- `plugins/autenticacao.ts` (perto da linha 85): deixa passar `ativo` e `suspenso` de propósito (o suspenso consulta).
- **Achado novo (pesquisar):** `GET /anexos/:fileId/url` deixa baixar, a qualquer um com sessão no Espaço, um Arquivo que **nenhuma Tarefa carrega** (ex.: envio público de Formulário ainda não convertido). Candidato a entrar no recorte de 1.1 ou à suíte adversarial (D-14).
- `app.ts` (perto da linha 106, `TRUST_PROXY`; da 137, `setErrorHandler`) e `index.ts` (perto da linha 97, `buildApp({ logger: true })`).
- Rotas REST da Fase 8 (`/canais`, `/conversas`, `/mensagens`) e do CRM: **conferir que recusam Membro `suspenso`** na escrita (o CRM novo já barra por `podeNoCrm`; as de Canal devem seguir a matriz da Fase 7).

</code_context>

<specifics>
## Specific Ideas

- "Cada passo que só o dono consegue é checkpoint, com o comando pronto e o lugar de colar a saída" — o runbook da fase segue o padrão dos planos 02-15 e 05-23.
- A explicação do RLS adiado precisa ficar escrita no CONTEXT.md do `apps/api/src/persistencia/`, com o gatilho (decisão 12.1) e a lista dos caminhos que consultam antes de saber o Espaço, para a Sessão 12 não redescobrir os 103 pontos.
- O relatório `09-PENTEST.md` abre com a autorização do dono e lista o que ficou fora do escopo; achado crítico ou alto vira teste na suíte antes de ser dado como corrigido.

</specifics>

<deferred>
## Deferred Ideas

- **RLS por `workspace_id`** — quando a decisão 12.1 (mais de uma empresa no sistema) for tomada; toca `executar`, os repositórios do CRM e os caminhos que consultam antes de saber o Espaço (rotas públicas, credencial de serviço, outbox, agenda)
- **Regra de visibilidade por registro para Documentos e Agentes** (dono, Equipe, compartilhamento) — Sessão 17 (Conhecimento indexado)
- **Credencial do dono do banco só no deploy**, fora do disco da VPS, com papel `n1_backup` só de leitura para o `pg_dump` — endurecimento aditivo sobre D-07
- **Pentester externo** antes da Sessão 4 (dados reais), depois da passada do Claude
- **Contagem de limite de taxa no banco** — só quando o `apps/api` rodar em mais de um processo (tarefa 1.6.1)
- **Superadmin e convite por e-mail** — Sessão 12 (o cadastro aberto é desligado agora; o Usuário nasce por `usuarios:criar` até lá)
- **Troca de região do Supabase** (`us-west-2` para `sa-east-1`) — fora desta fase (decisão da Fase 2)

### Reviewed Todos (not folded)
None — nenhum todo pendente casou com a fase.

</deferred>

---

*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Context gathered: 2026-10-22*
