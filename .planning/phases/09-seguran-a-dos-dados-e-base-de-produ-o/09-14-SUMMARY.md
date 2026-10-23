---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 14
subsystem: infra
tags: [backup, age, rclone, pg_dump, systemd, docker, evolution-api, ufw, nginx]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-06/09-11 - scripts de deploy parametrizados por AMBIENTE, o endurecimento do n1-crm-api.service, api.env com DATABASE_URL_MIGRACAO e DATABASE_CA_PATH"
provides:
  - "Backup diario cifrado do schema plataforma (pg_dump | age -R | rclone rcat), sem disco, com .contagem antes/depois"
  - "n1-crm-backup.service/.timer e instalar-backup.sh (--conferir)"
  - "restaurar-backup.sh: restauracao no Mac do dono em Postgres descartavel, que so diz RESTAURACAO OK se a contagem fechar"
  - "provar-backup.sh: prova local ponta a ponta em Docker, incluindo recusa de pg_dump antigo e de contagem adulterada"
  - "deploy/evolution/: compose (api + Postgres + Redis proprios), env de exemplo sem segredo, site nginx e preparar-vps-evolution.sh"
  - "deploy/CONTEXT.md: secoes Backup diario (Fase 9) e Evolution API (Fase 9)"
affects: [09-18, 09-19, sessao-4-conectar-numero]

actuals:
  tokens: 11000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Pipe sem arquivo intermediario: dump nunca toca disco da VPS, nem em claro nem cifrado"
    - "Marcador de completude: o .contagem sai por ultimo; dump sem .contagem e backup incompleto"
    - "Credencial do banco por PG* no ambiente (decomposta da URL), nao por argumento visivel no ps"
    - "Binarios trocaveis por variavel (AGE, RCLONE, PG_DUMP, PSQL) para provar com substitutos"

key-files:
  created:
    - apps/api/deploy/n1-crm-backup.sh
    - apps/api/deploy/n1-crm-backup.service
    - apps/api/deploy/n1-crm-backup.timer
    - apps/api/deploy/instalar-backup.sh
    - apps/api/deploy/restaurar-backup.sh
    - apps/api/deploy/provar-backup.sh
    - apps/api/deploy/evolution/docker-compose.yml
    - apps/api/deploy/evolution/evolution.env.example
    - apps/api/deploy/evolution/nginx-evolution.conf
    - apps/api/deploy/evolution/preparar-vps-evolution.sh
  modified:
    - apps/api/deploy/CONTEXT.md

key-decisions:
  - "pg_restore roda DENTRO do conteiner descartavel (versao da PG_IMAGEM), nao no Mac: o pg_restore do Homebrew costuma divergir do dump; o dono troca PG_IMAGEM se o Supabase for maior que o 16 padrao"
  - "A URL de DATABASE_URL_MIGRACAO e decomposta em PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE: a senha nao aparece no argv numa VPS compartilhada"
  - "Evolution fixada em evoapicloud/evolution-api:v2.3.7 (a tag existe no registro, conferida por docker manifest inspect); a versao a usar continua sendo confirmada pelo dono em 09-19"
  - "ufw libera a porta que o sshd realmente escuta (sshd -T, padrao 22), para o script nao trancar o dono para fora"

patterns-established:
  - "Prova local com substitutos: o que e de terceiros (age, rclone, bucket) fica para o dono; o resto se prova em Docker"

requirements-completed: [SEG-09, SEG-11]

duration: 25min
completed: 2026-10-23
status: complete
plan_head_before: c7501f56a9f8e377c6b3d9e2d5a20a6f4fdc1e88
plan_head_after: b2b54223fac2b1096dbbae811757ec272e0116e0
commits: 2

coverage:
  - id: D1
    description: "Backup diario cifrado (pg_dump -Fc --schema=plataforma --no-owner --no-acl | age -R | rclone rcat --s3-no-check-bucket), sem disco, com contagem antes e depois e recusa de pg_dump mais velho que o servidor"
    requirement: SEG-09
    verification:
      - kind: integration
        ref: "bash apps/api/deploy/provar-backup.sh (provas 1 e 2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Restauracao no Mac do dono em Postgres descartavel com conferencia de contagem (RESTAURACAO OK / DIVERGE), incluindo o intervalo quando houve escrita no meio, e contagem adulterada que faz falhar"
    requirement: SEG-09
    verification:
      - kind: integration
        ref: "bash apps/api/deploy/provar-backup.sh (provas 3, 4, 5 e 6)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unidade systemd oneshot como n1crm, timer diario Persistent=true e instalador com --conferir"
    requirement: SEG-09
    verification:
      - kind: other
        ref: "bash apps/api/deploy/instalar-backup.sh --conferir; grep Persistent=true / User=n1crm"
        status: pass
    human_judgment: true
    rationale: "systemd nao roda nesta maquina: a unidade e o timer so sao exercitados na VPS, no roteiro do dono em 09-18"
  - id: D4
    description: "Arquivos da Evolution API para a VPS nova: compose com Postgres e Redis proprios sem porta publicada, api em 127.0.0.1:8080, unless-stopped nos tres, env sem segredo, nginx e script com ufw 22/80/443 e certbot"
    requirement: SEG-11
    verification:
      - kind: other
        ref: "docker compose config -q com o env de exemplo; preparar-vps-evolution.sh --conferir; yaml: 3 servicos unless-stopped"
        status: pass
    human_judgment: true
    rationale: "O script de preparo (ufw, docker compose up, nginx, certbot) so roda na VPS nova; nomes de variaveis da Evolution v2 vem de fontes de terceiros (A11) e o dono confere em 09-19"
