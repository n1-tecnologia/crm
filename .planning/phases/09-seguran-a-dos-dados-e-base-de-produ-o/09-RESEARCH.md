# Phase 9: Segurança dos dados e base de produção - Research

**Researched:** 2026-10-22
**Domain:** segurança de dados em API Fastify + Postgres/Supabase (recorte de leitura, papel de banco, cofre, logs, nginx), ambientes/backup/monitoramento de uma VPS compartilhada, teste de invasão automatizado
**Confidence:** HIGH para tudo que é código do repositório (lido nesta sessão); MEDIUM para Sentry v11, nginx e Supabase (docs oficiais + experimento local); LOW para Evolution API e para o comportamento de `rclone` com chave só de escrita (marcados `[ASSUMED]`)

## Project Constraints (from CLAUDE.md)

- `CLAUDE.md` inclui `CONTEXT.md` (mapa das camadas) e `AGENTS.md`. Diretrizes que valem aqui:
  - `packages/dominio/` não depende de ninguém; `apps/web` e `apps/api` dependem do domínio e **nunca um do outro**. Um helper compartilhado entre os dois lados (ex.: máscara de segredo em URL) mora no domínio, não em `web` importando `api`.
  - Mudou **o que a coisa é** → domínio; **como aparece** → web; **como se guarda ou se serve** → api. Quando for "as três", começar pelo domínio.
  - A `008` está aplicada e é imutável; todo ajuste de schema é a `009` (e a `009`, depois de aplicada, também é imutável: correção é a `010`).
  - `AGENTS.md`: este Next.js (16.3.4) difere do conhecido; **ler `node_modules/next/dist/docs/` antes de escrever código** (feito para Sentry/instrumentação, ver R2).
  - Comandos da raiz: `npm run check` (tipos, lint, tokens, contratos e testes dos três workspaces), `npm run test`, `npm run migrar -w @n1/api -- --seco`.
  - Código, comentários e docs do repositório em português.
- Memória do projeto: `execute-phase` roda sequencial aqui (re-forçar o sentinel de isolamento antes de cada `Agent()`); backlog do CRM N1 acumulado pelo usuário; o conector Supabase do claude.ai está na organização errada e é só leitura.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**O que o `GET /estado` esconde**

- **D-01:** As tarefas 1.1.1, 1.1.2, 1.1.3, 1.1.5 e 1.1.6 entram **como escritas** em `TAREFAS-POR-SESSAO.md`: `membroVeSessaoDeChat`, `recortarRegistro`, `recortarDiferenca` em `packages/dominio/src/derive-visibilidade.ts`; mesmo recorte na resposta de `POST /operacoes` (inclusive no caminho de `SERVICOS`, onde `inviteMember` volta sem recorte); teste de vazamento de ponta a ponta com dois Membros reais em `apps/api/src/rotas/estado.test.ts`. A Administradores e Proprietários vale a mesma regra de Sessão de Chat (só o dono e quem recebeu compartilhada — DO-CHT-09): nem eles leem a Sessão de outro Membro.
- **D-02 (1.1.4, escolha A):** **Convidado não recebe `agents`, `automations`, `documents`, `collections` nem `skills`**; os demais Papéis recebem tudo, como hoje. O CRM antigo (`contacts`, `deals`, `conversations`) fica como está até a Sessão 3 removê-lo (Convidado continua lendo o CRM — Fase 7 D7-14). A regra fina por registro (dono, Equipe, compartilhamento) vai para a Sessão 17. Custo estimado: cerca de meio dia, só em `visibilidadePara`. — **Reversibility:** reversible — é filtro de leitura do servidor; voltar atrás é remover o filtro.
- **D-03:** **O assunto "IA" some do trilho do Convidado** e a rota `/ia/*` mostra "Sem acesso", do mesmo jeito que o assunto Financeiro já some pelo alcance (`assuntosVisiveis`, `apps/web/src/features/shell/app-shell.tsx`, perto da linha 365). Os Convidados que existem hoje (o Agente do pipeline e as Pessoas das contas) não usam IA pela tela. A Sessão 12 (permissões) pode reabrir. **Atenção à pesquisa:** conferir que nenhuma tela da Tarefa, do fio ou da timeline lê `agents`/`automations` para um Convidado (a Pessoa da conta vê a Tarefa dela); se ler, mostrar o nome de outro jeito, não devolver a coleção.

**Proteção do banco**

- **D-04 (1.3.1, parte de banco já fechada):** A conferência de 22/10 (`09-NOTAS-DA-CONFERENCIA.md`) provou que `anon` e `authenticated` não têm `USAGE` em `plataforma`, não têm `SELECT` nas 21 tabelas, que a REST responde `PGRST106` e que não há `pg_default_acl` para o schema. A `009` torna isso **declarativo e reproduzível** (a homologação nasce de um projeto novo), não corrige uma brecha aberta.
- **D-05 (1.3.2, escolha A):** **Banco só fechado + `n1_api`; sem RLS nesta fase.** RLS por `workspace_id` fica registrada como **adiada pela decisão 12.1** (mais de uma empresa no sistema), não esquecida. Motivo medido: são 103 usos de `pool()` em cerca de 40 arquivos e vários caminhos consultam antes de saber o Espaço (rotas públicas de Formulário e Tarefa, credencial de serviço, outbox, agenda), então RLS pediria papel com bypass ou exceção de policy; e há 1 Espaço de Trabalho em produção hoje. — **Reversibility:** costly — adicionar RLS depois toca `executar` (`unidade-de-trabalho.ts`), os repositórios do CRM e cada um desses caminhos, para abrir toda transação com `set_config('app.workspace_id', …)`.
- **D-06:** **Conteúdo da `009`** (`apps/api/migracoes/009-seguranca-e-cofre.sql`): (a) `revoke all on schema plataforma from public, anon, authenticated`, `revoke all on all tables …`, `alter default privileges … revoke`; (b) bloco `do $$` que, **se o papel `n1_api` existir**, dá `usage` no schema e `select, insert, update, delete` nas tabelas (e o mesmo nos privilégios padrão); (c) a tabela `plataforma.credenciais` (D-17); (d) `alter function … set search_path = …` nas três funções `crm_toque_atualizado_em`, `crm_exige_admin_na_empresa` e `crm_confere_admin` (a 007 é imutável); (e) `revoke execute` em `public.rls_auto_enable()` para `anon`/`authenticated`/`public` — função de gatilho de evento do **Supabase**, no schema `public`: **só entra depois de testada na homologação**, e a pesquisa deve confirmar que ela existe num projeto novo e que a revogação não quebra o provisionamento do Supabase. — **Reversibility:** one-way — migração aplicada é imutável (D-DEC-10); correção é a `010`.
- **D-07:** **`DATABASE_URL_MIGRACAO` mora no `api.env`**, ao lado de `DATABASE_URL` (`n1_api`), como o plano diz. `migrar.cli.ts` usa `DATABASE_URL_MIGRACAO` quando existir e `DATABASE_URL` quando não; o backup (D-10) usa a mesma. **Risco residual registrado, aceito pelo dono:** `n1_api` protege contra falha de SQL e erro de código (não dá `drop table`, não lê o schema `auth` do Supabase), mas quem conseguir ler o `api.env` na VPS volta a ter o banco inteiro. — **Reversibility:** reversible — o endurecimento (credencial só no deploy + papel `n1_backup` de leitura) é aditivo e está nas ideias adiadas.

**Homologação, backup e quem faz o quê**

- **D-08 (1.7.1, escolha A):** **Homologação é um segundo projeto Supabase**, na organização "N1", na mesma região de produção (`us-west-2`, decisão da Fase 2 / 02-15; trocar de região não é desta fase). Separa banco, Auth e Storage. É nele que a `009`, o `n1_api` e a restauração de backup são provados antes de produção. — **Reversibility:** costly — usuários, dados e arquivos de homologação ficam num projeto próprio; mudar para "outro `WORKSPACE_ID` no mesmo projeto" seria migrar.
- **D-09:** **Branch `homologacao`**: o `deploy-api.yml` ganha um job com `environment: homologacao` e segredos próprios (hoje só conhece `production`); serviço `n1-crm-api-hml` na VPS (`PORT=3021`, `/opt/n1-crm-hml`) e site nginx `crm-n1-api-hml.85.155.186.214.nip.io` com certificado próprio; a Vercel aponta as três `NEXT_PUBLIC_*` do ambiente **Preview** para a homologação (tarefa 1.7.2, como escrita).
- **D-10 (1.7.3):** **Backup diário cifrado vai para bucket S3-compatível** (Cloudflare R2 ou Backblaze B2), enviado pela VPS com `rclone`. `systemd timer` `n1-crm-backup`: `pg_dump --schema=plataforma` com `DATABASE_URL_MIGRACAO`, cifra com **chave pública (`age`)** — a chave **privada fica com o dono, nunca na VPS** —, expiração de 14 dias configurada **no bucket**, e a chave de acesso do bucket só de escrita. A restauração é testada na homologação e a data fica em `apps/api/deploy/CONTEXT.md`. A pesquisa deve também registrar o que o plano do Supabase já guarda (Database › Backups); o conector do claude.ai desta sessão está na organização errada (ver Ações do dono).
- **D-11:** **Claude entrega, dono executa.** O Claude escreve no repositório tudo o que dá (conf do nginx, unit do systemd e do timer, scripts, workflow de homologação, código de Sentry e cofre, runbook com comandos prontos). O dono executa na VPS compartilhada e nos painéis (Supabase, Sentry, bucket, Evolution) e cola a saída; **cada passo assim é um checkpoint `[BLOCKING]`**, no padrão das Fases 2, 5 e 8. O Claude **não** executa por SSH: a VPS é compartilhada com outros 8 projetos e está com o firewall desligado.
- **D-12 (1.7.5):** **A Evolution API roda em VPS nova, só para ela** (Docker com Postgres e Redis próprios, HTTPS, firewall ligado). A Fase 9 só a deixa respondendo por HTTPS e com a chave de API anotada para o cofre; **conectar números é a Sessão 4**. Descartadas: Docker na VPS compartilhada e reusar a Evolution do `automation/`.
- **D-13 (1.7.4, do plano, não rediscutido):** **Sentry** na api (`@sentry/node`, iniciado antes de `buildApp`, `captureException` no `setErrorHandler`) e na web (`@sentry/nextjs` pelo arquivo de instrumentação do Next 16 — **ler antes o guia em `node_modules/next/dist/docs/`**, ver `AGENTS.md`), com `beforeSend` que apaga corpo, cabeçalhos e a parte da URL com segredo, e regra de alerta por e-mail em produção e homologação. O dono viu o desenho (SaaS com scrub) ao fechar a área e não pediu mudança.

**Teste de invasão (tarefa 1.8, nova)**

