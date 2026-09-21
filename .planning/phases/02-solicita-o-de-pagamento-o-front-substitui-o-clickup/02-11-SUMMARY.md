---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 11
subsystem: backend
tags: [storage, upload, download, seguranca, supabase, persistencia]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    plan: 03
    provides: "plataforma.upload_sessions/upload_objects (migração 003-integracao-e-importacao.sql)"
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    plan: 05
    provides: "WorkspaceFile.objectKey/sha256/state — a referência opaca de Storage que o domínio já esperava"
provides:
  - "abrirSessaoDeUpload/emitirTicket/confirmarObjeto/urlDeDownload/coletarOrfaos — envio em duas fases contra bucket privado (apps/api/src/servicos/storage-uploads.ts)"
  - "criarSessao/obterSessao/reservarObjeto/marcarEnviado/objetosDaSessao/consumirSessao/sessoesExpiradas/marcarExpirados — persistência das sessões de upload (apps/api/src/persistencia/sessoes-de-upload.ts)"
affects: [02-13 (getTask chama urlDeDownload), 02-16/rota pública do Formulário (chama abrirSessaoDeUpload/emitirTicket/confirmarObjeto)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Funções puras separadas de I/O: assinaturaConfereComTipo/tipoAceito/tamanhoAceito/limiteDeArquivosAtingido/gerarObjectKey são exportadas e testadas sem banco nem bucket — só a orquestração (emitirTicket/confirmarObjeto/...) fala com Postgres e Storage"
    - "confirmarObjeto nunca lança — toda recusa volta como { ok: false, motivo }; emitirTicket/urlDeDownload lançam Error com prefixo legível por máquina (sessao_expirada, tipo_nao_aceito, ...), o mesmo estilo de consumirSessao"
    - "PoolClient opcional em toda função de persistencia/sessoes-de-upload.ts (menos consumirSessao, que o exige como primeiro parâmetro obrigatório) para participar da transação futura da submissão"

key-files:
  created:
    - apps/api/src/persistencia/sessoes-de-upload.ts
    - apps/api/src/servicos/storage-uploads.ts
    - apps/api/src/servicos/storage-uploads.test.ts
  modified:
    - apps/api/src/servicos/CONTEXT.md

key-decisions:
  - "obterSessao(sessionId) adicionado a sessoes-de-upload.ts (não previsto no files_modified/artifacts do plano) — emitirTicket precisa validar existência/expiração/consumo e ler workspaceId/formId da sessão ANTES de reservar um objeto; Task 1 não tinha expuesto nenhum getter (Rule 2)"
  - "Verificação de assinatura de arquivo baixa o objeto inteiro (≤25 MiB, já bounded por tamanhoAceito) em vez dos 'primeiros 4 KiB' literais do plano — @supabase/storage-js não expõe um parâmetro de Range HTTP em download()/FetchParameters; com o arquivo inteiro em memória, os primeiros 4096 bytes são fatiados para a assinatura e o sha-256 é calculado sobre o mesmo buffer, sem uma segunda ida à rede"
  - "TETO_SHA256_BYTES (10 MiB, env UPLOAD_SHA256_MAX_BYTES) é uma constante nova, não nomeada pelo plano — limita o custo de CPU do hash em arquivos grandes; acima dele sha256 fica undefined, exatamente como o plano pede"
  - "MAX_ARQUIVOS_POR_ENVIO e TTL_UPLOAD/TTL_DOWNLOAD ganham override opcional por env (UPLOAD_MAX_ARQUIVOS/UPLOAD_TTL_SEGUNDOS/DOWNLOAD_TTL_SEGUNDOS) além do UPLOAD_MAX_BYTES que o plano já nomeava — consistente com 'lidas de env com o padrão do .env.example'"

patterns-established:
  - "Motivo de recusa como union de strings literais (MotivoDeRecusaDeConfirmacao) em vez de exceção, quando a chamada precisa continuar o fluxo (ex.: rota HTTP decidindo o corpo da resposta 4xx) em vez de abortar"

requirements-completed: [SOL-02]

# Metrics
duration: 70min
completed: 2026-09-21
---

# Phase 02 Plan 11: Upload em duas fases contra bucket privado Summary

**Ticket assinado de escopo mínimo para o navegador, verificação server-side real (tamanho + assinatura de arquivo, não só MIME declarado) e URL de download sempre nova — nunca persistida — sobre `plataforma.upload_sessions`/`upload_objects`.**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-09-21 (aprox., ver commits)
- **Completed:** 2026-09-21
- **Tasks:** 3
- **Files modified:** 4 (3 novos, 1 modificado)

## Accomplishments

- `apps/api/src/persistencia/sessoes-de-upload.ts`: acesso fino a `plataforma.upload_sessions`/`upload_objects`, toda função aceitando um `PoolClient` opcional (menos `consumirSessao`, que o exige) para poder participar da mesma transação que vai gravar a Tarefa — nenhuma linha conhece Supabase, bucket ou URL.
- `apps/api/src/servicos/storage-uploads.ts`: `abrirSessaoDeUpload` → `emitirTicket` (ticket assinado, `upsert: false`, service role nunca sai da função) → upload direto do navegador → `confirmarObjeto` (existe, pertence à sessão, tamanho e assinatura de arquivo conferidos — MIME declarado não é suficiente) → `urlDeDownload` (sempre nova, nunca guardada) → `coletarOrfaos` (sessões expiradas e não consumidas, CLI/cron, fora da requisição).
- Limites como constantes lidas de env (`MAX_BYTES_POR_ARQUIVO`, `MAX_ARQUIVOS_POR_ENVIO`, `TIPOS_ACEITOS`, `TTL_UPLOAD`, `TTL_DOWNLOAD`), casando com a copy congelada do UI-SPEC ("PDF, XML, JPG, PNG ou WebP. Até 25 MB por arquivo e 10 arquivos por envio.").
- Suíte condicional: 8 casos puros (assinatura de arquivo, limites, `objectKey` sem o nome do usuário) sempre rodam; 6 casos de integração (a)-(f) cobrem V02-02C contra Postgres e bucket de teste reais, pulando limpo sem `DATABASE_URL`/`SUPABASE_STORAGE_BUCKET`/credenciais do Auth.
- `apps/api/src/servicos/CONTEXT.md` ganha a seção "Anexos": por que o bucket é privado, por que o caminho do objeto é aleatório, por que MIME declarado não basta, e onde a service role de Storage vive.

## Task Commits

Each task was committed atomically:

1. **Task 1: Repositório das sessões de upload** - `4a697cd` (feat)
2. **Task 2: Serviço de upload e download contra o bucket privado** - `604a4d4` (feat, inclui a adição de `obterSessao` a `sessoes-de-upload.ts` — ver Deviations)
3. **Task 3: Suíte condicional contra bucket de teste** - `c5f2614` (test)

**Plan metadata:** (este commit, criado logo após este SUMMARY)

## Files Created/Modified

- `apps/api/src/persistencia/sessoes-de-upload.ts` - `criarSessao`, `obterSessao`, `reservarObjeto`, `marcarEnviado`, `objetosDaSessao`, `consumirSessao`, `sessoesExpiradas`, `marcarExpirados`
- `apps/api/src/servicos/storage-uploads.ts` - `abrirSessaoDeUpload`, `emitirTicket`, `confirmarObjeto`, `urlDeDownload`, `coletarOrfaos` + funções puras (`assinaturaConfereComTipo`, `tipoAceito`, `tamanhoAceito`, `limiteDeArquivosAtingido`, `gerarObjectKey`) + constantes de limite
- `apps/api/src/servicos/storage-uploads.test.ts` - novo; seção pura (8 casos) + seção de integração condicional (6 casos)
- `apps/api/src/servicos/CONTEXT.md` - seção "Anexos" nova

## Decisions Made

- `obterSessao(sessionId)` foi adicionado a `sessoes-de-upload.ts` durante a Task 2 (fora do `files_modified`/`artifacts` originais do plano, mas dentro do mesmo arquivo já tocado na Task 1) — sem ele, `emitirTicket` não tinha como validar existência/expiração/consumo da sessão nem ler `workspaceId`/`formId` para montar o `objectKey`. Avaliado como Rule 2 (funcionalidade crítica faltante), não Rule 4: é um getter fino sobre uma tabela já existente, sem mudança de schema.
- A verificação de assinatura de arquivo baixa o objeto inteiro em vez dos "primeiros 4 KiB" literais do texto do plano. `@supabase/storage-js` (`StorageFileApi.download()`) não expõe um parâmetro de cabeçalho `Range` — `FetchParameters` só aceita `signal`/`cache`. Como o tamanho já é bounded por `tamanhoAceito` (≤25 MiB) antes do download, baixar o objeto inteiro é seguro em memória; os primeiros 4096 bytes são fatiados do mesmo buffer para a checagem de assinatura, e o sha-256 é calculado sobre o mesmo buffer (sem uma segunda ida à rede). `TETO_SHA256_BYTES` (10 MiB, `UPLOAD_SHA256_MAX_BYTES`) continua limitando quando o hash é calculado, como o plano pede.
- `MAX_ARQUIVOS_POR_ENVIO`, `TTL_UPLOAD` e `TTL_DOWNLOAD` ganharam override opcional por env (`UPLOAD_MAX_ARQUIVOS`, `UPLOAD_TTL_SEGUNDOS`, `DOWNLOAD_TTL_SEGUNDOS`) além do `UPLOAD_MAX_BYTES` que o plano já nomeava explicitamente — consistente com "lidas de env com o padrão do `.env.example`" sem inventar comportamento novo (todas têm o valor padrão que o plano pede).
- `confirmarObjeto` nunca lança (retorna `{ ok, motivo }`), enquanto `emitirTicket`/`urlDeDownload` lançam `Error` com um prefixo legível (`sessao_expirada:`, `tipo_nao_aceito:`, ...) — a mesma assimetria que o texto do plano já descreve explicitamente para `confirmarObjeto` ("recusa com motivo objeto_ausente, **sem lançar**"), mantendo o restante consistente com o estilo de recusa de `consumirSessao` (persistência).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `obterSessao` ausente em `sessoes-de-upload.ts`**
- **Found during:** Task 2, ao desenhar `emitirTicket`
- **Issue:** Task 1 expôs `criarSessao`/`reservarObjeto`/`marcarEnviado`/`objetosDaSessao`/`consumirSessao`/`sessoesExpiradas`/`marcarExpirados`, mas nenhuma função para buscar uma sessão específica por id. `emitirTicket` precisa confirmar que a sessão existe, não expirou e não foi consumida, e ler `workspaceId`/`formId` para montar o `objectKey` — sem isso o ticket seria emitido às cegas.
- **Fix:** `obterSessao(sessionId, cliente?)` adicionado, mesmo padrão de `PoolClient` opcional das demais funções finas.
- **Files modified:** apps/api/src/persistencia/sessoes-de-upload.ts
- **Verification:** `npm run typecheck -w @n1/api` verde; `grep -niE 'supabase|bucket|signed'` no arquivo continua vazio (a adição não introduziu conhecimento de Storage na camada de persistência).
- **Committed in:** 604a4d4 (Task 2 commit — a função é consumida só ali, então entrou no mesmo commit)

---

**Total deviations:** 1 auto-fixed (Rule 2, funcionalidade crítica faltante)
**Impact on plan:** O desvio foi necessário para `emitirTicket` funcionar como o texto do plano descreve (validar sessão antes de reservar objeto); não introduz escopo novo além do que a Task 2 já pedia — é a implementação mecânica de uma validação que o próprio texto da `<action>` exige ("valida que a sessão existe, não expirou, não foi consumida").

## Issues Encountered

Nenhum além do documentado em Deviations acima. `.env.example` (e qualquer arquivo `.env*`) ficou fora do alcance de leitura direta neste worktree por política de sandbox — os nomes das variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`, `DOWNLOAD_TTL_SEGUNDOS`) foram confirmados por grep no código já existente (`autenticacao/verificar-token.ts`, `autenticacao/criar-usuarios-do-seed.ts`) e pelo texto do plano, não por leitura direta do arquivo de exemplo; `apps/api/.env.example` não foi modificado por este plano (não estava em `files_modified`) e continua sem as chaves `UPLOAD_*`/`SUPABASE_STORAGE_BUCKET` documentadas — isso é trabalho do Plan 02-09 (já referenciado como concluído pelo `<read_first>` do plano), fora do escopo desta execução.

## User Setup Required

Para a suíte de integração (casos (a)-(f) de `storage-uploads.test.ts`) rodar de fato, `apps/api/.env` precisa de `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `SUPABASE_STORAGE_BUCKET` apontando para um bucket privado de teste no projeto Supabase da plataforma (`epomplsskqpluxuujpxl`). Sem isso — como neste worktree — a suíte pula limpo e `npm run check` continua verde.

## Next Phase Readiness

- `abrirSessaoDeUpload`/`emitirTicket`/`confirmarObjeto` estão prontos para a rota pública do Formulário compor o envio em duas fases (submissão anônima → sessão → tickets → confirmação) antes de `submitForm` (Plan 02-05) gravar a Tarefa.
- `urlDeDownload` está pronto para o contrato v1 de `getTask` (Plan 02-13) — devolve `{ downloadUrl, expiresAt }` sem nunca persistir a URL.
- `coletarOrfaos` existe como função exportada para CLI/cron; nenhum agendador foi criado neste plano (fora de escopo — "não roda automaticamente dentro de requisição").
- A verificação manual "Upload/download real permanece privado" de `02-VALIDATION.md` fica pronta para o gate de integração assim que houver bucket de teste configurado.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*

## Self-Check: PASSED

All 4 claimed files verified present on disk (`apps/api/src/persistencia/sessoes-de-upload.ts`, `apps/api/src/servicos/storage-uploads.ts`, `apps/api/src/servicos/storage-uploads.test.ts`, `apps/api/src/servicos/CONTEXT.md`); all 3 commit hashes (4a697cd, 604a4d4, c5f2614) verified present in `git log`.