---

# Phase 9 Plan 14: Backup diario cifrado e arquivos da Evolution API Summary

**Backup diario do schema plataforma como pipe `pg_dump | age -R | rclone rcat` sem disco, com contagem antes/depois conferida na restauracao em Docker, mais os arquivos (compose com Postgres/Redis proprios, ufw, nginx, certbot) da VPS nova da Evolution API**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-10-23T03:05:33Z
- **Tasks:** 2
- **Files modified:** 11 (10 criados, 1 alterado)

## Accomplishments

- `n1-crm-backup.sh` faz o dump cifrado em pipe unico, sem arquivo intermediario, conta `plataforma.registros` antes e depois, envia o `.contagem` por ultimo e recusa `pg_dump` mais velho que o servidor (`show server_version_num`) antes de enviar qualquer coisa. Nada de URL ou senha na saida ou no `ps`.
- `restaurar-backup.sh` restaura num Postgres descartavel em Docker (nome, porta e imagem parametrizaveis), decifra com a chave privada do dono, compara o `count(*)` com o `.contagem` (exato quando antes = depois, intervalo quando houve escrita) e so entao diz `RESTAURACAO OK`; contagem adulterada sai 1 com `RESTAURACAO DIVERGE`. O conteiner some no fim.
- `provar-backup.sh` fecha o caminho inteiro em Docker em ~14 s, com 6 provas `ok`: pg_dump 15 recusado contra servidor 16 e nada enviado; dump enviado por `age -R` e `rclone rcat --s3-no-check-bucket` com `.contagem` 3/3 e sem senha na saida; restauracao OK com `registros=3`; intervalo 2..4 aceito; 99/99 recusado; conteiner removido.
- `n1-crm-backup.service` (oneshot, `n1crm`, endurecimento do servico da api sem `ReadWritePaths`, `Nice=10`, `IOSchedulingClass=idle`), `n1-crm-backup.timer` (06:30 UTC, `Persistent=true`, `RandomizedDelaySec=900`) e `instalar-backup.sh` com `--conferir` (script do root em `/opt/n1-crm/bin`, `backup.env` 600 so se nao existir).
- `deploy/evolution/`: compose com `evolution-api` (tag fixa `v2.3.7`), `postgres:16` e `redis:7-alpine`, todos `unless-stopped` com volume proprio e **somente `127.0.0.1:8080` publicado**; env de exemplo sem segredo; site nginx; `preparar-vps-evolution.sh` (ufw 22/80/443, chaves por `openssl rand -hex 32` sem imprimi-las, compose up, nginx -t, certbot).
- `deploy/CONTEXT.md` ganhou as secoes "Backup diario (Fase 9)" (com a linha "Ultima restauracao provada: —" para 09-18 preencher) e "Evolution API (Fase 9)".

## Task Commits

1. **Task 1: Backup diario cifrado, restauracao no Mac e prova em Docker** - `3f5428d` (feat)
2. **Task 2: Arquivos da Evolution API e secoes do CONTEXT** - `b2b5422` (feat)

**Plan metadata:** commit `docs(09-14)` seguinte a este arquivo.

## Files Created/Modified

- `apps/api/deploy/n1-crm-backup.sh` - backup diario cifrado com contagem antes/depois
- `apps/api/deploy/n1-crm-backup.service` / `.timer` - oneshot diario como `n1crm`
- `apps/api/deploy/instalar-backup.sh` - instalador do root (`--conferir`)
- `apps/api/deploy/restaurar-backup.sh` - restauracao com conferencia de contagem
- `apps/api/deploy/provar-backup.sh` - prova local em Docker
- `apps/api/deploy/evolution/docker-compose.yml`, `evolution.env.example`, `nginx-evolution.conf`, `preparar-vps-evolution.sh` - VPS nova da Evolution
- `apps/api/deploy/CONTEXT.md` - secoes de backup e Evolution

## Decisions Made