- **D-14:** **Entra na fase, com as duas camadas.** (1) **Suíte adversarial em `apps/api` por HTTP, dentro do `npm run check`**, como regressão (cerca de 1 dia): matriz Papel × rota (sem token, token adulterado ou expirado, Convidado, Membro, Administrador, `suspenso`); acesso a registro de outro Membro e de outro Espaço; enumeração e força bruta de segredo de link público; `X-Forwarded-For` forjado contra `TRUST_PROXY`; URL assinada de anexo de Tarefa que o Membro não alcança; corpo grande ou de tipo errado. (2) **Passada exploratória em homologação** (cerca de 0,5 dia), ao fim da fase, com relatório `09-PENTEST.md` por severidade. Só começa depois de 1.1, 1.2, 1.5, 1.6 e da homologação (1.7.2) prontas. O `/gsd-secure-phase 9` (mitigações do modelo de ameaças existem no código) e o teste de invasão (tentar quebrar por fora) se complementam.
- **D-15:** **Severidade que trava o fim da fase:** achado **crítico ou alto** precisa estar corrigido **e coberto pela suíte** para a Fase 9 fechar. **Médio e baixo** entram em `.planning/WINDOWS.md` como janela aberta e só saem corrigidos ou dispensados com motivo escrito (enquanto houver janela aberta, o `/gsd-ship` fica bloqueado).
- **D-16:** **Quem faz a passada exploratória:** o Claude, **só contra a homologação, nunca produção, sem carga contra a VPS compartilhada**, e **só depois de a autorização escrita do dono** (escopo, alvo, janela) estar registrada no topo de `09-PENTEST.md`. Dentro da política de testes de segurança do Supabase (<https://supabase.com/docs/guides/security/security-testing>): permitido testar o próprio projeto (Auth, banco, Storage); proibido negação de serviço, inundação de requisições e ataque a outros clientes; **scanner automatizado exige aviso prévio a `security@supabase.com`**. Não se ataca a infraestrutura do Supabase além da API do próprio projeto.

**Cofre, logs e nginx (do documento de tarefas, parâmetros travados)**

- **D-17 (1.4):** `plataforma.credenciais` com `id`, `workspace_id`, `dono_tipo` (`canal` ou `integracao`), `dono_id`, `tipo`, `segredo_cifrado bytea`, `iv bytea`, `etiqueta bytea`, `versao_da_chave int`, `criado_em`, `atualizado_em`, `revogado_em`; índice único em (`workspace_id`, `dono_tipo`, `dono_id`, `tipo`) onde `revogado_em is null`. `apps/api/src/servicos/cofre.ts` com `guardarCredencial`/`lerCredencial`, **AES-256-GCM do `node:crypto`**, IV novo a cada gravação; chave em `COFRE_CHAVE` (32 bytes em base64) e `COFRE_CHAVE_VERSAO`, **cada ambiente com a sua**; nenhuma rota devolve o segredo. Chave fora do banco (não Supabase Vault): quem levar uma cópia do banco não leva os segredos. O backup contém só o texto cifrado, então **a `COFRE_CHAVE` precisa de cópia fora da VPS com o dono** (perder a chave perde as credenciais). — **Reversibility:** one-way — o formato das colunas vai na `009`; trocar o esquema de cifra é migrar credenciais.
- **D-18 (1.5):** `apps/api/src/observabilidade/log.ts` com `opcoesDoLogger()` (`LOG_LEVEL`, `redact` de `req.headers.authorization` e de `*.segredo`, `*.secret`, `*.token`, `*.senha`, censura "[oculto]", serializador de `req` que troca o segmento depois de `/v1/public/forms/` e `/v1/public/tasks/` por `***`); no nginx, um `map` sobre `$request_uri` e um `log_format` próprio. **A mudança do nginx vale na VPS à mão** (depois da primeira emissão do certificado o arquivo da VPS é a fonte; `preparar-vps.sh` não o reescreve).
- **D-19 (1.6):** `limit_req_zone … zone=n1_publico:10m rate=30r/m`, `location /v1/public/` com `burst=10 nodelay` e `limit_req_status 429`; o limite em memória (`limite-de-taxa.ts`) continua como segunda camada, com o comentário corrigido; `TRUST_PROXY` entra no `.env.example` com explicação (vazio em desenvolvimento, `loopback` atrás do nginx).

### Claude's Discretion

- Forma exata de `membroVeSessaoDeChat`, `recortarRegistro` e `recortarDiferenca`, nomes de módulos e de testes, e como o recorte do `GET /estado` convive com a **projeção de Canais relacionais** da Fase 8 (D-11 da Fase 8: `acrescentarCanaisProjetados` roda antes de `visibilidadePara`) e com o contrato do outbox `automacao.notificar-canal.v1`.
- **Como o papel `n1_api` recebe grants quando é criado depois da `009`.** O bloco `if exists` só concede se o papel já existir no momento da migração, e o deploy aplica a `009` sozinho a cada merge na `main`. **Restrição de ordem:** o dono cria `n1_api` à mão em homologação **e** em produção **antes** do merge da `009`. O planejador deve ainda prever um caminho de recuperação que não seja editar a `009` aplicada (por exemplo, um script idempotente fora de `migracoes/`).
- Como provar `n1_api` no Postgres local dos testes (criar o papel no `beforeAll` ou ler de variável) e como os testes que pulam sem `DATABASE_URL` se comportam com a suíte adversarial.
- Texto das telas ("Sem acesso", "Só quem administra a Lista vê o link", "Convite pendente"), a remoção do número de Sessões de Chat do diálogo de remover Membro (a tela passa a contar zero com o recorte, 1.1.1) e o formato do `09-PENTEST.md`.
- Escolha entre Cloudflare R2 e Backblaze B2, e detalhes de `age` (formato de recipient, rotação), conforme o que o dono já tiver conta.
- Se o recorte do cofre precisa de rotação de chave (`versao_da_chave` já está no desenho) além de leitura por versão.

### Deferred Ideas (OUT OF SCOPE)

- **RLS por `workspace_id`** — quando a decisão 12.1 (mais de uma empresa no sistema) for tomada; toca `executar`, os repositórios do CRM e os caminhos que consultam antes de saber o Espaço (rotas públicas, credencial de serviço, outbox, agenda)
- **Regra de visibilidade por registro para Documentos e Agentes** (dono, Equipe, compartilhamento) — Sessão 17 (Conhecimento indexado)
- **Credencial do dono do banco só no deploy**, fora do disco da VPS, com papel `n1_backup` só de leitura para o `pg_dump` — endurecimento aditivo sobre D-07
- **Pentester externo** antes da Sessão 4 (dados reais), depois da passada do Claude
- **Contagem de limite de taxa no banco** — só quando o `apps/api` rodar em mais de um processo (tarefa 1.6.1)
- **Superadmin e convite por e-mail** — Sessão 12 (o cadastro aberto é desligado agora; o Usuário nasce por `usuarios:criar` até lá)
- **Troca de região do Supabase** (`us-west-2` para `sa-east-1`) — fora desta fase (decisão da Fase 2)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEG-01 | Nenhum Membro recebe Sessão de Chat, pasta de chat, Memória de Usuário, Visão pessoal nem e-mail de convite de outro; quem não administra a Lista não recebe `publicShare.secret` nem `Form.secret`, nem por `GET /estado` nem por `POST /operacoes` | R6 (forma do recorte, o `value` do `OperationResult` também vaza, `agentExecutions` de sessão de chat vaza o texto), R3 (arquivo órfão), Pitfalls 1–4; a leitura das telas que usam `secret` está em R5 |
| SEG-02 | Convidado não recebe as cinco coleções de IA; assunto IA some do trilho dele | R5 (lista completa de leitores; nenhum quebra, três degradam o nome do Agente), padrão de `layout.tsx` para "Sem acesso" |
| SEG-03 | Suspenso recebe 403 em `POST /operacoes`; Convidado recebe `ok: false` em `trashContact`, `sendMessage`, `winDeal`, `restoreList`, `createReceivableSeries`; tabela "Quem pode" cobre todo o `REGISTRO` | R8 e Validation Architecture (são **286** operações, não ~200; teste que lê o CONTEXT.md e exige toda chave do `OPERACOES`) |
| SEG-04 | `has_schema_privilege('anon','plataforma','USAGE')` e o de `authenticated` são `false`; `009` aplicada em homologação e produção; `apps/api` em produção conecta como `n1_api`; `drop table plataforma.migracoes` por `n1_api` é recusado | R1 (`rls_auto_enable`, RLS automático no projeto novo), R4 (ordem, recuperação, prova local), guardas de papel na `009`, usuário de pooler `n1_api.<ref>` |
| SEG-05 | Credencial gravada aparece só cifrada no banco, lê de volta o mesmo valor, chave errada falha, nenhuma rota devolve o segredo | Code Examples (AES-256-GCM com AAD ligado à linha), Pitfalls (tag curta, IV, chave de 32 bytes) |
| SEG-06 | `/v1/public/forms/<segredo>` não deixa o segredo no log do `apps/api` nem no do nginx | R2/R8, **o `error_log` do nginx também grava a URL** (medido), receita testada em Docker, `redact`/serializador de `req` |
| SEG-07 | 50 chamadas seguidas do mesmo IP a `/v1/public/forms/x` recebem `429` a partir de cerca da 40ª | **Critério corrigido pela medição: o primeiro `429` vem na 12ª chamada** (1 + `burst=10`); e as páginas `/f/` e `/p/` chamam a api do servidor da Vercel (IP compartilhado) |
| SEG-08 | Homologação no ar com login e banco próprios; push na branch `homologacao` publica a api | R4 (ordem), `preparar-vps.sh`/`instalar-release.sh`/`n1-crm-api.service` têm caminhos e porta fixos (parametrizar), `deploy-api.yml` |
| SEG-09 | Restauração feita e anotada; `count(*)` de `plataforma.registros` em homologação bate com produção na hora do backup | R7 (R2 x B2, `age`, `rclone`, o que o Supabase guarda), Open Question sobre dado real de produção em homologação |
| SEG-10 | Erro forçado em homologação chega como alerta por e-mail em até 5 minutos | R2 (Sentry v11: `dataCollection`, `beforeSend`, instrumentação do Next 16), checkpoint do dono |
| SEG-11 | Painel da Evolution responde por HTTPS e a chave de API está anotada para a Sessão 4 | Checkpoint do dono; pesquisa só de nível LOW (documentação oficial não acessível) |
| SEG-12 | Suíte adversarial verde no `npm run check`; `09-PENTEST.md` com autorização, achados por severidade e nenhum crítico ou alto aberto | R8 (forma da suíte), **o CI não tem Postgres: a suíte só roda no `check` do CI se ganhar um job com serviço Postgres**; política de testes do Supabase (correção do D-16) |
</phase_requirements>

## Summary

A Fase 9 é, em quase tudo, **escrita no repositório já desenhada** (o documento de tarefas e o CONTEXT fixam o quê). O que esta pesquisa acrescenta são **dez descobertas que mudam o plano ou corrigem um critério**, todas medidas ou lidas nesta sessão, e a forma concreta das peças que o CONTEXT deixou para a pesquisa. As descobertas que o planejador precisa tratar como tarefas (não como notas) estão na tabela logo abaixo; o detalhe, com evidência, está nas seções R1 a R9 e em Common Pitfalls.

O desenho geral continua: o recorte nasce no domínio (`recortarRegistro`/`recortarDiferenca`, `membroVeSessaoDeChat`), o 403 de suspenso e o `n1_api` nascem na api, e a tela só deixa de depender de coleções que o servidor deixa de mandar. O CI do repositório roda `DATABASE_URL: ""` (`.github/workflows/check.yml`), então **todo teste que fala com Postgres pula no CI**: para a suíte adversarial valer como regressão de verdade (D-14) é preciso um job de CI com serviço Postgres, restrito ao diretório da suíte, sem arrastar os 43 arquivos de teste que hoje rodam contra o banco remoto.

**Primary recommendation:** implemente 1.1 a 1.6 como o documento de tarefas manda, **mais** os dez ajustes abaixo; prove tudo o que for código com testes locais (Postgres `postgres:16` em Docker e `nginx:stable-alpine` em Docker, ambos disponíveis na máquina do dono); trate cada passo na VPS, no Supabase, no Sentry, no bucket e na Evolution como checkpoint `[BLOCKING]` com comando pronto.

### Descobertas que mudam o plano (leia primeiro)

| # | Descoberta | Evidência | O que o plano faz |
|---|---|---|---|
| F1 | O **`value` do `OperationResult`** também vaza: `updateTask`, `setTaskFieldValue`, etc. devolvem a `Task` inteira (com `publicShare.secret`) e a rota manda `{ ...resultado, diferenca, sequencia }`; o recorte da 1.1.5 só cobre `diferenca.gravados[].dados` | `operacoes.ts:365`; `collaboration.ts:290` (`return ok(task, task.id);`) | `recortarValor` na 1.1.5, com teste |
| F2 | `agentExecutions` de `origin: "sessaoDeChat"` carregam `input`/`output` (o **texto da conversa**) e `chatSessionId`; `Agent.memory[].content` também. Esconder a Sessão sem esconder a execução deixa o texto sair pelo `GET /estado` | `types/ai.ts:256-282` (`readonly input: string;`, `output?: string;`, `readonly chatSessionId?: Id;`), `types/ai.ts:342` (`memory: AgentMemoryItem[];`) | `agentExecutions` com `chatSessionId` oculto saem junto (1.1.1); `Agent.memory` vai para Open Questions; o teste de vazamento procura **o texto** das mensagens, não só ids |
| F3 | O **`error_log` do nginx** grava a linha do pedido (com o segredo) a cada `429` do `limit_req`: medido, 39 linhas com o segredo em 50 chamadas. A 1.5.2 só mascara o `access_log`, então a 1.6 reabre o vazamento que a 1.5 fecha | Experimento Docker nesta sessão (ver R2 e Pitfall 6) | `limit_req_log_level info` + `error_log … crit` no `location /v1/public/`; teste em Docker |
| F4 | **SEG-07 "a partir da ~40ª" está errado.** Com `rate=30r/m burst=10 nodelay` o primeiro `429` é a **12ª** chamada (medido) | Experimento Docker: `200`×11 e depois `429` | Critério vira "≥ 30 das 50 são 429 e o primeiro 429 está entre a 11ª e a 20ª" |
| F5 | `/f/<segredo>` e `/p/<segredo>` são **Server Components** que chamam `GET /v1/public/*` **do servidor da Vercel** (duas vezes por visita: `generateMetadata` e a página). O `limit_req` por `$binary_remote_addr` junta todos os visitantes num balde só (o IP de saída da Vercel) | `apps/web/src/app/(publico)/f/[segredo]/page.tsx:24-27`, `dados/transporte-publico.ts:1-16` | Open Question para o dono; proposta: zona só para `POST`, e GET com teto próprio mais alto |
| F6 | A `009` **quebra no Postgres local dos testes** se fizer `revoke … from anon, authenticated` sem guarda: `postgres:16` não tem esses papéis | `postgres:16` é o container do repositório (`08-RESEARCH.md:704`); papéis só existem no Supabase | `do $$ foreach … if exists (pg_roles)`; mesma guarda para `rls_auto_enable` |
| F7 | `public.rls_auto_enable()` **não existe** na imagem do Supabase (`supabase/postgres:17.6.1.166` local, sem a função nem o `ensure_rls`); existe no projeto de produção por escolha de criação. Versões antigas dela **não filtram schema**: num projeto novo com o `ensure_rls`, as tabelas de `plataforma` nascem com **RLS ligada e sem policy**, e `n1_api` (sem `bypassrls`) enxerga zero linhas | Consulta local ao catálogo; mirror do guia de event triggers | Validar em homologação `relrowsecurity` das 22 tabelas antes de trocar a conexão; a `009` desliga RLS nas tabelas de `plataforma` (D-05 é "sem RLS") |
| F8 | `GET /anexos/:fileId/url` não é só "arquivo de envio público": **`removeAttachment` deixa o `WorkspaceFile` (com `objectKey` real) no estado sem nenhuma Tarefa**, e `membroVeArquivo` devolve `true` para todo arquivo sem dono. Um boleto removido de uma conta de Gestão vira baixável por qualquer sessão, inclusive Convidado, e o id sai no `GET /estado` | `collaboration.ts:282-291`, `derive-visibilidade.ts:97-102`, `estado.ts:73-76` | Entra no recorte da 1.1 (não só na suíte); ver R3 |
| F9 | O CI não roda nenhum teste com banco; `estado.test.ts` usa `Boolean(process.env.DATABASE_URL)` e, com o `.env` do dev, **roda contra o Supabase remoto**. A suíte nova deve usar o guarda **local-only** (`describeComBanco`) e ganhar job de CI com Postgres | `.github/workflows/check.yml` (`DATABASE_URL: ""`), `estado.test.ts:61`, `testes/banco-crm.ts` | Job `seguranca` no `check.yml` com serviço `postgres:16`; ver R8 |
| F10 | Restaurar produção em homologação **copia dado real (CPF, dado bancário do Financeiro) para um projeto de segurança mais fraca**, onde ainda corre a passada exploratória | D-10 + SEG-09 | Open Question: restaurar em Postgres descartável no Mac do dono, ou restaurar em homologação **e apagar antes da passada** |

**Correções a texto do CONTEXT (para o dono confirmar):** (a) D-16 diz que scanner automatizado "exige aviso prévio a `security@supabase.com`"; a página oficial de política **não diz isso** (lida e buscada por `scanner`, `notice`, `notify`: sem ocorrência); o aviso é cortesia, não regra. (b) D-10 pede "chave de acesso do bucket só de escrita": **o R2 não tem token só de escrita** (quatro níveis, todos leem); o B2 tem. (c) SEG-07, acima.

## Architectural Responsibility Map

| Capacidade | Tier primário | Tier secundário | Racional |
|---|---|---|---|
| Regra do que cada Membro pode ler (Sessão de Chat, Memória, Visão pessoal, segredo de link, coleções de IA do Convidado) | Domínio (`derive-visibilidade.ts`) | API (aplica em `GET /estado` e em `POST /operacoes`) | "Mudou o que a coisa é" nasce no domínio: tela e endpoint aplicam a mesma regra (`CONTEXT.md` raiz) |
| Recusa de escrita de Membro `suspenso` em `POST /operacoes` | API (`rotas/operacoes.ts`) | — | Vale para toda operação do registro; é regra de transporte, não de uma operação (CONTEXT, Established Patterns) |
| Recusa de escrita do Convidado no CRM antigo, `restoreList`, `createReceivableSeries` | Domínio (`operations/crm-antigo.ts`, `tasks.ts`, `financeiro.ts`) | Web (a mesma recusa vira `disabledReason`) | A recusa mora no domínio e a rota só traduz |
| Esconder o assunto IA e mostrar "Sem acesso" em `/ia/*` | Web (`app-shell.tsx`, `ia/layout.tsx`) | API (já não manda as coleções) | "Como aparece" é web; a barreira real é o servidor não mandar |
| Banco fechado, papel `n1_api`, cofre | Banco/Storage (`009`) | API (`conexao.ts`, `cofre.ts`) | "Como se guarda" é api |
| Máscara do segredo em URL (log, Sentry, nginx) | API (logger) e Web (Sentry) com a regex no **domínio** | Infra (nginx `map`) | As duas camadas precisam da mesma regra e não podem depender uma da outra |
| Limite de taxa das rotas públicas | Infra (nginx `limit_req`) | API (`limite-de-taxa.ts`, 2ª camada) | A borda corta antes do Node (D-19) |
| Backup cifrado, restauração, homologação | Infra (VPS, systemd, bucket) | Repositório (scripts, units, runbook) | D-11: Claude entrega o arquivo, o dono executa |
| Monitoramento de erro | API e Web (SDK) | SaaS (Sentry: regra de alerta) | Scrub no SDK, antes de sair da máquina |
| Prova adversarial | API (suíte `app.inject`, CI) | Homologação (passada exploratória) | Regressão automática + olhar humano/assistido |

## Standard Stack

### Core

| Biblioteca | Versão | Propósito | Por que é o padrão |
|---|---|---|---|
| `node:crypto` (`createCipheriv`, `aes-256-gcm`) | Node 24 (VPS e CI) | Cofre de credenciais | Biblioteca padrão; D-17 já fixa. Sem dependência nova |
| `@sentry/node` | `11.8.0` (exata) | Erro da api | Exigido por D-13; Node `>=20.19.0 <22.0.0 \|\| >=22.12.0 <23.0.0 \|\| >=23.2.0` `[VERIFIED: npm registry]` (a VPS roda Node 24 e o CI também) |
| `@sentry/nextjs` | `11.8.0` (exata) | Erro da web | `peerDependencies.next` = `^14.0 \|\| ^15.0.0-rc.0 \|\| ^16.0.0-0` `[VERIFIED: npm registry]`; o repositório usa `next` 16.3.4 |
| `pino` (já dentro do Fastify 5.12.5, não é dependência direta) | 10.3.1 | `redact` do logger | Fastify aceita `logger: { level, stream, serializers, redact }` (`types/logger.d.ts:86-111` em `node_modules/fastify`) |
| `nginx` (`map`, `log_format`, `limit_req_zone`) | o da VPS | Máscara e limite | Provado em Docker `nginx:stable-alpine` nesta sessão |
| `vitest` | `^5.0.0` | Testes (api, web, domínio) | Já é o framework `[VERIFIED: apps/api/package.json]` |

### Supporting

| Ferramenta | Versão | Propósito | Quando |
|---|---|---|---|
| `pg_dump` / `pg_restore` | **igual à versão maior do Postgres do Supabase** | Backup lógico | O cliente deve ser ≥ servidor; na VPS provavelmente exige repositório PGDG (checkpoint) `[ASSUMED]` |
| `age` | 1.x | Cifra do backup com chave pública | `age -r age1…`; chave privada com o dono `[CITED: github.com/FiloSottile/age]` |
| `rclone` | 1.6x+ | Envio ao bucket | `rclone rcat`/`copyto` com `--no-check-dest` / `--s3-no-check-bucket` `[ASSUMED]` para chave só de escrita |
| Backblaze B2 **ou** Cloudflare R2 | — | Bucket com expiração | Recomendo B2 se o dono quer chave só de escrita (R7) |
| Docker | 29.3.1 (máquina do dono) | `postgres:16` e `nginx:stable-alpine` para provas locais | Já usado nas Fases 7 e 8 |

### Alternatives Considered

| Em vez de | Poderia usar | Tradeoff |
|---|---|---|
| `@sentry/*` v11.8.0 | `@sentry/*` `10.76.2` (linha `v10`, tag `v10` do npm) | v11 é de 2026-10-01 e a doc atual já é a v11 (`dataCollection`); a v10 é a linha madura mas usa `sendDefaultPii`. O scrub por `beforeSend` vale nas duas |
| Supabase Vault | `node:crypto` com chave fora do banco | Já decidido (D-17) |
| `logger: { redact, serializers, stream }` | `loggerInstance: pino(...)` | O segundo exigiria `pino` como dependência direta; o primeiro basta |
| `pgcrypto` | AES-GCM no Node | Já decidido |

**Installation:**
```bash
npm install --save-exact @sentry/node@11.8.0 -w @n1/api
npm install --save-exact @sentry/nextjs@11.8.0 -w @n1/web
```

**Version verification:** `npm view @sentry/node version time.modified engines` → `11.8.0`, `2026-10-15T10:09:17.692Z`; `npm view @sentry/nextjs version peerDependencies` → `11.8.0`, `next: '^14.0 || ^15.0.0-rc.0 || ^16.0.0-0'`; `npm view @sentry/node dist-tags` → `latest: 11.8.0`, `v10: 10.76.2` `[VERIFIED: npm registry]`.

## Package Legitimacy Audit

| Pacote | Registro | Idade da versão | Downloads | Repo | Veredito | Disposição |
|---|---|---|---|---|---|---|
| `@sentry/node` | npm | **7 dias** (a linha 11.x já tinha a 11.2.0 em 2026-10-01) | 23,6 M/semana | `getsentry/sentry-javascript` | `SUS` (`too-new`) | Mantido; **planejador insere `checkpoint:human-verify` antes de instalar** |
| `@sentry/nextjs` | npm | 7 dias | 7,2 M/semana | `getsentry/sentry-javascript` | `SUS` (`too-new`) | Mantido; mesmo checkpoint |
| `@sentry/core`, `@sentry/bundler-plugins` (transitivas) | npm | 7 dias | — | mesmo repo | `SUS` (`too-new`) | Só transitivas; cobertas pelo mesmo checkpoint |

`gsd_run query package-legitimacy check --ecosystem npm @sentry/node @sentry/nextjs` devolveu `SUS` com a única razão `too-new` (a *versão* mais recente tem 7 dias; o pacote é oficial, `postinstall: null`, sem `deprecated`). Nenhum pacote foi `SLOP`. Os dois pacotes foram descobertos por documentação oficial do Sentry e por `npm view`, mas o veredito `SUS` impede o rótulo `[VERIFIED]` de legitimidade: tratar como `[ASSUMED]` até o checkpoint. Mitigação sugerida no checkpoint: conferir o tarball no `npm view @sentry/node dist.tarball`, fixar a versão exata, ou cair para `10.76.2` (publicada em 2026-10-08, 14 dias).

**Pacotes removidos por `SLOP`:** nenhum. **Sinalizados `SUS`:** `@sentry/node`, `@sentry/nextjs`.

`age`, `rclone` e `pg_dump` não são pacotes npm (binários do sistema na VPS): instalação e versão são checkpoints do dono (`[ASSUMED]`). O cofre usa só `node:crypto`: **nenhuma dependência npm nova além do Sentry**.

## Architecture Patterns

### System Architecture Diagram

```
Navegador (Vercel, Next 16)                         Servidor Vercel (SSR de /f/ e /p/)
   │  Authorization: Bearer <JWT Supabase>              │  GET /v1/public/{forms,tasks}/<segredo>
   │  GET /estado · POST /operacoes/:nome               │  (IP de saída da Vercel, F5)
   │  REST /contatos /canais /conversas …               │
   ▼                                                    ▼
nginx (VPS compartilhada)  ── access_log com map (segredo → ***) ── error_log crit no /v1/public/
   │  limit_req n1_publico  (só /v1/public/, 429)
   ▼
apps/api (Fastify, 127.0.0.1:3020)
   │ onRequest: verificarTokenDoSupabase → Membro (ativo|suspenso)            [plugins/autenticacao.ts:85]
   │
   ├─ POST /operacoes/:nome
   │    ├─ [NOVO] Membro suspenso → 403 ("Seu acesso está suspenso …")
   │    ├─ SERVICOS (inviteMember) ou executar() ──► hidratar → operação do domínio → gravar diff
   │    └─ resposta: [NOVO] recortarDiferenca + recortarValor (vale p/ SERVICOS também)
   ├─ GET /estado ─► hidratar → acrescentarCanaisProjetados → [NOVO] visibilidadePara(+recortes)
   ├─ GET /anexos/:fileId/url ─► [NOVO] arquivo sem Tarefa só para quem o criou/administra
   ├─ rotas REST do CRM e de Canais ─► exigir() lê o Papel/estado no banco a cada chamada
   ├─ rotas públicas (/v1/public/*) ─► limite em memória (2ª camada)
   ├─ [NOVO] servicos/cofre.ts ─► plataforma.credenciais (bytea cifrado; chave em COFRE_CHAVE)
   └─ [NOVO] observabilidade/log.ts + sentry.ts ─► journald + Sentry (beforeSend scrub)
   │
   ▼  DATABASE_URL = n1_api.<ref> (DML apenas)         DATABASE_URL_MIGRACAO = postgres.<ref> (migrar, backup)
Postgres do Supabase (schema plataforma; anon/authenticated sem USAGE; 009)
```

### Recommended Project Structure

```
packages/dominio/src/
├── derive-visibilidade.ts     # + membroVeSessaoDeChat? (ou em derive.ts), recortarRegistro, recortarDiferenca, recortarValor
├── operations/crm-antigo.ts   # NOVO: recusaDeEscritaNoCrmAntigo
└── url-segura.ts              # NOVO (sugestão): mascararSegredoDeUrl — usado por api (log, Sentry) e web (Sentry)
apps/api/
├── migracoes/009-seguranca-e-cofre.sql
├── deploy/
│   ├── conceder-n1-api.sql    # NOVO: grants idempotentes (fora de migracoes/, não é lido pelo migrar)
│   ├── n1-crm-limites.conf    # NOVO: limit_req_zone, map, log_format
│   ├── n1-crm-backup.{service,timer,sh}, provar-nginx.sh
│   └── (nginx, .service e scripts parametrizados por ambiente)
├── src/observabilidade/{log.ts, sentry.ts}
├── src/servicos/cofre.ts
├── src/persistencia/conceder-n1-api.cli.ts   # NOVO: roda deploy/conceder-n1-api.sql com DATABASE_URL_MIGRACAO
└── src/seguranca/             # NOVO: suíte adversarial (descreverComBanco local-only)
apps/web/src/
├── instrumentation.ts, instrumentation-client.ts, app/global-error.tsx
└── app/(shell)/ia/layout.tsx  # NOVO: "Sem acesso" para Convidado
```

### Pattern 1: recorte em duas passadas, sempre a partir do estado inteiro

**O quê:** `visibilidadePara(state, memberId)` calcula tudo (`ocultos`, regras de papel) a partir do `state` **inteiro** e só depois monta o `estado` recortado; `recortarRegistro(colecao, dados, state, memberId)` é pura e recebe o estado inteiro como contexto (não o recortado).
**Quando usar:** toda coleção com dado pessoal ou segredo. O desenho do documento de tarefas (1.1.2) é este; a pesquisa acrescenta três pontos de integração:

1. `visibilidadePara` tem hoje `if (ocultos.size === 0) return { estado: state, ocultos };` (`derive-visibilidade.ts:62`). Com os recortes novos **esse retorno antecipado passa a ser errado** (um Espaço sem contêiner privado ainda tem Memória de Usuário de outro Membro). O `return` precisa sumir ou virar "nenhum recorte de qualquer tipo".
2. Os ids que saem (Sessões, pastas, Visões pessoais, Formulários, `agentExecutions` de Sessão oculta) entram em `ocultos`, porque `filtrarOrdens` e `filtrarDiferenca` os usam. `sequencia: maiorIdDe(state)` continua sobre o estado inteiro (`estado.ts:51`).
3. Pontos de aplicação: `GET /estado` (`estado.ts:46`), `POST /operacoes` (`operacoes.ts:363-366`), **e** o caminho `SERVICOS` (`operacoes.ts:302-303`), que hoje não tem `depois`.

**Exemplo (forma, não código final):**
```typescript
// packages/dominio/src/derive-visibilidade.ts
export function recortarRegistro<T>(colecao: string, dados: T, state: DataState, memberId: Id): T {
  switch (colecao) {
    case "members":  return recortarMembro(dados as Member, state, memberId) as T;
    case "tasks":    return recortarTarefa(dados as Task, state, memberId) as T;   // publicShare.secret
    case "forms":    return recortarFormulario(dados as Form, state, memberId) as T; // secret
    default:         return dados;                                                   // desconhecida: intacta
  }
}
export function recortarValor(valor: unknown, state: DataState, memberId: Id): unknown {
  // value de OperationResult: Task, Task[], Member, Form ou Comment. Reconhece por colecao+id no `state`.
}
```

### Pattern 2: o segredo some trocando o valor, não apagando a chave

`Form.secret: string` e `PublicShare.secret: string` são **obrigatórios nos tipos** (`structure.ts:148` e `:349`, `readonly secret: string;`). Apagar a chave faz o tipo mentir e a tela montar `/f/undefined`. Trocar por `""` mantém o tipo, e as quatro telas que montam o link passam a testar `secret === ""` (lista completa em R5). O servidor continua com o segredo real; a cópia local do cliente só serve para recusar na hora (`store.ts`, `run()`), nunca é reenviada.

### Pattern 3: `n1_api` como papel de DML apenas, com recuperação idempotente

Ver R4. A `009` concede se o papel existe; um SQL idempotente fora de `migracoes/` concede de novo a qualquer momento; o `instalar-release.sh` pode rodá-lo a cada deploy (barato e auto-curativo).

### Pattern 4: provar infra em Docker antes de pedir ao dono

O nginx (`map`, `log_format`, `limit_req`, `error_log`) foi provado nesta sessão com `docker run nginx:stable-alpine` e `curl`. O plano deve incluir `apps/api/deploy/provar-nginx.sh` (sobe o container com os mesmos arquivos de `conf.d`, dispara 50 chamadas, confere o primeiro `429` e confere que o segredo não está em nenhum log) para que o dono só repita na VPS o que já passou localmente.

### Anti-Patterns to Avoid

- **Apagar a chave `secret`/`publicShare.secret` em vez de trocar por `""`:** quebra o contrato de tipos e gera `/f/undefined`.
- **`revoke … from anon, authenticated` sem `if exists (pg_roles)`:** a `009` falha no Postgres local e a suíte inteira cai.
- **Conectar o app como `n1_api` sem `DATABASE_URL_MIGRACAO` no `api.env`:** o próximo deploy roda `migrar` como `n1_api` e falha em DDL. As duas linhas mudam **juntas**.
- **Mascarar só o `access_log`:** o `error_log` do nginx grava a linha do pedido (F3).
- **Testar o recorte só procurando ids:** o vazamento real de Sessão de Chat é o **texto** (`agentExecutions`, `Agent.memory`).
- **Revogar `EXECUTE` de funções de `plataforma` de `public`:** `crm_exige_admin_na_empresa` chama `crm_confere_admin` diretamente (`perform plataforma.crm_confere_admin(v_workspace, v_empresa);`, `007-crm.sql:258`); o gate já é o `USAGE` do schema (provado em 22/10). Se mexer, conceder `EXECUTE` a `n1_api`.
- **Dar a `n1_api` DML em `plataforma.migracoes`:** com `delete` nela, um bug reaplica migrações; revogar `insert, update, delete, truncate` só dessa tabela (o `select` não machuca).

## Respostas aos itens que o CONTEXT entregou à pesquisa

### R1 — D-06(e): `public.rls_auto_enable()` num projeto novo e a revogação

**O que a evidência mostra**

- **A função não faz parte do Postgres base do Supabase.** Consulta de catálogo (só `select`) no container local `supabase_db_rede-social`, imagem `public.ecr.aws/supabase/postgres:17.6.1.166` (outro projeto do dono, usado só como amostra de uma imagem nova): a consulta por `proname = 'rls_auto_enable'` voltou **vazia**, e a lista de event triggers foi, verbatim: `issue_graphql_placeholder`, `pgrst_ddl_watch`, `pgrst_drop_watch`, `issue_pg_cron_access`, `issue_pg_net_access`, `issue_pg_graphql_access` — **sem `ensure_rls`** `[VERIFIED: consulta local nesta sessão]`.
- A função é o **exemplo do guia de event triggers do Supabase**: `CREATE OR REPLACE FUNCTION rls_auto_enable() RETURNS EVENT_TRIGGER … SECURITY DEFINER … SET search_path = pg_catalog`, ligada por `CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') EXECUTE FUNCTION rls_auto_enable();` `[CITED: espelho github.com/code/lib-supabase/pull/412 do apps/docs/content/guides/database/postgres/event-triggers.mdx]`. Os advisors de produção a acusam (09-NOTAS) porque ela existe lá. Se **um projeto novo a traz** depende de como o projeto é criado: `[ASSUMED]` — **a homologação precisa dizer** (`select to_regprocedure('public.rls_auto_enable()'), evtname from pg_event_trigger;`).
- **Revogar é o conserto que o próprio Supabase manda** para a lint 0028/0029: `revoke execute on function public.my_priv_op(int, text) from authenticated, anon, public;`, "Revoke from `PUBLIC` as well, because Postgres' default-grant lives there" `[CITED: supabase.com/docs/guides/database/database-advisors?lint=0028_anon_security_definer_function_executable]`.
- **Não quebra o gatilho:** relatos de PR em repositórios de terceiros (fystay#14, outros) dizem "Postgres doesn't check EXECUTE when it fires an event trigger" e que uma tabela criada depois ainda ganha RLS `[CITED: github.com/fystay/fystay/pull/14 — fonte secundária]`. Por isso a regra D-06 ("só entra depois de testada na homologação") continua certa: o teste é criar uma tabela de prova em homologação depois do `revoke` e ver `relrowsecurity`.

**Como escrever na `009` (defensivo, porque a função pode não existir e o dono do objeto pode não ser `postgres`)**

```sql
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    begin
      revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
    exception when insufficient_privilege then
      raise notice 'rls_auto_enable: sem privilégio para revogar (dono diferente); fica para o dono do Supabase';
    end;
  end if;
exception when undefined_object then
  null; -- anon/authenticated inexistentes (Postgres local)
end $$;
```
A `009` é uma transação (`migrar.ts:82-86`): um erro aqui derrubaria o deploy inteiro, então a guarda não é opcional.

**O risco que o CONTEXT não viu (F7):** versões antigas da função **não filtram schema** (a versão atual tem `IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND …` `[CITED: mirror acima]`). Num projeto novo que traga o `ensure_rls` antigo, **cada tabela criada em `plataforma` pelas migrações 001–008 e pela `009` ganha RLS ligada sem policy**. `postgres` tem `rolbypassrls = t` e continua funcionando (verbatim da consulta local: `role|postgres|f|t|t|t`); `n1_api` (sem `bypassrls`) enxerga zero linhas. Ninguém notaria até trocar a conexão. Conserto previsto na `009` (e **lembrete para toda migração futura** que crie tabela em `plataforma`: se o `ensure_rls` existir, ela nasce com RLS ligada; a `010`, `011`… repetem o `disable row level security`, ou o dono remove o event trigger): um bloco que, para cada tabela de `plataforma` com `relrowsecurity`, faz `alter table … disable row level security` (D-05 é "sem RLS nesta fase"; a Sessão 12 reintroduz com policy), e a conferência de homologação **antes** de trocar `DATABASE_URL`: `select relname, relrowsecurity from pg_class where relnamespace = 'plataforma'::regnamespace and relkind = 'r' and relrowsecurity;` → 0 linhas.

### R2 — D-13: Sentry na web (Next 16) e na api (Fastify)

**Next 16 (lido em `node_modules/next/dist/docs/` antes de recomendar).** Next 16.3.4 `[VERIFIED: node_modules/next/package.json]`.

- `instrumentation.ts` fica na **raiz ou dentro de `src/`** (a web usa `src/`, então `apps/web/src/instrumentation.ts`); `register()` roda **uma vez** por instância e deve terminar antes de o servidor atender; `onRequestError` existe desde `v15.0.0` e recebe `(err, request, context)` com `context.routeType` em `'render' | 'route' | 'action' | 'proxy'` `[CITED: 01-app/03-api-reference/03-file-conventions/instrumentation.md]`.
- `instrumentation-client.ts` (também em `src/`) roda **depois do HTML e antes da hidratação**; só o código síncrono de topo está garantido antes da hidratação; exporta `onRouterTransitionStart` `[CITED: …/instrumentation-client.md]`. Existe ainda `instrumentationClientInject` (v16.3.0) para `withSentryConfig` injetar o seu módulo `[CITED: …/next-config-js/instrumentationClientInject.md]`.
- **`proxy.ts` substitui `middleware.ts` e roda em Node.js por padrão** (`proxy.md:255`); o repositório já tem `apps/web/src/proxy.ts`. Não há runtime `edge` a instrumentar: `register()` só precisa do ramo `nodejs`.
- A web **não tem** `error.tsx` nem `global-error.tsx` (`ls` retornou "No such file"): um erro de render no cliente hoje não vai a lugar nenhum. O plano inclui `src/app/global-error.tsx` (cliente, com `<html>`/`<body>` próprios, chamando `Sentry.captureException`) `[CITED: docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/]`.
- O doc do Sentry (manual setup) lista: `next.config.ts` com `withSentryConfig`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `app/global-error.tsx`; mínimo `@sentry/nextjs` 8.28.0 para `onRequestError`; Node ≥ 20.19; import `withSentryConfig` de `@sentry/nextjs/config` `[CITED: docs.sentry.io/…/nextjs/manual-setup/]`. Conferi no tarball de `@sentry/nextjs@11.8.0` que `./config` está nos `exports` e que `captureRequestError` é exportado `[VERIFIED: npm pack @sentry/nextjs@11.8.0]`.

**Bundle mínimo.** `bundleSizeOptimizations` existe no nível de topo do `withSentryConfig` e **vale para webpack e Turbopack**; `removeDebugLogging` e `removeTracing` tiram do bundle o log de debug e o código de tracing; `excludeReplay*` não importa porque não se instala `replayIntegration` `[VERIFIED: tipos de @sentry/nextjs@11.8.0 e @sentry/core@11.8.0, build-time-plugins/buildTimeOptionsBase.d.ts:111 e config/types.d.ts:92-126]`. Para não precisar de token nem de rede no build: `telemetry: false` (`buildTimeOptionsBase.d.ts:68`) e `sourcemaps: { disable: true }` no começo (o rastro fica minificado; ligar o envio de source maps é outro passo, com `SENTRY_AUTH_TOKEN` na Vercel). Sem `tunnelRoute`, sem `replayIntegration`, `tracesSampleRate: 0`.

**O que o Sentry coleta por padrão na v11 (e por isso o scrub é obrigatório).** `@sentry/core@11.8.0` tem a opção `dataCollection` com padrões **todos ligados**: `userInfo: true`, `cookies: true`, `httpHeaders: { request: true, response: true }`, `httpBodies` com os quatro alvos (`incomingRequest`, `outgoingRequest`, `incomingResponse`, `outgoingResponse`), `urlQueryParams: true`, `databaseQueryData: true`, `queues: true`, `stackFrameVariables: true`, `frameContextLines: 5` `[VERIFIED: types/datacollection.d.ts]`. Configuração mínima de privacidade, em ordem de importância: `dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false, queues: false, stackFrameVariables: false }` **mais** `beforeSend`/`beforeBreadcrumb` como segunda camada (a doc oficial só mostra `beforeSend` apagando `event.user.email`; `beforeBreadcrumb` e `beforeSendSpan` existem `[CITED: docs.sentry.io/platforms/javascript/data-management/sensitive-data/]`).
O que o `beforeSend` precisa limpar, porque o segredo também chega por aí: `event.request.url`, `event.request.headers`, `event.request.cookies`, `event.request.query_string`, `event.request.data`, `event.transaction`, `event.breadcrumbs[].data.url` e `…message`, `event.exception.values[].value`. **Na web**, o padrão de URL com segredo é `/f/<segredo>` e `/p/<segredo>` (`proxy.ts`: `PREFIXOS_PUBLICOS = ["/f/", "/p/"]`) e o cabeçalho `Referer`; na api, `/v1/public/forms/<segredo>` e `/v1/public/tasks/<segredo>` (`formularios-publicos.ts:193`, `tarefas-publicas.ts:50`). A regra é a mesma nas duas camadas: pôr a função pura no domínio (Pattern/estrutura acima).

**Fastify (api).** A página oficial de Fastify diz que o `fastifyIntegration` captura erros de rotas e hooks sozinho, ignora 3xx/4xx, e carrega o `instrument.js` com `node --import ./instrument.js app.js`; mas a página lista suporte a Fastify `^3.21.0 || ^4.0.0` na integração de tracing `[CITED: docs.sentry.io/…/fastify/…]`, e o repositório usa **Fastify 5.12.5** e roda por **`vite-node src/index.ts`** (sem `--import`; `n1-crm-api.service` `ExecStart=/opt/n1-crm/current/node_modules/.bin/vite-node src/index.ts`). Conclusão prescritiva: **não depender da auto-instrumentação**. `Sentry.init({ …, tracesSampleRate: 0 })` no topo de `index.ts` (antes de `buildApp`, como o D-13 pede) e `Sentry.captureException(erro)` **dentro do ramo 500 do `setErrorHandler`** (`app.ts:140`, depois dos ramos 400 do zod e 4xx do Fastify, que já respondem antes) fazem o trabalho sem tracing. Fechar com `await Sentry.close(2000)` no desligamento. A página do Node ESM diz que o monitoramento de erro "starts working as soon as you call `Sentry.init()`" `[CITED: docs.sentry.io/…/node/install/esm/]`; a perda de init tardio é de auto-instrumentação, não de `captureException` — a prova é um teste que chama o `setErrorHandler` com um transporte falso.

**O que só o dono faz (checkpoint):** criar a conta/projetos, copiar os DSN (um por ambiente), regra de alerta por e-mail "erro novo", e colar o e-mail recebido (SEG-10). Nada disso é verificável pelo repositório.

### R3 — Achado novo: `GET /anexos/:fileId/url`

**Caracterização precisa.** `membroVeArquivo` (`derive-visibilidade.ts:97-102`):

```typescript
export function membroVeArquivo(state: DataState, memberId: Id, fileId: Id): boolean {
  if (!state.files.some((f) => f.id === fileId)) return false;
  const tarefas = tarefasComOArquivo(state, fileId);
  if (tarefas.length === 0) return true;
  return tarefas.some((t) => memberSeesTask(state, memberId, t.id));
}
```
Um `WorkspaceFile` que **nenhuma Tarefa carrega** devolve `true` para **qualquer sessão do Espaço** — Convidado e `suspenso` incluídos — e `visibilidadePara` o mantém em `files` (`derive-visibilidade.ts:69`, `if (donas.length === 0) return true;`), ou seja, o `GET /estado` entrega a todos o **id, o nome e o `objectKey`** dele.

**Quem produz esse arquivo hoje.** Li todos os produtores (`state.files.push`): `anexarArquivoEnviado` (`anexos-enviados.ts:107`), `submitForm` (`scale.ts:571`), a importação do Financeiro (`importar.ts:418`) — todos ligam o arquivo a uma Tarefa na mesma operação; `attachFile` (`collaboration.ts:269`), grupos (`ferramentas/grupos.ts:192`) e Documentos (`ia/conhecimento.ts:385`) usam `objectKey: \`legado/${id}\`` e `arquivoSemConteudo` devolve 409 (nada a baixar). **Portanto o órfão com conteúdo real não nasce órfão — vira órfão depois:** `removeAttachment` (`collaboration.ts:282-291`) faz `task.attachments = task.attachments.filter(…)` e **não toca `state.files`**; o mesmo vale para trocar o valor de um Campo de arquivo. O resultado: o boleto/NF de uma conta de Gestão que alguém **removeu** da Tarefa passa a ser baixável por qualquer sessão (o objeto também continua no bucket).

**Onde entra: no recorte da 1.1, com regressão na suíte (D-14).** É dado de outro Membro/contêiner saindo pelo `GET /estado` e pela URL assinada; o conserto é pequeno e está no mesmo arquivo:

1. `membroVeArquivo`: sem Tarefa, **só quem criou o arquivo** (`createdBy.kind === "member" && createdBy.id === memberId`) ou quem administra o Espaço (`administraOEspaco`) baixa; arquivos `legado/*` (`arquivoSemConteudo`) seguem como estão (não há conteúdo).
2. `visibilidadePara`: o mesmo critério decide se o `WorkspaceFile` órfão com conteúdo real entra em `files` (senão `objectKey` e nome continuam saindo).
3. Teste: Membro A anexa, remove o anexo, Membro B chama `GET /anexos/:id/url` → 404; e o `GET /estado` de B não traz o arquivo. A suíte adversarial repete com Convidado.
A limpeza do objeto no Storage (apagar o arquivo removido) **não é desta fase**: registrar em `deferred-items`.

### R4 — `n1_api` criado depois da `009`: recuperação e prova local

**Ordem de operação (runbook, cada passo é checkpoint `[BLOCKING]`).**
1. Em **homologação**: `create role n1_api login password '…'` (SQL Editor; `postgres` no Supabase tem `rolcreaterole = t`, verbatim da consulta local `role|postgres|f|t|t|t`) → merge/push na `homologacao` (a `009` aplica **com** o papel presente) → conferir grants → só então trocar `DATABASE_URL` e **acrescentar `DATABASE_URL_MIGRACAO` na mesma edição** do `api.env`.
2. Em **produção**: o mesmo, **antes** do merge na `main`. Regra do `api.env`: as duas linhas mudam juntas (Anti-Pattern acima).
3. `DATABASE_URL` com `n1_api` pelo pooler compartilhado: o usuário é `[ROLE].[PROJECT-REF]` — `postgres://n1_api.<ref>:<senha-percent-encoded>@aws-0-us-west-2.pooler.supabase.com:5432/postgres` (modo sessão, porta `5432`) `[CITED: supabase.com/docs/guides/database/connecting-to-postgres: "If you connect as a custom role through the shared pooler, the username is [ROLE].[PROJECT-REF]"]`. A senha com símbolos precisa de percent-encoding `[CITED: supabase.com/docs/guides/database/postgres/roles]`. Entra no `.env.example`.

**Caminho de recuperação sem editar a `009` aplicada.** Um arquivo `apps/api/deploy/conceder-n1-api.sql` (**fora de `migracoes/`**: `migrar.ts` só lê `migracoes/` — `readdirSync(PASTA).filter((f) => f.endsWith(".sql"))`, `migrar.ts:33-35`), idempotente, com o mesmo bloco `do $$ … if exists (select 1 from pg_roles where rolname = 'n1_api') …` da `009` (concede `usage` no schema; `select, insert, update, delete` nas tabelas; `usage, select` nas sequências; `execute` nas funções; os `alter default privileges` equivalentes) **e** o endurecimento de `plataforma.migracoes` (`revoke insert, update, delete, truncate … from n1_api`). Um CLI `apps/api/src/persistencia/conceder-n1-api.cli.ts` lê o arquivo e o roda com `DATABASE_URL_MIGRACAO` (npm script `banco:conceder`). Duas formas de acionar: à mão pelo dono, ou **automaticamente em `instalar-release.sh`, logo depois do `migrar`** — idempotente, barato, e cobre o "papel criado depois da 009". Para não ter duas fontes que divirjam, um teste compara os ACLs resultantes (a) da `009` com o papel presente e (b) da `009` sem papel + script.

**Provar `n1_api` no Postgres local dos testes.** O container é `postgres:16` com superusuário `postgres` (`08-RESEARCH.md:704`), então `create role` funciona. Padrão já usado em `migrar-seco.test.ts`: `create database <nome>` por teste, `new Pool({ connectionString: urlDoBanco(nome) })`, `drop database` no `finally`. Três casos, todos em banco novo:
- (a) roles `anon`/`authenticated` criados como `nologin` (`create role … nologin` guardado por `not exists`; papéis são do cluster, então persistem), `n1_api` criado **antes**, `migrar(pool)` → `has_schema_privilege('anon','plataforma','USAGE')` = `false`; `has_table_privilege('n1_api','plataforma.registros','SELECT')` = `true`; conectar como `n1_api` e `drop table plataforma.migracoes` → SQLSTATE `42501`; `insert` em `plataforma.mensagens` (coluna `generated always as identity`) por `n1_api` passa; um `update` em `plataforma.contatos` dispara `crm_toque_atualizado_em` e passa.
- (b) `n1_api` criado **depois** da `009`: sem grants; roda o script; com grants; roda de novo (idempotente).
- (c) sem `anon`/`authenticated` (Postgres puro): a `009` aplica sem erro.
**Refatoração necessária e pequena:** `migrar()` hoje não aceita cliente (`migrar.ts:60`, `pool().connect()`); `migracoesPendentes(cliente = pool())` já aceita. Dar a `migrar` o mesmo parâmetro, e criar `poolDeMigracao()` em `conexao.ts` (usa `DATABASE_URL_MIGRACAO ?? DATABASE_URL`), usado por `migrar`, `migracoesPendentes` e o CLI do backup. `encerrar()` precisa fechar os dois pools.

**Rodar a rota como `n1_api` no CI.** O job de CI da suíte (R8) usa `DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:5432/postgres` para migrar e semear e `DATABASE_URL=postgres://n1_api:x@localhost:5432/postgres` para a aplicação sob teste: a topologia de produção, e acha grant faltando (a varredura do código mostra que **não há DDL em runtime** em `apps/api/src`, fora de `migrar.ts`; então `n1_api` só com DML basta).

### R5 — D-03: leitores de `agents`/`automations`/`documents`/`collections`/`skills` para um Convidado

**Veredito:** nenhuma tela da Tarefa, do fio ou da timeline **quebra** com as cinco coleções vazias (o servidor manda `[]`, não apaga a chave: `COLECOES` tem 48 itens e `estado.test.ts` exige todas as chaves; `aplicarDiferenca` usa `??= []`). **Três pontos degradam o nome de um Agente/Automação** na Tarefa de um Convidado (a Pessoa da conta), e um deles precisa de conserto de rótulo:

| Leitor | Linha | O que acontece com `agents`/`automations` vazios |
|---|---|---|
| `actorLabel` (`packages/dominio/src/derive.ts:891-902`), usado por `tarefa-completa.tsx`, `ficha.tsx`, `components.tsx`, auditoria | `return \`${state.agents.find(…)?.name ?? "Agente"} (Agente)\`;` | vira **"Agente (Agente)"** / **"Automação (Automação)"**. Consertar o fallback para só `"Agente"`/`"Automação"` quando o nome não existe |
| `task-editors.tsx:699,879` (fio resolvido) | `agentes.find(…)?.name ?? "—"` | mostra "—" no lugar do Agente que resolveu |
| `estrutura/listas/[lista]/page.tsx:1391` (coluna de responsáveis) | `.map(… state.agents.find(…)?.name).filter(Boolean)` | o Agente some da coluna (o Membro continua) |
| `tarefa-completa.tsx:446` | `data.agents.some(…) ? "agent" : "member"` | só ao **atribuir** (`assignTask`); a Pessoa da conta só preenche os Campos que lhe foram liberados (`anexos-enviados.ts`: "a Pessoa da conta, que só preenche os Campos liberados"), então atribuir não é caminho dela |
| `notificacoes/page.tsx:83,115,220` | nome do autor/Agente com fallback `"Agente"` | nome genérico |
| `buscar/page.tsx:172-199` | busca em `documents`/`agents`/`automations` | resultado vazio (é o desejado) |
| `crm/caixa-de-entrada/[conversa]/page.tsx:182`, `…/filas/[fila]/page.tsx:178` | lista de atribuíveis / nome do Agente | o CRM antigo segue (D-02) mas sem Agentes na lista; nome do Agente some |
| `configuracoes/page.tsx:113,135`, `configuracoes/integracoes/page.tsx:86`, `configuracoes/lixeira/page.tsx:145,156` | contagens e listas de IA | páginas de administração; vazias para Convidado |

Os leitores em `packages/dominio` (`operations/members.ts`, `conversations.ts`, `tasks.ts:424,443,1188,1748,1752`, `derive.ts:403,410,1154`) rodam no **servidor** com o estado inteiro; no cliente só entram na cópia de `run()`, que "serve só para recusar na hora" (`store.ts`, cabeçalho). O Convidado só preenche Campos liberados e anexos (`setTaskFieldValue`, `anexarArquivoEnviado`); nessas operações o servidor roda as Automações (`runListAutomations`) com o estado inteiro, e a cópia local, sem `automations`, apenas calcula uma recusa/aceite que o servidor refaz — conferir com um teste que `setTaskFieldValue` numa Tarefa de Convidado produz o mesmo `ok` com e sem as coleções de IA.

**Conclusão prática para o plano:** (1) `visibilidadePara` devolve as cinco coleções como `[]` para `baseDoPapel === "convidado"` (a função existe em `operations/ia/permissoes-ia.ts:16-21`; ou ler `roles` direto, como `containerAdminRefusal` já faz em `derive.ts`); (2) trocar o fallback de `actorLabel`; (3) teste de domínio: Convidado recebe cinco `[]` e `actorLabel` de um ator Agente devolve `"Agente"`; (4) mostrar o assunto IA só se `assuntosVisiveis` incluir a regra (extrair a função pura, como `vePastaFinanceiro` em `navegacao-financeiro.ts`); (5) **`/ia/*` não tem `layout.tsx` hoje** (`ls app/(shell)/ia` só lista subpastas): o "Sem acesso" é um `layout.tsx` novo ali, com a mesma leitura de `isGuest` de `app-shell.tsx:634-636`. Hoje o "Sem acesso" do Financeiro vem do 403 do servidor (`leitura.ts:78`), não de um layout; o de IA é por papel no cliente.

**Telas que leem `secret` (1.1.3 "Atenção", pedido do documento):** `estrutura/listas/[lista]/page.tsx:559` (`href={\`/f/${formulariosAtivos[0].secret}\`}`) e `:600` (`copiarLinkDoFormulario(form.secret)`); `features/estrutura/forms-editor.tsx:118,336`; `features/estrutura/share-task-dialog.tsx:40-41` (`/p/${ativo.secret}`); `features/estrutura/tarefa-completa.tsx:530-534` (`task.publicShare?.active`). Todas passam a tratar `secret === ""` como "Só quem administra a Lista vê o link".

### R6 — Recorte × projeção de Canais × outbox × `SERVICOS`

- **`acrescentarCanaisProjetados` antes de `visibilidadePara` não conflita:** os Canais projetados são `state.channels` (modelo antigo, em inglês) com `relational: true`; o recorte novo só toca `members`, `tasks`, `forms`, `views`, `chatSessions`, `chatFolders`, `agentExecutions` (e as cinco do Convidado). `channels` não está na lista, então segue intacto; `recortarRegistro` com `default: return dados` garante isso para qualquer coleção futura. A projeção também **não entra no diff**: `executar()` grava `semCanaisProjetados` (`persistencia/CONTEXT.md`, "A ponte dos Canais"), então `gravados[]` nunca carrega Canal projetado. Teste de não-regressão: o `GET /estado` de um Membro continua trazendo o Canal projetado depois do recorte.
- **Outbox `automacao.notificar-canal.v1`:** o payload leva o tipo do Canal e é derivado dentro de `executar()` a partir das `AutomationExecution` da transação, **antes** de qualquer recorte de resposta (`unidade-de-trabalho.ts`, comentário de `OpcoesExecucao.eventos`). Como o recorte só age sobre o que **volta para o cliente**, não toca o evento. A regra é: recortar depois de `executar()`, nunca dentro do callback.
- **`SERVICOS` (`inviteMember`):** `operacoes.ts:302-303` — `resultado = servico ? await servico(request.membro, args) : await executar(…)`; só o ramo de `executar` preenche `depois` (`:307`), e o final (`:363`) exige `depois`. Para `inviteMember` o corpo sai com `diferenca` bruta **e** `value` (o `Member` inteiro). Solução mínima: `convidarMembro` aceita um `aoTerminar(state)` (ou devolve `{ resultado, depois }`); a rota recorta igual ao outro ramo. `convidarMembro` chama `executar(workspaceId, (state) => inviteMember(state, …))` (`servicos/convidar-membro.ts`), então capturar o `state` dentro do callback é uma linha.
- **`value` do `OperationResult` (F1):** a resposta é `{ ...resultado, diferenca: …, sequencia }` e `resultado.value` é o que a operação devolveu (`Task`, `Member`, `Comment`, `Form`, `Task[]`, `string` …). `recortarValor(valor, state, memberId)` reconhece registros por (`colecao`, `id`) no `state` inteiro e passa por `recortarRegistro`; para objetos que não são registro, devolve como veio. Teste: Membro sem administrar a Lista chama `setTaskFieldValue` numa Tarefa com link público e o corpo inteiro (`JSON.stringify`) não contém o segredo — **no `value` e no `diferenca`**.
- **Resposta `ok:false` e `409`:** sem `value` nem `diferenca`; nada a recortar.
- **Eventos da ponte (`afetadas`)** usam o estado inteiro dentro da rota e não voltam ao cliente.

### R7 — D-10: R2 x B2, `age`, `rclone`, e o que o Supabase guarda

**Cloudflare R2.** Quatro níveis de token: *Admin Read & Write*, *Admin Read only*, *Object Read & Write* ("Allows the ability to read, write, and list objects in specific buckets"), *Object Read only*; escopo por bucket só nos de Objeto; **não há token só de escrita** `[CITED: developers.cloudflare.com/r2/api/tokens/]`. Expiração: regra de ciclo de vida com `Expiration: { Days: N }`, dashboard (**Settings > Object Lifecycle Rules**), `wrangler r2 bucket lifecycle add` ou `PutBucketLifecycleConfiguration` da API S3; "Objects will typically be removed from a bucket within 24 hours of the `x-amz-expiration` value"; teto de 1 000 regras `[CITED: developers.cloudflare.com/r2/buckets/object-lifecycles/]`.
**Backblaze B2.** Chaves de aplicação por capacidade (`writeFiles`, `readFiles`, `listFiles`, `deleteFiles`, …), restringíveis a um bucket (`bucketIds`), e o console oferece o tipo de acesso **"Write Only"** `[CITED: backblaze.com/docs/cloud-storage-application-keys]`; (a doc não diz explicitamente "uma chave só com `writeFiles`" — é inferência `[ASSUMED]`, e o tipo "Write Only" do console a materializa). Ciclo de vida: `daysFromUploadingToHiding` e `daysFromHidingToDeleting`; "Lifecycle Rules are applied once per day"; para "guardar N dias e apagar": `daysFromUploadingToHiding: 14`, `daysFromHidingToDeleting: 1` (arquivo escondido aos 14 dias, apagado no dia seguinte, execução diária: de 15 a 16 dias na prática) `[CITED: backblaze.com/docs/cloud-storage-lifecycle-rules]`.
**Recomendação (prescritiva):** **Backblaze B2** se o dono ainda não tem conta em nenhum dos dois, porque só ele entrega "chave só de escrita" (D-10). Se o dono já usa Cloudflare, **R2 é aceitável** com o risco registrado: quem roubar a chave da VPS lê, lista e talvez apague backups (são `age`-cifrados, então o dano é de disponibilidade, não de confidencialidade) — decisão do dono.
**`rclone` com chave só de escrita:** os sinalizadores `--no-check-dest` ("Don't check the destination, copy regardless") e `--s3-no-check-bucket` existem `[CITED: rclone.org/flags/, rclone.org/s3/]`, mas **não achei documentação de que `rcat`/`copyto` funcionem sem `listFiles`** `[ASSUMED]`. O teste que decide é um checkpoint do dono: enviar um arquivo com a chave de escrita e confirmar que `rclone lsf` com a mesma chave **falha** (isso prova "só de escrita"). Usar a API S3 de qualquer um dos dois com `rclone` (backend `s3`) e `--s3-no-check-bucket`.
**`age`:** `age-keygen -o chave.txt` imprime "Public key: age1…"; cifrar com `age -r age1… -o arquivo.age arquivo` (`-r` repetível; `-R arquivo` lê um recipient por linha); decifrar com `age --decrypt -i chave.txt …`; entrada/saída padrão por padrão, então vale `pg_dump -Fc … | age -r "$RECIPIENT" | rclone rcat remoto:n1-crm-AAAAMMDD.dump.age` `[CITED: github.com/FiloSottile/age]`. A **chave pública** (`age1…`) fica num arquivo da VPS (`/opt/n1-crm/shared/backup.recipient`); a privada nunca sai do dono.
**O que o plano do Supabase já guarda** `[CITED: supabase.com/docs/guides/platform/backups]`: backups diários — **Pro 7 dias, Team 14, Enterprise até 30**; **o plano Free não tem backup diário**; PITR é complemento pago (7/14/28 dias); **os backups não incluem objetos do Storage**; "daily backups do not store passwords for custom roles" (depois de restaurar, **redefinir a senha de `n1_api`**); projetos com Postgres 15.8.1.079+ usam backup físico. O dono confere em Database › Backups qual é o plano e quantos dias (checkpoint). Isto confirma que o backup `pg_dump` próprio é complemento, não duplicata: cobre o schema `plataforma` com 14 dias de retenção própria e fora do Supabase.
**Detalhes de `pg_dump`/restauração que o plano deve fixar:** `-Fc`, `--schema=plataforma`, `--no-owner`, e **`--no-acl`** (senão o restore tenta `GRANT … TO n1_api` e falha se o papel não existir; depois do restore roda `conceder-n1-api.sql`). Na homologação o schema já existe (migrado): restaurar com `pg_restore --clean --if-exists` e depois rodar o script de grants. Contagem de conferência: `select count(*) from plataforma.registros` nos dois lados (SEG-09). A versão do `pg_dump` na VPS deve ser ≥ a do servidor Supabase (checkpoint `select version();`).

### R8 — D-14/D-16: forma da suíte adversarial e política do Supabase

**Forma.** Diretório `apps/api/src/seguranca/` (o `vitest.config.mts` pega `src/**/*.test.ts` e roda **um arquivo por vez**, `fileParallelism: false`). Guarda **local-only**: reutilizar `describeComBanco`/`temBancoCrm` de `testes/banco-crm.ts` (que só liga com `DATABASE_URL` em `localhost`/`127.0.0.1`; hoje `estado.test.ts:61` usa `Boolean(process.env.DATABASE_URL)` e roda contra o Supabase remoto do `.env` — não repetir em teste adversarial, que semeia dados hostis). Montagem: `buildApp({ logger: false, workspaceId, verificarToken, resolverMembro })` com stubs por tabela de tokens (o padrão de `estado.test.ts:42-48`), Postgres local, `app.inject`.
Arquivos sugeridos: `inventario-de-rotas.test.ts` (**genérico**: registra `app.addHook("onRoute", …)` logo depois de `buildApp` — todas as rotas dos plugins são registradas por `app.register` e só carregam no `ready()`, então o hook as vê; `/saude` é síncrona e fica de fora, tratar à parte — e afirma "toda rota sem `config.publica === true` e fora de `/v1/integrations` responde 401 sem token", "token inválido → 401", "Membro `suspenso` em método não-GET → 403 ou recusa" — **rota nova nasce coberta**); `matriz-de-papeis.test.ts` (Convidado, Membro, Administrador, `suspenso` × as famílias de rota; a pergunta aberta que a matriz vai responder é se o `suspenso` é barrado em `POST /financeiro/*`, `POST /tarefas/:id/anexos/*` e nas rotas de Canal — o CRM barra por `podeNoCrm`, `acesso.ts:39-46`); `dados-de-outro-membro.test.ts` (1.1.6, também com segundo Espaço: `WORKSPACE_ID` vem do servidor, nunca do cliente, `autenticacao.ts:78`); `segredos-publicos.test.ts` (enumeração: N segredos errados → `404` uniforme sem diferença de corpo; força bruta: o limite em memória responde `429`); `xff-e-trust-proxy.test.ts`; `anexos.test.ts` (R3); `entrada-hostil.test.ts`; `banco-n1-api.test.ts` (R4).
**`X-Forwarded-For` forjado.** `light-my-request` aceita `remoteAddress` em `inject` `[ASSUMED, conferir na Wave 0]`. Com `trustProxy: "loopback"`: (i) `remoteAddress: "127.0.0.1"` + `x-forwarded-for: "9.9.9.9, 203.0.113.7"` → `request.ip === "203.0.113.7"` (vale o IP que o nginx anexou, à direita; o nginx usa `$proxy_add_x_forwarded_for`, `nginx-n1-crm-api.conf`); (ii) `remoteAddress: "203.0.113.7"` (não loopback) + XFF forjado → o XFF é ignorado. E a contagem do limite em memória não pode ser burlada variando só o XFF.
**Corpo grande / tipo errado.** `app.ts:127-134` já repassa 413 e 415 do Fastify; `bodyLimit` padrão de 1 MiB do Fastify `[ASSUMED]` — o teste manda 2 MiB e `text/plain`.
**CI.** `check.yml` tem `DATABASE_URL: ""` para o job inteiro; a suíte só vira regressão real com um **segundo job `seguranca`** com `services: postgres: image: postgres:16`, `env: DATABASE_URL_MIGRACAO/DATABASE_URL`, rodando só `npx vitest run src/seguranca` em `apps/api`. O `npm run check` local continua pulando sem banco (padrão do repositório), e o job novo é o que o D-14 chama de "dentro do `npm run check`" em CI.
**Política do Supabase (D-16, corrigida).** A página oficial `[CITED: supabase.com/docs/guides/security/security-testing]` diz: clientes **podem** fazer avaliações de segurança/testes de penetração nos serviços listados (Autenticação, Banco, Edge Functions, Storage, Realtime e os endpoints `supabase.co` do **próprio** projeto); **proibido** qualquer atividade contrária à AUP, DoS/DDoS, ataque entre inquilinos e *request flooding*; vulnerabilidades em produtos Supabase devem ser reportadas a `security@supabase.com` imediatamente. **Não há exigência de aviso prévio para scanner** (buscas por `scanner`, `automated`, `notify`, `notice`: sem ocorrência). Manter o e-mail de cortesia do D-16 é prudente, mas não é regra. Sem limites numéricos de taxa: usar o bom senso do D-16 (nada de carga, enumeração em lote pequeno).
**Passada exploratória (fora do código):** `alg=none`/HS256 com chave pública/`kid` forjado no JWT (a defesa é `auth.getClaims` contra o JWKS do projeto — `verificar-token.ts`), CORS com origem falsa, `OPTIONS` em `/v1/integrations`, enumeração de segredo dentro do limite do nginx, `/estado` com token de outro projeto Supabase, acesso direto à porta 3021 de fora da VPS (o firewall está desligado — só `127.0.0.1` protege, `n1-crm-api.service`: `Environment=HOST=127.0.0.1`).

### R9 — Validation Architecture: ver a seção própria abaixo.

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|---|---|---|---|
| Cifra do cofre | esquema próprio, XOR, cifra em base64 | `createCipheriv("aes-256-gcm", chave, iv, { authTagLength: 16 })` + `setAAD` | GCM autentica; AAD amarra o texto cifrado à linha |
| Redação de log | `JSON.stringify` + replace manual | `redact` do pino via `logger: { redact, serializers }` do Fastify | Já embutido; só a URL precisa de serializador próprio |
| Máscara de segredo em log do nginx | `sed` no arquivo de log | `map $request_uri` + `log_format` | Mascara na origem, sem passar por disco com o segredo |
| Limite de taxa na borda | contador próprio na api como única defesa | `limit_req_zone`/`limit_req` | Corta antes do Node; o contador em memória fica como 2ª camada |
| Cifra do backup | `openssl enc` com senha na VPS | `age -r age1…` (chave pública) | A privada nunca fica na VPS |
| Envio ao bucket | `curl` assinando S3 à mão | `rclone` (backend `s3`) | Multipart, retry, endpoints R2/B2 |
| Scrub de evento do Sentry | regex espalhada | uma função pura `limparEvento` testada, e `dataCollection` do SDK | Dois níveis (padrão do SDK + hook) |
| Verificação do JWT | `jose` + JWKS | `auth.getClaims` (já usado em `verificar-token.ts`) | Cache e rotação de chave já resolvidos |
| Inventário de rotas para a matriz | lista manual de URLs | hook `onRoute` do Fastify | Rota nova entra na matriz sem edição |

**Key insight:** quase todo o risco desta fase está em **onde o dado pode sair por um caminho que ninguém olhou** (o `value`, o `error_log`, a execução do agente, o arquivo órfão, o IP da Vercel). O que se constrói é pouco; o que se testa é muito. Cada achado crítico/alto do D-15 nasce de um caminho assim.

## Common Pitfalls

### Pitfall 1: o retorno antecipado de `visibilidadePara`
**O que dá errado:** `if (ocultos.size === 0) return { estado: state, ocultos };` (`derive-visibilidade.ts:62`) devolve o estado inteiro quando nenhum contêiner é oculto; um Espaço sem Espaço privado mandaria a Memória de Usuário de todos.
**Como evitar:** remover o retorno (ou condicioná-lo a "nada a recortar de nenhum tipo"). Teste com seed **sem** contêiner privado.
**Sinal:** o teste de vazamento passa só no seed atual (que tem Gestão privada).

### Pitfall 2: o `value` do `OperationResult` (F1)
**O que dá errado:** `ok(task, task.id)` põe a `Task` inteira em `value`; a rota faz `{ ...resultado, diferenca: filtrarDiferenca(...), sequencia }` e `value` passa intacto.
**Como evitar:** `recortarValor`; teste procura o segredo no **corpo inteiro** (`resposta.body`), não em `diferenca`.
**Sinal:** teste da 1.1.5 do documento verde e o segredo ainda aparece no corpo.

### Pitfall 3: texto de Sessão de Chat por outros caminhos (F2)
**O que dá errado:** `agentExecutions` com `origin: "sessaoDeChat"` e `chatSessionId` carregam `input`/`output`; `Agent.memory[].content` pode guardar frases de conversas privadas (`originDelegateMemberId`); `ApprovalRequest.object.input` carrega a entrada de ferramenta.
**Como evitar:** `agentExecutions` cuja Sessão é oculta saem (e seus ids vão para `ocultos`); `approvals` de origem `agente`/Sessão idem; `Agent.memory` fica registrada como Open Question (a regra fina por registro é Sessão 17). O teste de vazamento semeia mensagens com frases únicas e procura **as frases**.
**Sinal:** frase de uma Sessão privada aparece no corpo de outro Membro.

### Pitfall 4: `secret` apagado em vez de substituído
**O que dá errado:** quatro telas montam `/f/${form.secret}` e `/p/${secret}`; sem a chave viram `/f/undefined`.
**Como evitar:** `""` + condição de tela (lista em R5) + texto "Só quem administra a Lista vê o link". Teste de componente nas duas telas.

### Pitfall 5: `009` falha fora do Supabase
**O que dá errado:** `revoke … from anon` em `postgres:16` → `role "anon" does not exist` → `migrar()` faz rollback → toda a suíte local e o job `seguranca` caem.
**Como evitar:** guardas por `pg_roles` (R1, R4); teste (c) de R4.

### Pitfall 6: segredo no `error_log` do nginx (F3)
**O que dá errado:** com `limit_req` ativo, cada rejeição escreve `limiting requests, excess: … request: "GET /v1/public/forms/<segredo> HTTP/1.1"` em `error_log` (nível `error`). Medido: 39 linhas com o segredo em 50 chamadas. Erros de upstream (502) escrevem a mesma linha.
**Como evitar:** no `location /v1/public/`: `limit_req_log_level info;` **e** `error_log /var/log/nginx/n1-crm-api.publico.error.log crit;` (medido: zero ocorrências do segredo nos dois arquivos). Custo: erros de proxy dessas rotas deixam de aparecer no log (a api registra os dela). O `access_log` fica com o `log_format` mascarado.
**Sinal:** `grep SEGREDO /var/log/nginx/*.log` acha algo depois de um teste de carga.

### Pitfall 7: `return` no `location` desliga o `limit_req` no teste
**O que dá errado:** `return 200` roda na fase de reescrita, **antes** de `limit_req` (medido: 50×`200`). Na VPS há `proxy_pass`, então o `limit_req` age; num teste Docker sem upstream parece que o limite "não funciona".
**Como evitar:** o container de prova usa um segundo `server` como upstream (`proxy_pass http://127.0.0.1:8081`).

### Pitfall 8: `limit_req` e as páginas `/f/` e `/p/` (F5)
**O que dá errado:** a visita à página faz **duas** chamadas `GET /v1/public/forms/<segredo>` do servidor da Vercel (`generateMetadata` e a página); todo visitante vem do mesmo IP de saída da Vercel. Com `rate=30r/m burst=10`, a capacidade somada de todos os visitantes é de cerca de 15 visitas por minuto. O limite em memória (`limitePorIp`, 30/min) já tem o mesmo defeito hoje.
**Como evitar (proposta, depende do dono — Open Question 1):** `limit_req_zone` com chave por `map $request_method`: `POST` por `$binary_remote_addr` (o navegador chama `uploads` e `submissions` direto, IP real) e `GET` com teto separado e mais alto (ou chave fixa) — o `GET` por segredo já tem o limite de 60/min por segredo em memória. Documentar no `CONTEXT.md` de deploy.

### Pitfall 9: trocar `DATABASE_URL` antes de `DATABASE_URL_MIGRACAO`
**O que dá errado:** com o app como `n1_api` e sem a variável nova, o `migrar` do próximo deploy roda como `n1_api` e falha em DDL; o deploy volta a versão anterior (`instalar-release.sh`), sem dano, mas trava a esteira.
**Como evitar:** uma edição só do `api.env`; checagem de pré-voo opcional no `instalar-release.sh` (avisar se o usuário de `DATABASE_URL` é `n1_api` e falta `DATABASE_URL_MIGRACAO`).

### Pitfall 10: `pg_dump` mais velho que o servidor
**O que dá errado:** `pg_dump: error: aborting because of server version mismatch`.
**Como evitar:** checkpoint `pg_dump --version` na VPS contra `select version()` no Supabase; PGDG se preciso `[ASSUMED]`.

### Pitfall 11: restaurar produção em homologação (F10)
**O que dá errado:** CPF e dados bancários do Financeiro (reais) passam a viver num projeto onde o Claude fará a passada exploratória e onde o login é mais frouxo.
**Como evitar:** Open Question 2.

### Pitfall 12: CI não roda o banco (F9)
**O que dá errado:** a suíte "dentro do `npm run check`" fica verde no CI sem executar um único teste de banco (`check.yml`: `DATABASE_URL: ""`).
**Como evitar:** job `seguranca` com serviço Postgres (R8). Para o dono saber que **de fato rodou**: o job imprime a contagem de testes executados e falha se zerar (`--reporter=json` + `jq '.numPassedTests'`).

### Pitfall 13: estado da chave do cofre
**O que dá errado:** `COFRE_CHAVE` com tamanho diferente de 32 bytes, ou a mesma chave em homologação e produção; tag de GCM aceita curta.
**Como evitar:** validar `Buffer.from(base64).length === 32` no boot do cofre; criar o `Decipheriv` com `{ authTagLength: 16 }`; chaves distintas por ambiente (D-17). Perder a chave perde as credenciais: cópia com o dono (checkpoint).

### Pitfall 14: `usuarios:criar` com cadastro desligado
**O que dá errado:** não há documentação oficial (busca só trouxe tutoriais) de que `auth.admin.createUser` siga funcionando com "Allow new users to sign up" desligado `[ASSUMED]`.
**Como evitar:** o dono desliga o cadastro **primeiro em homologação** e roda `npm run usuarios:criar`; só depois em produção (já previsto nas "Ações do dono").

## Code Examples

### 009 — fechar para `anon`/`authenticated`/`public`, conceder a `n1_api`, tabela do cofre

```sql
-- apps/api/migracoes/009-seguranca-e-cofre.sql   (esqueleto; a ORDEM importa)

-- (c) primeiro a tabela, para que os grants/privilégios padrão abaixo a alcancem
create table if not exists plataforma.credenciais (
  id               text        primary key default gen_random_uuid()::text,
  workspace_id     text        not null,
  dono_tipo        text        not null check (dono_tipo in ('canal', 'integracao')),
  dono_id          text        not null,
  tipo             text        not null,
  segredo_cifrado  bytea       not null,
  iv               bytea       not null,
  etiqueta         bytea       not null,
  versao_da_chave  int         not null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  revogado_em      timestamptz
);
create unique index if not exists credenciais_ativa_unica
  on plataforma.credenciais (workspace_id, dono_tipo, dono_id, tipo) where revogado_em is null;

-- (d) search_path fixo nas três funções (assinaturas conforme 007-crm.sql)
alter function plataforma.crm_toque_atualizado_em()               set search_path = pg_catalog, plataforma;
alter function plataforma.crm_exige_admin_na_empresa()            set search_path = pg_catalog, plataforma;
alter function plataforma.crm_confere_admin(text, text)           set search_path = pg_catalog, plataforma;

-- (a) fechar — anon/authenticated só existem no Supabase
do $$
declare papel text;
begin
  foreach papel in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = papel) then
      execute format('revoke all on schema plataforma from %I', papel);
      execute format('revoke all on all tables in schema plataforma from %I', papel);
      execute format('revoke all on all sequences in schema plataforma from %I', papel);
      execute format('alter default privileges in schema plataforma revoke all on tables from %I', papel);
      execute format('alter default privileges in schema plataforma revoke all on sequences from %I', papel);
    end if;
  end loop;
end $$;
revoke all on schema plataforma from public;

-- F7: nada de RLS ligada por event trigger sem policy (D-05)
do $$
declare t record;
begin
  for t in select c.relname from pg_class c
            where c.relnamespace = 'plataforma'::regnamespace and c.relkind = 'r' and c.relrowsecurity loop
    execute format('alter table plataforma.%I disable row level security', t.relname);
  end loop;
end $$;

-- (b) n1_api, se já existir
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'n1_api') then
    grant usage on schema plataforma to n1_api;
    grant select, insert, update, delete on all tables in schema plataforma to n1_api;
    grant usage, select on all sequences in schema plataforma to n1_api;
    grant execute on all functions in schema plataforma to n1_api;
    alter default privileges in schema plataforma grant select, insert, update, delete on tables to n1_api;
    alter default privileges in schema plataforma grant usage, select on sequences to n1_api;
    alter default privileges in schema plataforma grant execute on functions to n1_api;
    revoke insert, update, delete, truncate on plataforma.migracoes from n1_api;
  end if;
end $$;
-- (e) rls_auto_enable: bloco defensivo de R1
```
`[VERIFIED: assinaturas em apps/api/migracoes/007-crm.sql:32, :241, :263]` — `create or replace function plataforma.crm_toque_atualizado_em() returns trigger`, `create or replace function plataforma.crm_exige_admin_na_empresa() returns trigger`, `create or replace function plataforma.crm_confere_admin(p_workspace text, p_empresa text) returns void`. Os 22 objetos de tabela são 21 + `credenciais`.

### Cofre — cifrar e decifrar (AAD amarrado à linha)

```typescript
// apps/api/src/servicos/cofre.ts  (trecho)
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const contexto = (c: { workspaceId: string; donoTipo: string; donoId: string; tipo: string }, versao: number) =>
  Buffer.from(JSON.stringify([c.workspaceId, c.donoTipo, c.donoId, c.tipo, versao]), "utf8");

export function cifrar(texto: string, chave: Buffer, versao: number, c: Parameters<typeof contexto>[0]) {
  if (chave.length !== 32) throw new Error("COFRE_CHAVE precisa ter 32 bytes (base64).");
  const iv = randomBytes(12);                                           // IV novo a cada gravação (96 bits)
  const cifra = createCipheriv("aes-256-gcm", chave, iv, { authTagLength: 16 });
  cifra.setAAD(contexto(c, versao));
  const segredo_cifrado = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  return { segredo_cifrado, iv, etiqueta: cifra.getAuthTag(), versao_da_chave: versao };
}

export function decifrar(l: { segredo_cifrado: Buffer; iv: Buffer; etiqueta: Buffer; versao_da_chave: number },
                         chave: Buffer, c: Parameters<typeof contexto>[0]): string {
  const d = createDecipheriv("aes-256-gcm", chave, l.iv, { authTagLength: 16 });
  d.setAAD(contexto(c, l.versao_da_chave));
  d.setAuthTag(l.etiqueta);
  return Buffer.concat([d.update(l.segredo_cifrado), d.final()]).toString("utf8"); // final() lança se a tag falhar
}
```
`setAAD` antes de `update`; `setAuthTag` antes de `final()`; tag de comprimento inválido faz `setAuthTag` lançar `[CITED: nodejs.org/api/crypto.html, decipher.setAuthTag / setAAD]`. Rotação mínima: `COFRE_CHAVE` + `COFRE_CHAVE_VERSAO` (a atual) e, se a rotação entrar, `COFRE_CHAVE_ANTERIOR` + `COFRE_CHAVE_ANTERIOR_VERSAO`; `lerCredencial` escolhe pela `versao_da_chave` da linha. Gravar uma credencial nova do mesmo (dono, tipo) = `update … set revogado_em = now()` + `insert`, na mesma transação do cliente recebido (o índice parcial único exige a ordem).

### Logger — URL mascarada e `redact`

```typescript
// apps/api/src/observabilidade/log.ts  (forma)
const SEGREDO_NA_URL = /(\/v1\/public\/(?:forms|tasks)\/)[^/?#\s]+/g;
export const mascararUrl = (url: string): string => url.replace(SEGREDO_NA_URL, "$1***");

export function opcoesDoLogger(env: NodeJS.ProcessEnv = process.env, stream?: { write(msg: string): void }) {
  return {
    level: env.LOG_LEVEL?.trim() || "info",
    redact: { paths: ["req.headers.authorization", "*.segredo", "*.secret", "*.token", "*.senha"], censor: "[oculto]" },
    serializers: {
      req: (req: { method?: string; url?: string; hostname?: string; ip?: string; socket?: { remotePort?: number } }) =>
        ({ method: req.method, url: mascararUrl(req.url ?? ""), host: req.hostname, remoteAddress: req.ip, remotePort: req.socket?.remotePort }),
    },
    ...(stream ? { stream } : {}),
  };
}
```
`FastifyLoggerOptions` aceita `serializers.req`, `level`, `stream` (`node_modules/fastify/types/logger.d.ts:86-111`, verbatim: `stream?: FastifyLoggerStreamDestination;`) e `PinoLoggerOptions` traz `redact`. `OpcoesDoApp.logger` (`app.ts`, `readonly logger?: boolean;`) passa a aceitar esse objeto. A forma exata do parâmetro de `req` no serializador do Fastify 5 (objeto bruto vs. `FastifyRequest`) **é detalhe a confirmar no teste de stream de memória** (`GET /v1/public/forms/abc123` não pode deixar `abc123` na linha) `[ASSUMED]`.

### nginx — arquivos provados em Docker (mascarar, limitar, não vazar no `error_log`)

```nginx
# /etc/nginx/conf.d/n1-crm-limites.conf   (contexto http; incluído pelo nginx.conf padrão)
limit_req_zone $binary_remote_addr zone=n1_publico:10m rate=30r/m;
map $request_uri $n1_uri_mascarada {
    default $request_uri;
    ~^(?<antes>/v1/public/(?:forms|tasks)/)[^/?]+(?<depois>.*)$ "${antes}***${depois}";
}
log_format n1_mascarado '$remote_addr [$time_local] "$request_method $n1_uri_mascarada $server_protocol" $status $body_bytes_sent';
```
```nginx
# no server do site (trecho)
access_log /var/log/nginx/n1-crm-api.access.log n1_mascarado;
location /v1/public/ {
    limit_req zone=n1_publico burst=10 nodelay;
    limit_req_status 429;
    limit_req_log_level info;                                   # F3: a rejeição não vai ao error_log
    error_log /var/log/nginx/n1-crm-api.publico.error.log crit;  # F3: nem o erro de proxy com a URL
    proxy_pass http://127.0.0.1:__PORTA__;
    # … mesmos proxy_set_header do location /
}
```
Resultado medido (Docker `nginx:stable-alpine`, 50 `curl` seguidos a `/v1/public/forms/SEGREDOTESTE123`): `200`×11, depois `429`×39; o primeiro `429` na linha 12 do log; `acesso.log` mostra `"GET /v1/public/forms/*** HTTP/1.1"`; `grep -c SEGREDOTESTE123` = 0 no `access` e 0 no `error` (com `limit_req_log_level info` e `error_log … crit`); **sem** essas duas linhas: 39 ocorrências no `error_log`. `[VERIFIED: experimento local nesta sessão]`. O `$request` padrão contém a URI, por isso o `log_format` próprio reconstrói a linha sem ele. O `$http_referer` também pode carregar `/f/<segredo>`: deixá-lo fora do `log_format` (como acima).

### `ia/layout.tsx` — "Sem acesso" para Convidado (forma)

```tsx
"use client";
// apps/web/src/app/(shell)/ia/layout.tsx
const ehConvidado = (data, memberId) =>
  data.roles.find((r) => r.id === data.members.find((m) => m.id === memberId)?.roleId)?.base === "convidado";
export default function LayoutDaIA({ children }: { children: React.ReactNode }) {
  const data = useData((d) => d); const { memberId } = useSession();
  return ehConvidado(data, memberId) ? <NoAccessState what="a área de IA" /> : <>{children}</>;
}
```
`NoAccessState` já existe e é usado em `ia/chat/[sessao]/page.tsx` (`<NoAccessState what="Sessão de Chat de outro Membro" />`).

## State of the Art

| Antes | Agora | Mudou em | Impacto |
|---|---|---|---|
| `middleware.ts` | `proxy.ts` (Node.js por padrão) | Next 16.0.0 | O repositório já usa `proxy.ts`; não há runtime edge a instrumentar |
| `sendDefaultPii` + `beforeSend` no Sentry | `dataCollection` por categoria (+ `beforeSend`) | Sentry v11 (2026-10) | A configuração mínima de privacidade é declarativa |
| Instrumentar Next com `sentry.client.config.ts` | `instrumentation-client.ts` + `instrumentation.ts` | Next 15.3 / Sentry 8+ | Convenção do Next lida em `node_modules/next/dist/docs/` |
| RLS ligada por padrão nas tabelas do dashboard | tabelas criadas por SQL não ganham RLS, **exceto** com event trigger `ensure_rls` instalado | recente | F7: pode ligar RLS sem policy em `plataforma` num projeto novo |

**Deprecated/desatualizado:** o que o CONTEXT chama de "~40ª chamada" (F4); "scanner exige aviso" (D-16); "chave só de escrita" no R2 (D-10).

## Assumptions Log

> Tudo que está marcado `[ASSUMED]` acima precisa de confirmação do dono (ou de um checkpoint) antes de virar decisão travada.

| # | Claim | Seção | Risco se estiver errado |
|---|---|---|---|
| A1 | Um projeto Supabase **novo** (a homologação) pode trazer `public.rls_auto_enable()` e o event trigger `ensure_rls`; só a consulta na homologação diz | R1 | Baixo se a `009` for defensiva (é); alto se `ensure_rls` antigo ligar RLS em `plataforma` e ninguém conferir antes de trocar para `n1_api` |
| A2 | O dono de `public.rls_auto_enable()` pode não ser `postgres` (o `revoke` daria `insufficient_privilege`) | R1 | A `009` captura a exceção; o `revoke` fica pendente de ação do dono |
| A3 | `@sentry/node` 11.8.0 e `@sentry/nextjs` 11.8.0 são legítimos (veredito `SUS` só por serem de 7 dias) | Package Legitimacy | Cadeia de suprimentos; mitigado por checkpoint e pino exato |
| A4 | Sem `--import`, `Sentry.init` + `captureException` manual no `setErrorHandler` do Fastify 5 funciona sem auto-instrumentação | R2 | Erros não chegam ao Sentry em homologação; descoberto no teste forçado (SEG-10) |
| A5 | `rclone rcat`/`copyto` com `--no-check-dest` e `--s3-no-check-bucket` enviam com uma chave sem permissão de listar | R7 | Backup falha na VPS; descoberto no checkpoint do dono antes de ligar o timer |
| A6 | `pg_dump` do pooler (porta 5432, modo sessão) funciona com `DATABASE_URL_MIGRACAO` e o cliente da VPS é de versão ≥ servidor | R7, Pitfall 10 | Backup falha; o dono vê a versão em `select version()` |
| A7 | `auth.admin.createUser` (usado por `npm run usuarios:criar`) funciona com o cadastro público desligado | Pitfall 14 | O dono não consegue criar usuário em produção/homologação; descoberto na homologação |
| A8 | `light-my-request` aceita `remoteAddress` em `inject` | R8 | O teste de XFF precisa de outra forma (socket real em porta efêmera) |
| A9 | `bodyLimit` padrão do Fastify 5 é 1 MiB | R8 | O teste de corpo grande usa o número errado |
| A10 | A forma do argumento do serializador `req` do Fastify 5 (campos `hostname`, `ip`, `socket`) | Code Examples | Ajuste de uma linha; o teste de stream de memória acusa |
| A11 | Evolution API v2: imagem `evoapicloud/evolution-api` (≥ 2.3.0), variáveis `AUTHENTICATION_API_KEY`, `DATABASE_PROVIDER=postgresql`, `DATABASE_CONNECTION_URI`, `CACHE_REDIS_URI` (fontes de terceiros; a doc oficial não carregou — 404) | SEG-11 | O runbook da Evolution precisa de ajuste; é checkpoint do dono |
| A12 | A VPS tem (ou aceita instalar) `age`, `rclone` e `postgresql-client` na versão certa sem encostar nos 8 outros projetos | Env. Availability | Backup não sobe; alternativa: rodar o backup de fora (Mac do dono) |
| A13 | O plano do Supabase de produção tem backups diários (Pro ≥ 7 dias) | R7 | Se for Free, o backup próprio é a **única** cópia |
| A14 | Convidado de hoje (Agente do pipeline, Pessoas das contas) não usa IA pela tela | D-03 (do CONTEXT) | Tela de IA vazia para quem dependia dela |
| A15 | Tabelas de prova criadas depois do `revoke` da função ainda ganham RLS pelo event trigger (relatos de terceiros) | R1 | A conferência de homologação refaz o teste |

## Open Questions

1. **Limite do nginx e as páginas `/f/` e `/p/` (F5, Pitfall 8).**
   - O que sabemos: o servidor da Vercel faz as duas chamadas `GET /v1/public/*` por visita, com IP de saída compartilhado; `rate=30r/m burst=10` dá cerca de 15 visitas/min para **todos** os visitantes somados.
   - O que falta: volume real esperado de visitas a formulários públicos e se vale uma zona só de `POST`.
   - Recomendação: aplicar `limit_req` por IP **só a `POST`** (uploads e submissões, vindos do navegador) e dar ao `GET` um teto separado mais alto; manter D-19 (30r/m, burst 10) para o `POST`. O dono confirma antes de o Plano de nginx ser escrito.
2. **Restauração em homologação (F10).**
   - O que sabemos: D-10 manda testar a restauração na homologação; isso copia dado real do Financeiro para lá.
   - Recomendação: provar a restauração em um **Postgres descartável no Mac do dono** (`postgres:16` em Docker, com a chave privada `age` que só ele tem), comparar `count(*)` e apagar; ou restaurar em homologação **e fazer `truncate` dos dados antes da passada exploratória**. O dono escolhe.
3. **Outros caminhos por onde a conversa de uma Sessão sai.**
   - `Agent.memory[].content` e `ApprovalRequest.object.input` não estão no escopo do CONTEXT; `agentExecutions` de Sessão oculta entram na 1.1.1 (recomendado). `agentExecutions`/`automationExecutions`/`skillGrants`/`collectionGrants` **também** não são recortadas para o Convidado pelo D-02 (cinco coleções fixas).
   - Recomendação: tratar `agentExecutions` de Sessão no escopo da 1.1.1 e levar `Agent.memory` e as quatro coleções de IA do Convidado ao dono como decisão (custo baixo, mesmo arquivo).
4. **R2 ou B2** (D-10): ver R7. Pergunta ao dono: já tem conta em qual? Se nenhum, B2.
5. **Sentry v11.8.0 ou v10.76.2** (A3): a doc atual descreve a v11; a v10 é a linha madura. Recomendação: v11.8.0 exata, com checkpoint de verificação.
6. **Usuário do sistema operacional da homologação.** `preparar-vps.sh` e `n1-crm-api.service` fixam `n1crm`, `/opt/n1-crm`, `n1-crm-api` e a porta; a homologação como segundo serviço sob o **mesmo** usuário `n1crm` deixa o `api.env` de produção legível por quem comprometer a homologação. Recomendação: usuário `n1crm-hml` próprio (custo: sudoers e chave de deploy próprias); parametrizar scripts por `AMBIENTE`.
7. **O `suspenso` em `POST /financeiro/*`, `/tarefas/:id/anexos/*` e rotas de Canal.** Não verifiquei cada rota; a matriz da 1.8 vai responder. Se alguma deixar passar, vira correção de 1.2 e não janela.
8. **Desligar o cadastro público antes de `usuarios:criar` estar commitado.** `apps/api/src/autenticacao/criar-usuario.cli.ts` está **não commitado** (git status) e o script `usuarios:criar` está só no `package.json` modificado. A fase deve começar por commitá-lo.

## Environment Availability

| Dependência | Requerida por | Disponível | Versão | Alternativa |
|---|---|---|---|---|
| Node | tudo | ✓ (Mac) | v24.14.0 | — |
| Docker | Postgres e nginx de prova | ✓ | 29.3.1 | — |
| `postgres:16` (imagem) | testes de banco, suíte | ✓ (padrão do repositório) | 16 | — |
| `nginx:stable-alpine` (imagem) | prova de `map`/`limit_req` | ✓ (baixada nesta sessão) | stable | — |
| `psql`, `pg_dump` | restauração local, conferências | ✓ | 18.3 | — |
| `openssl`, `curl`, `jq`, `gh` | scripts de prova e CI | ✓ | 3.6.4 / 8.7.1 / 1.7.1 / 2.87.3 | — |
| `age` | backup cifrado (restauração no Mac) | ✗ | — | `brew install age` (dono) |
| `rclone` | envio do backup | ✗ | — | Só na VPS; `brew install rclone` para o teste de restauração |
| `nginx` local | — | ✗ | — | Docker (acima) |
| VPS compartilhada (Node 24 privado, nginx, systemd) | homologação, backup | **não verificável daqui** (D-11: Claude não acessa) | Node 24 em `/opt/n1-crm/node` | — |
| `pg_dump` ≥ versão do Supabase na VPS | backup | **não verificado** | — | Backup de fora da VPS |
| Projeto Supabase de homologação, bucket B2/R2, conta Sentry, VPS da Evolution | SEG-08..11 | **criar** (dono) | — | — |

**Dependências ausentes sem alternativa:** nenhuma que bloqueie o código. **Ausentes com alternativa:** `age`/`rclone` no Mac (instalar com brew, só para o teste de restauração).

## Validation Architecture

### Test Framework

| Propriedade | Valor |
|---|---|
| Framework | `vitest ^5.0.0` nos três workspaces `[VERIFIED: package.json]` |
| Arquivos de config | `apps/api/vitest.config.mts` (`fileParallelism: false`, `testTimeout: 180_000`), `packages/dominio/vitest.config.mts`, `apps/web/vitest.config.mts` (jsdom) |
| Comando rápido (domínio, sem banco) | `cd packages/dominio && npx vitest run src/derive-visibilidade.test.ts` |
| Comando rápido (api, sem banco) | `cd apps/api && npx vitest run src/observabilidade src/rotas/operacoes-suspenso.test.ts` |
| Comando com banco | `docker run -d --rm --name crm-n1-pg-09NN -e POSTGRES_PASSWORD=x -p 556NN:5432 postgres:16` e `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:556NN/postgres npx vitest run src/seguranca src/servicos/cofre.test.ts src/rotas/estado.test.ts` |
| Suíte completa | `npm run check` (CI pula tudo que usa banco; ver job `seguranca`) |
| Prova de nginx | `bash apps/api/deploy/provar-nginx.sh` (Docker) |

### Phase Requirements → Test Map

| Req | Comportamento | Tipo | Comando automatizado | Direção da falha | Existe? |
|---|---|---|---|---|---|
| SEG-01 | Membro A não recebe Sessão, pasta, Memória, Visão, e-mail de convite, **texto das mensagens**, segredos de B; `GET /estado` **e** `POST /operacoes` (incl. `value` e `inviteMember`); seed **sem** contêiner privado | unit + e2e | dominio: `derive-visibilidade.test.ts`; api: `estado.test.ts`, `operacoes.test.ts`, `seguranca/dados-de-outro-membro.test.ts` | Comentar a chamada de `recortarRegistro`/`recortarValor`: o corpo contém o segredo/frase e o teste fica vermelho | dominio ✅ (arquivo existe); api ❌ Wave 0 |
| SEG-01 (arquivo órfão) | Membro B não baixa nem recebe o arquivo cujo anexo A removeu | e2e | `seguranca/anexos.test.ts` | Reverter `membroVeArquivo`: B recebe URL/arquivo | ❌ Wave 0 |
| SEG-02 | Convidado recebe `agents`, `automations`, `documents`, `collections`, `skills` = `[]`; os outros Papéis recebem tudo; `actorLabel` sem duplicar "(Agente)"; trilho sem IA; `/ia/*` mostra "Sem acesso" | unit (domínio e web) | domínio idem; web: `cd apps/web && npx vitest run src/features/shell src/app/\(shell\)/ia` | Remover o filtro: o teste vê as coleções cheias | ❌ Wave 0 |
| SEG-03 | Suspenso: 403 em `POST /operacoes/trashContact` e o Contato continua `ativo`; **o 403 vem antes do banco** (roda sem `DATABASE_URL`, com `resolverMembro` stub); Convidado `ok:false` em `trashContact`, `sendMessage`, `winDeal`, `restoreList`, `createReceivableSeries` | unit | `operacoes-suspenso.test.ts` (sem banco) + `contacts.test.ts`, `conversations.test.ts`, `deals.test.ts`, `tasks.test.ts`, `financeiro.test.ts` | Tirar o `if (state !== "ativo")`: 200 em vez de 403 | ❌ Wave 0 |
| SEG-03 (tabela) | Toda chave de `OPERACOES` (**286**) aparece em `packages/dominio/CONTEXT.md` "Quem pode", sem linha "sem conferência" sem justificativa | unit | `quem-pode.test.ts` lê o `.md` e compara com `Object.keys(OPERACOES)` | Adicionar uma operação sem linha: vermelho | ❌ Wave 0 |
| SEG-04 | Em banco novo: `anon`/`authenticated` sem `USAGE`; `n1_api` com `SELECT`; `drop table plataforma.migracoes` por `n1_api` → `42501`; `insert` com coluna identity e `update` com trigger funcionam como `n1_api`; `009` aplica sem `anon`; papel criado depois + script → grants; script idempotente; RLS desligada | integração | `seguranca/banco-n1-api.test.ts` (Postgres local) | Tirar a guarda `pg_roles`: erro de migração no caso (c) | ❌ Wave 0 |
| SEG-04 (produção) | `009` aplicada, `has_schema_privilege` = `false`, `api.env` com as duas URLs, `/saude` e `GET /estado` respondem, `drop table` por `n1_api` recusado | **só o dono** | queries coladas | — | `[BLOCKING]` |
| SEG-05 | Round trip; `select segredo_cifrado` não contém o texto; chave errada lança; linha copiada para outro `dono_id` não decifra (AAD); nenhuma rota devolve o segredo (varredura do inventário) | unit + integração | `servicos/cofre.test.ts` | Trocar `setAAD`: o teste de linha trocada passa a ler (vermelho) | ❌ Wave 0 |
| SEG-06 | Linha de log da api para `GET /v1/public/forms/abc123` não contém `abc123` (fluxo em memória); nginx: nenhum log contém o segredo (inclusive `error_log` sob `limit_req`) | unit + Docker | `observabilidade/log.test.ts`; `deploy/provar-nginx.sh` | Tirar o serializador/`map`: o `grep` acha o segredo | ❌ Wave 0 |
| SEG-06 (VPS) | `grep teste123 /var/log/nginx/n1-crm-api*.log` vazio na VPS | **só o dono** | saída colada | — | `[BLOCKING]` |
| SEG-07 | Em Docker: 50 `curl` ao mesmo caminho: ≥ 30 respostas `429`, primeiro `429` entre a 11ª e a 20ª; `POST` não é contado como `GET` (se o dono aprovar a Open Question 1) | Docker | `deploy/provar-nginx.sh` | Remover `limit_req`: nenhum `429` | ❌ Wave 0 |
| SEG-07 (VPS) | o mesmo laço contra `crm-n1-api.85.155.186.214.nip.io` (50 chamadas: carga trivial) | **só o dono** | saída colada | — | `[BLOCKING]` |
| SEG-08 | Push em `homologacao` publica a api; `/entrar` do Preview carrega o Início | **só o dono** (GitHub Actions + Vercel + VPS) | print do Actions e do login | — | `[BLOCKING]` |
| SEG-09 | Dump cifrado sobe ao bucket com a chave de escrita; a chave de escrita **não lista**; restauração reproduz `count(*)` de `plataforma.registros`; data anotada em `deploy/CONTEXT.md` | **só o dono** (chave privada `age`) | `age -d … \| pg_restore` + `psql -c "select count(*)…"` | — | `[BLOCKING]` |
| SEG-10 | `limparEvento` apaga corpo, cabeçalhos, cookies, query e o segmento secreto de URL (api e web) | unit | `observabilidade/sentry.test.ts`; web: `sentry-scrub.test.ts` | Remover um campo: o evento de teste ainda o traz | ❌ Wave 0 |
| SEG-10 (alerta) | erro forçado em homologação gera e-mail em até 5 min | **só o dono** | e-mail encaminhado | — | `[BLOCKING]` |
| SEG-11 | Painel da Evolution por HTTPS; chave de API anotada | **só o dono** | URL + print | — | `[BLOCKING]` |
| SEG-12 | Matriz Papel × rota (inventário por `onRoute`), outro Espaço, enumeração/força bruta de segredo, XFF forjado, anexo inalcançável, corpo grande/tipo errado — suíte verde com Postgres local **e** no job de CI com serviço | integração | `cd apps/api && DATABASE_URL=… npx vitest run src/seguranca` + job `seguranca` | Reintroduzir qualquer vazamento: a suíte falha | ❌ Wave 0 |
| SEG-12 (relatório) | `09-PENTEST.md` com autorização do dono no topo, achados por severidade, crítico/alto cobertos pela suíte | humano/assistido | revisão do arquivo | — | `[BLOCKING]` (autorização) |

### Amostragem

- **Por commit de tarefa:** o comando rápido da área tocada (domínio sem banco, `log`/`sentry`/`operacoes-suspenso` sem banco, `provar-nginx.sh`).
- **Por onda:** `npm run check` + a suíte com Postgres local (`src/seguranca`, `cofre`, `estado`, `banco-n1-api`).
- **Portão da fase:** tudo acima + job `seguranca` do CI verde com contagem de testes executados > 0 + checkpoints `[BLOCKING]` colados + `09-PENTEST.md`.

### Wave 0 — lacunas

- [ ] `apps/api/src/seguranca/` (fábrica de Espaço com 2 Membros reais, inventário de rotas, matriz, XFF, anexos, entrada hostil, `banco-n1-api`)
- [ ] `apps/api/src/servicos/cofre.test.ts`, `apps/api/src/observabilidade/{log,sentry}.test.ts`, `apps/api/src/rotas/operacoes-suspenso.test.ts`
- [ ] testes de domínio: `crm-antigo`/`contacts`/`conversations`/`deals`/`tasks`/`financeiro` (Convidado `ok:false`), `quem-pode.test.ts`
- [ ] web: teste de `assuntosVisiveis` extraído, `ia/layout`, telas com `secret === ""`, scrub do Sentry
- [ ] `apps/api/deploy/provar-nginx.sh` + `n1-crm-limites.conf`
- [ ] `.github/workflows/check.yml`: job `seguranca` com `services: postgres`
- [ ] refatoração: `migrar(pool?)`, `poolDeMigracao()`, `encerrar()` fecha os dois
- [ ] Instalação (após o checkpoint de legitimidade): `@sentry/node@11.8.0`, `@sentry/nextjs@11.8.0`

## Security Domain

(`security_enforcement` está ligado; `security_asvs_level: 1`; `security_block_on: high` em `.planning/config.json`.)

### Categorias ASVS aplicáveis

| Categoria ASVS | Aplica | Controle padrão |
|---|---|---|
| V2 Autenticação | sim | `auth.getClaims` contra o JWKS do projeto (`verificar-token.ts`); desligar cadastro público; "Leaked password protection" (dono) |
| V3 Sessão | sim | JWT do Supabase por requisição; Membro resolvido no banco a cada chamada (`autenticacao.ts`) |
| V4 Controle de acesso | **sim (núcleo)** | recorte no servidor (1.1), 403 de `suspenso` (1.2.1), `recusaDeEscritaNoCrmAntigo` (1.2.2), `n1_api` (1.3), matriz Papel × rota (1.8) |
| V5 Validação de entrada | sim | zod por operação já existente (`esquemaDeArgumentos`), `bodyLimit`, parsers de conteúdo |
| V6 Criptografia | sim | `node:crypto` AES-256-GCM (nunca criar cifra); `age` para backup; TLS verificado do Postgres (`DATABASE_CA_*`) |
| V7 Erros e log | sim | `redact` + serializador; `map` no nginx; scrub do Sentry |
| V8 Proteção de dados | sim | recorte de dado pessoal; cofre; backup cifrado |
| V9 Comunicações | sim | HTTPS no nginx/Let's Encrypt; CA do Supabase fixada |
| V12 Arquivos | sim | URL assinada autorizada por Tarefa; arquivo órfão (R3) |
| V13 API | sim | allowlist de operações (`ehNomeDeOperacao`), CORS por allowlist, rate limit na borda |
| V14 Configuração | sim | `api.env` modo 600, chaves por ambiente, sem `DATABASE_SSL_INSECURE` em produção |

### Padrões de ameaça conhecidos para este stack

| Padrão | STRIDE | Mitigação padrão |
|---|---|---|
| Membro lê dado pessoal de outro por `GET /estado` / resposta de operação (`diferenca`, `value`) | Information Disclosure | `visibilidadePara` + `recortarRegistro`/`recortarDiferenca`/`recortarValor`; teste procura o conteúdo no corpo inteiro |
| Texto de Sessão de Chat via `agentExecutions` | Information Disclosure | ocultar execução cuja Sessão sai |
| Arquivo órfão baixável por qualquer sessão | Information Disclosure / Elevation | `membroVeArquivo` restrito a criador/administrador |
| Suspenso grava por operação sem conferência | Tampering / Elevation | 403 na rota |
| Convidado escreve no CRM antigo | Tampering | `recusaDeEscritaNoCrmAntigo` |
| SQL ou bug apaga/altera tabela de controle | Tampering | `n1_api` sem DDL e sem DML em `migracoes` |
| `anon` alcança `plataforma` pela REST | Information Disclosure | `revoke` (já provado em 22/10) + schema fora de "Exposed schemas" |
| RLS ligada por event trigger sem policy (silêncio total ao trocar o papel) | Denial of Service (próprio) | `disable row level security` na `009` + conferência em homologação |
| Segredo de link em log (api, nginx acesso **e erro**, Sentry) | Information Disclosure | máscara nos três; `error_log` crit no `location` |
| Enumeração/força bruta de segredo de link | Spoofing | segredo aleatório (`crypto.getRandomValues`), 404 uniforme, `limit_req` por IP + limite por segredo |
| `X-Forwarded-For` forjado | Spoofing | `trustProxy: "loopback"` e nginx anexando à direita; teste |
| Chave do bucket roubada da VPS | Tampering (backups) | chave de escrita só (B2) + expiração no bucket; arquivos `age`-cifrados |
| Chave privada do `age` na VPS | Information Disclosure | nunca na VPS; checkpoint |
| Credencial de provedor no banco em claro | Information Disclosure | cofre AES-GCM + AAD; chave fora do banco |
| Pacote npm novo malicioso (`@sentry/*` recém-publicado) | Tampering (cadeia) | versão exata + checkpoint `human-verify` |

## Sources

### Primary (HIGH)
- Código do repositório, lido nesta sessão: `apps/api/src/rotas/{estado,operacoes}.ts`, `apps/api/src/{app,index}.ts`, `apps/api/src/plugins/autenticacao.ts`, `apps/api/src/persistencia/{conexao,migrar,migrar.cli}.ts`, `apps/api/src/servicos/{convidar-membro,limite-de-taxa}.ts`, `apps/api/deploy/*`, `.github/workflows/{check,deploy-api}.yml`, `packages/dominio/src/{derive-visibilidade,derive,colecoes,diferenca}.ts`, `packages/dominio/src/operations/{collaboration,anexos-enviados,scale,registro}.ts`, `packages/dominio/src/types/*`, `apps/web/src/{proxy.ts,dados/store.ts,dados/transporte.ts}` e as telas citadas.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/{instrumentation,instrumentation-client,proxy}.md`, `…/05-config/01-next-config-js/instrumentationClientInject.md`, `01-app/02-guides/instrumentation.md`.
- Tipos de `@sentry/core@11.8.0` e `@sentry/nextjs@11.8.0` (`npm pack`, não instalado no projeto).
- Consulta local (só `select`) ao catálogo do Postgres `supabase/postgres:17.6.1.166`.
- Experimento Docker `nginx:stable-alpine` (mascarar URL, `limit_req`, `error_log`).
- Supabase: <https://supabase.com/docs/guides/platform/backups>, <https://supabase.com/docs/guides/security/security-testing>, <https://supabase.com/docs/guides/database/connecting-to-postgres>, <https://supabase.com/docs/guides/database/database-advisors?lint=0028_anon_security_definer_function_executable>, <https://supabase.com/docs/guides/database/postgres/roles>.

### Secondary (MEDIUM)
- Sentry: <https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/>, <https://docs.sentry.io/platforms/javascript/guides/fastify/>, <https://docs.sentry.io/platforms/javascript/guides/node/install/esm/>, <https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/>.
- Cloudflare: <https://developers.cloudflare.com/r2/api/tokens/>, <https://developers.cloudflare.com/r2/buckets/object-lifecycles/>. Backblaze: <https://www.backblaze.com/docs/cloud-storage-application-keys>, <https://www.backblaze.com/docs/cloud-storage-lifecycle-rules>. rclone: <https://rclone.org/flags/>, <https://rclone.org/s3/>, <https://rclone.org/b2/>. age: <https://github.com/FiloSottile/age>. Node: <https://nodejs.org/api/crypto.html>.

### Tertiary (LOW — marcado `[ASSUMED]`/secundário)
- Espelho do guia de event triggers (`github.com/code/lib-supabase/pull/412`) e PRs de terceiros sobre `rls_auto_enable` (`github.com/fystay/fystay/pull/14`); tutoriais sobre `admin.createUser` com cadastro desligado; guias de terceiros sobre Evolution API v2 (a doc oficial `doc.evolution-api.com/v2/en/install/docker` devolveu 404).

## Metadata

**Confiança por área:**
- Recorte, 403, tabela "Quem pode", `n1_api`, cofre, logs: **HIGH** — código lido, comportamento reproduzido ou derivado de tipos verificados.
- nginx (`map`, `limit_req`, `error_log`): **HIGH** — medido em Docker.
- Sentry (Next 16): **MEDIUM-HIGH** — guia do Next lido, tipos do SDK verificados, comportamento em produção só no teste forçado.
- Sentry (api sem `--import`): **MEDIUM** — inferência da doc; o teste de SEG-10 decide.
- Backup (R2/B2/`rclone`/`age`): **MEDIUM**; chave só de escrita + `rclone` **LOW** até o checkpoint.
- Evolution API: **LOW**.

**Data da pesquisa:** 2026-10-22
**Válido até:** 2026-11-05 (Sentry v11 e a doc do Next mudam rápido; o restante, 30 dias)