- `pg_restore` roda dentro do conteiner descartavel: a versao dele e a da `PG_IMAGEM`. Na prova, o `pg_dump` tambem e o do conteiner `postgres:16` (o do Homebrew aqui e o 18.3, cujo arquivo o `pg_restore` 16 nao abre). Na VPS vale a regra do Pitfall 10, e no Mac o dono ajusta `PG_IMAGEM` ao servidor do Supabase.
- A URL do banco e decomposta em `PG*` no ambiente em vez de ir como argumento do `pg_dump`/`psql` (a VPS e compartilhada e o argv aparece no `ps`).
- `ufw` libera a porta real do `sshd` (`sshd -T`, padrao 22) em vez de depender do perfil `OpenSSH`.
- Tag da Evolution `v2.3.7`: o formato `vX.Y.Z` existe no registro (`2.3.0` sem o `v` nao existe), conferido por `docker manifest inspect`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Credencial do banco fora do argv**
- **Found during:** Task 1 (n1-crm-backup.sh)
- **Issue:** passar `DATABASE_URL_MIGRACAO` como argumento exporia a senha no `ps` de uma VPS compartilhada; `PGDATABASE` com URI nao e expandido pelo libpq (testado).
- **Fix:** o script decompoe a URL em `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` (com decodificacao de `%xx`) e chama `pg_dump`/`psql` sem `--dbname`.
- **Files modified:** apps/api/deploy/n1-crm-backup.sh
- **Verification:** prova 2 confere que a senha nao aparece na saida; backup funciona com o pg_dump do conteiner.
- **Committed in:** 3f5428d

**2. [Rule 1 - Bug evitado] pg_restore do Mac incompativel com o dump**
- **Found during:** Task 1 (desenho da restauracao e da prova)
- **Issue:** `pg_dump`/`pg_restore` do Homebrew (18.3) contra o conteiner `postgres:16` do plano: o `pg_restore` 16 recusa arquivo gerado pelo 18.
- **Fix:** `pg_restore` roda dentro do conteiner (`docker exec -i`), e a prova usa o `pg_dump` do mesmo `postgres:16` por um wrapper de teste; o contrato `PG_DUMP`/`PG_IMAGEM` do plano segue valendo.
- **Files modified:** apps/api/deploy/restaurar-backup.sh, apps/api/deploy/provar-backup.sh
- **Verification:** `provar-backup.sh` exit 0.
- **Committed in:** 3f5428d

**3. [Rule 2 - Missing Critical] Complementos pequenos**
- `restaurar-backup.sh` aceita `NOME_CONTEINER` (para a prova poder nomear e conferir a remocao); `provar-backup.sh` ganhou provas 1 (recusa de pg_dump 15), 4 (intervalo) e 6 (conteiner removido) alem das exigidas; `ufw` usa a porta real do sshd; `preparar-vps-evolution.sh` exige `openssl` e valida o dominio; o `migrar` da prova recebe `DATABASE_URL` **e** `DATABASE_URL_MIGRACAO` locais porque o `.env` do `apps/api` pode apontar a segunda para um banco real, e o `migrar` a prefere.
- **Committed in:** 3f5428d, b2b5422

---

**Total deviations:** 3 grupos auto-corrigidos (1 Rule 1, 2 Rule 2)
**Impact on plan:** nenhum escopo novo; todos reforcam seguranca ou corretude do que o plano pedia.

## Issues Encountered

- `age` e `rclone` nao estao instalados nesta maquina, como previsto: a prova usa substitutos de teste, e os reais ficam para o dono em 09-18. Por isso nenhuma chave `age` foi gerada.
- A existencia da tag `evoapicloud/evolution-api:v2.3.7` foi checada no registro; os nomes das variaveis da Evolution v2 (A11) continuam sem confirmacao oficial.

## Known Stubs

None. `AUTHENTICATION_API_KEY=`, `POSTGRES_PASSWORD=` e `BACKUP_DESTINO=` vazios sao intencionais (o script de preparo ou o dono os preenche) e nao vazam para tela alguma.

## Threat Flags

None. Os pontos de seguranca novos estao todos no `<threat_model>` do plano (T-09-69 a T-09-75).

## User Setup Required

None neste plano. A execucao na VPS de producao, no bucket, no Mac e na VPS da Evolution e do dono em 09-18 e 09-19 (instalar `age`, `rclone` e o cliente do Postgres na versao do servidor; criar `backup.recipient`, `rclone.conf` e `BACKUP_DESTINO`; conferir a tag e as variaveis da Evolution).

## Next Phase Readiness

- Prontos para 09-18/09-19: `instalar-backup.sh`, `restaurar-backup.sh` e `preparar-vps-evolution.sh`, todos com `--conferir` ou prova local.
- Assuncoes que so o dono prova: A5 (`rclone rcat` com chave so de escrita), A6 (`pg_dump` pelo pooler em modo sessao), A11, A12, A13.
- Nenhum processo ou conteiner deste plano ficou rodando.

## Self-Check: PASSED

- Arquivos criados existem (10 de 10, conferidos); commits `3f5428d` e `b2b5422` estao em HEAD.
- `bash apps/api/deploy/provar-backup.sh` exit 0 (6 `ok`, nenhum `FALHOU`); `instalar-backup.sh --conferir` exit 0; `docker compose config -q` e `preparar-vps-evolution.sh --conferir` exit 0; `bash -n` em todos os scripts.
- Criterios de aceitacao: `--no-acl`=2, `server_version_num`=1, `Persistent=true`=1, `User=n1crm`=1, tres servicos `unless-stopped` (yaml), `127.0.0.1:8080:8080`=1, `evolution-api:latest`=0, as tres secoes/linhas no `CONTEXT.md`.
