# Fase 9: Segurança dos dados e base de produção - Mapa de padrões

**Mapeado:** 2026-10-22
**Arquivos analisados:** ~30 (novos/modificados)
**Analogs encontrados:** 24 / ~30 (todos os caminhos abaixo são rastreados pelo git)

## Classificação dos arquivos

| Arquivo novo/modificado | Papel | Fluxo | Analog mais próximo | Qualidade |
|---|---|---|---|---|
| `apps/api/migracoes/009-seguranca-e-cofre.sql` | migração | DDL idempotente | `apps/api/migracoes/008-canais-conversas-mensagens.sql`, `002-registros-colunas-geradas.sql` | exato |
| `apps/api/deploy/conceder-n1-api.sql` | config SQL | DDL idempotente (fora de `migracoes/`) | 008 (`if not exists`) | parcial |
| `apps/api/src/persistencia/conceder-n1-api.cli.ts` | cli | batch | `apps/api/src/persistencia/migrar.cli.ts` | exato |
| `apps/api/src/servicos/cofre.ts` (+ teste) | serviço | transform (cifra/decifra) | `apps/api/src/servicos/limite-de-taxa.ts` (forma: interface + fábrica) | parcial |
| `apps/api/src/observabilidade/{log,sentry}.ts` | utilitário | event-driven | `apps/api/src/observabilidade/metricas.ts` | papel |
| `apps/api/src/seguranca/*.test.ts` | teste | request-response | `apps/api/src/rotas/webhook-meta.test.ts` + `src/testes/banco-crm.ts` | exato |
| inventário de rotas via `onRoute` | teste/util | introspecção | `apps/api/src/app.ts` (~l.153, comentário do `onRoute` do CORS) | parcial |
| `describeComBanco` local-only | util de teste | guard | `apps/api/src/testes/banco-crm.ts` l.22-40 | exato (reusar) |
| `apps/api/deploy/n1-crm-limites.conf` | config nginx | request-response | `apps/api/deploy/nginx-n1-crm-api.conf` | papel |
| `apps/api/deploy/provar-nginx.sh` | script | batch | `apps/api/deploy/preparar-vps.sh` (cabeçalho, `set -euo pipefail`) | papel |
| `apps/api/deploy/n1-crm-backup.{service,timer,sh}` | systemd/script | batch | `apps/api/deploy/n1-crm-api.service`, `instalar-release.sh` | papel |
| `.github/workflows/deploy-api.yml` (job `homologacao`) | CI | batch | o próprio arquivo (job `deploy`) | exato |
| `.github/workflows/check.yml` (job `seguranca`) | CI | batch | o próprio arquivo (job `check`) | exato |
| `packages/dominio/src/derive-visibilidade.ts` (+ `membroVeSessaoDeChat`, `recortarRegistro/Diferenca/Valor`) | domínio | transform | o mesmo arquivo (`filtrarDiferenca`, `membroVeArquivo`) | exato |
| `packages/dominio/src/quem-pode.test.ts` | teste | transform | `packages/dominio/src/derive-visibilidade.test.ts` | exato |
| `packages/dominio/src/url-segura.ts` | utilitário | transform | `derive-visibilidade.ts` (função pura exportada) | papel |
| `apps/web/src/instrumentation{,-client}.ts`, `app/global-error.tsx` | config/componente | event-driven | nenhum (ver "Sem analog") | - |
| `apps/web/src/app/(shell)/ia/layout.tsx` | componente | request-response | `(shell)/layout.tsx` + `assuntosVisiveis` em `features/shell/app-shell.tsx` l.365 | papel |

## Atribuição de padrões

### `apps/api/migracoes/009-seguranca-e-cofre.sql`
**Analog:** `008-canais-conversas-mensagens.sql`. Cabeçalho em comentário (fonte + decisões D-xx que sobrepõem), depois SQL idempotente:
```sql
create schema if not exists plataforma;
create table if not exists plataforma.canais (
  id text not null default gen_random_uuid()::text,
  workspace_id text not null,
  ...
  criado_em timestamptz not null default now(),
```
Regras copiáveis: `workspace_id` em tudo, PK `(workspace_id, id)`, FK composta, `create index if not exists`, trigger de `atualizado_em` reaproveitando `plataforma.crm_toque_atualizado_em()` da 007. Nenhuma migração 001-008 usa `grant/revoke/policy/RLS`: é terreno novo (use RESEARCH "009 — fechar para anon/authenticated/public", l.513-585, e Pitfall 5: a 009 deve ser tolerante a rodar fora do Supabase, p.ex. checar `pg_roles` com `do $$`). A 008 é imutável; a 009 é a próxima.

### `conceder-n1-api.cli.ts`
**Analog:** `apps/api/src/persistencia/migrar.cli.ts`: script top-level com `await`, flag `--seco`, e `await encerrar()` no fim.
```ts
import { encerrar } from "./conexao";
import { migracoesPendentes, migrar } from "./migrar";
if (process.argv.includes("--seco")) { ... }
await encerrar();
```
Ajuste: ler `deploy/conceder-n1-api.sql` e rodar com `DATABASE_URL_MIGRACAO` (Pitfall 9). Registrar o script em `apps/api/package.json` junto de `migrar`.

### Testes de segurança (`apps/api/src/seguranca/`)
**Analog 1 (sem banco, `app.inject`):** `rotas/webhook-meta.test.ts`: `buildApp({ logger: false, ... })` com dependências injetadas, tabela `CANAIS` com `as const`, helper `appCom(...)`, comentário dizendo que o teste nunca depende do `.env`.
**Analog 2 (banco, local-only):** `src/testes/banco-crm.ts`:
```ts
function hostEhLocal(url) { ... host === "localhost" || host === "127.0.0.1" }
export const temBancoCrm = hostEhLocal(process.env.DATABASE_URL);
export const describeComBanco = temBancoCrm ? describe : describe.skip;
export async function prepararBancoCrm() { if (!temBancoCrm) throw ...; await migrar(); }
```
Reusar `describeComBanco` e `prepararBancoCrm` (já existem; o "guard" da fase é importar, não recriar). Convenção de container: `crm-n1-pg-09NN`, porta `556NN`. Os demais testes de banco usam `process.env.DATABASE_URL ? describe : describe.skip` (mais frouxo, produção pode rodar!): NÃO copiar esse; usar o de `banco-crm.ts`. Espaço de Trabalho por teste: `ws_crm_teste_<rótulo>_<8 chars>` (ver helper no mesmo arquivo l.50+). CI roda com `DATABASE_URL: ""` (Pitfall 12), então o job `seguranca` precisa de Postgres de serviço.
**Inventário `onRoute`:** `app.ts` já comenta o uso de `onRoute` pelo CORS (~l.153); registrar `app.addHook("onRoute", ...)` ANTES dos plugins de rota, num `buildApp` de teste, e comparar com uma lista fixa (toda rota nova precisa de classificação pública/autenticada).

### `observabilidade/log.ts` e `sentry.ts`
**Analog:** `src/observabilidade/metricas.ts` (mesmo diretório, módulo utilitário + CONTEXT.md; atualizar `observabilidade/CONTEXT.md`). Fastify: `Fastify({ logger: opcoes.logger ?? false, ...trustProxy })` em `app.ts` l.111: o logger é opção de `buildApp`; manter `false` em testes e passar o logger com `redact` + serializer de URL mascarada em `index.ts`. Conteúdo: RESEARCH "Logger — URL mascarada e redact" l.613 e R2 l.322. `mascararSegredoDeUrl` no domínio (`url-segura.ts`) para web e api compartilharem (regra de camadas: web e api só se unem pelo domínio).

### `servicos/cofre.ts`
**Analog (forma):** `servicos/limite-de-taxa.ts`: doc de módulo explicando a decisão e o limite, `export interface ...` com `readonly`, fábrica `criarX(opcoes)` com dependências injetáveis (`relogio?`), testes com relógio determinístico. Para o cofre: `criarCofre({ chave })`, `cifrar/decifrar` AES-GCM com AAD amarrado à linha (RESEARCH l.585), chave injetável nos testes; estados da chave (Pitfall 13); o segredo some trocando o valor, não apagando a chave (Pitfall 4).

### `deploy/*` (nginx, backup, provar-nginx)
**nginx:** `nginx-n1-crm-api.conf` usa placeholders `__DOMINIO__`/`__PORTA__` substituídos por `preparar-vps.sh`, `access_log`/`error_log` por site, e `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` (a api lê da direita, `TRUST_PROXY=loopback`). `n1-crm-limites.conf` (limit_req_zone, map, log_format) vai em `http {}`, então instalar em `/etc/nginx/conf.d/` como o `preparar-vps.sh` instala o site. Pitfalls 6-8.
**scripts:** cabeçalho de `preparar-vps.sh`/`publicar.sh`: `#!/usr/bin/env bash`, bloco de comentário com uso, `set -euo pipefail`, `: "${VAR:?defina VAR}"`, `trap 'rm -f ...' EXIT`, `AQUI="$(cd "$(dirname "$0")" && pwd)"`, idempotência explícita (`id "$USUARIO" || useradd`, `grep -qF || echo >>`).
**systemd:** copiar `n1-crm-api.service`: `User=n1crm`, `Environment=` com o que é da máquina, e o bloco de endurecimento (`NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectSystem=strict`, `ProtectHome=true`, `ReadWritePaths=`, `LockPersonality=true`). O backup é `Type=oneshot` + `.timer` (`OnCalendar=`, `Persistent=true`); usar `DATABASE_URL_MIGRACAO` (Pitfall 9), `pg_dump` compatível (Pitfall 10), `age`+`rclone` (R7). Atualizar `deploy/CONTEXT.md`.

### Workflows
**`check.yml`:** cabeçalho de comentário longo explicando o que roda e sem o quê; `permissions: contents: read`; `concurrency` por ref; `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: 24`, `cache: npm`), `npm ci`. Job `seguranca`: mesmo esqueleto + `services: postgres` e `DATABASE_URL=postgres://postgres:x@localhost:5432/postgres` (host local, passa no guard `hostEhLocal`).
**`deploy-api.yml`:** `on: workflow_run` do `check` com `if:` de sucesso+push, `environment: production`, `ref: ${{ github.event.workflow_run.head_sha || github.sha }}`, segredos via `env:` (nunca inline). Job `homologacao` em `environment` próprio, antes de `deploy` (`needs:`), com segredos de homologação separados (Pitfall 11: nunca restaurar produção em homologação).

### `derive-visibilidade.ts` (+ funções de recorte)
**Analog:** o próprio arquivo. Padrão: funções puras `(state, memberId, ...)`, doc em PT citando a regra (PRIV-03, POSC-08).
```ts
export function filtrarDiferenca(diferenca: Diferenca, ocultos: ReadonlySet<Id>): Diferenca {
  if (ocultos.size === 0) return diferenca;
  return { gravados: diferenca.gravados.filter((g) => !ocultos.has(g.id)), removidos: ... };
}
export function membroVeArquivo(state, memberId, fileId): boolean { ... }
```
Atenção Pitfall 1: `visibilidadePara` retorna antes (`if (ocultos.size === 0) return { estado: state, ocultos }`) — o recorte novo (`recortarRegistro`, `recortarValor`) deve rodar sobre o resultado inteiro, não depender desse retorno. `membroVeSessaoDeChat` segue a forma de `membroVeArquivo`. Exportar por `packages/dominio/src/index.ts`/subpaths como os vizinhos.

### `quem-pode.test.ts`
**Analog:** `derive-visibilidade.test.ts`: comentário de abertura com o ID da regra; `let state; beforeEach(() => { state = buildSeed(); })`; helpers que PROCURAM no seed um Membro com a propriedade (`semGestao()`), lançando erro claro se o seed não tiver; `describe`/`it` em PT. Importar `buildSeed` de `./seed` e `CP` de `./operations/financeiro-base`.

### `apps/web/src/app/(shell)/ia/layout.tsx`
Existe `(shell)/layout.tsx` e `/ia/{agentes,aprovacoes,automacoes,chat,...}` sem layout próprio. Para saber o papel do Membro: `useData((d) => d.workspace.name)`/`useData((c) => c)` e `memberId` como em `app-shell.tsx` l.355-365; o gate do item de menu é `ASSUNTOS.filter((a) => a.chave !== "financeiro" || vePastaFinanceiro(data, memberId))` com o comentário "o item some, nunca aparece desativado; quem decide de verdade é o 403 do apps/api". Copiar esse espírito: o layout é cosmético, o servidor é a barreira. Texto "Sem acesso" existe só como valor de célula em `paineis/[painel]/page.tsx` l.264 (`{semAcesso ? "Sem acesso" : "—"}`): não há página "Sem acesso" para copiar; usar RESEARCH l.659. Como `ia/layout.tsx` usa hooks, é `"use client"` (ou componente cliente filho). Ler `node_modules/next/dist/docs/` antes (AGENTS.md: Next 16 difere).

## Padrões compartilhados
- **Comentários e UI em português**, cabeçalho de módulo explicando o porquê e a decisão (D-xx / Pitfall).
- **Regra de camadas:** lógica compartilhada web/api (recorte, máscara de URL) só no `packages/dominio`; nunca import entre `apps/web` e `apps/api`.
- **Testes de banco só em Postgres local** (`describeComBanco` de `testes/banco-crm.ts`); CI com `DATABASE_URL` vazia pula.
- **Migrações:** idempotentes, numeradas, as aplicadas são imutáveis; conferir com `npm run migrar -w @n1/api -- --seco`.
- **Segredos:** injetados por `env:`/ambiente, nunca em log; `carregarEnv()` não sobrescreve o que já está no ambiente (por isso o `.service` fixa o que é da máquina).
- **Fastify:** `buildApp({ logger:false, ...opções injetáveis })` para testar com `app.inject`.

## Sem analog
| Arquivo | Papel | Motivo |
|---|---|---|
| `apps/web/src/instrumentation.ts`, `instrumentation-client.ts`, `app/global-error.tsx` | config/componente | nenhum Sentry/instrumentation no repo; seguir RESEARCH R2 (l.322) e a doc do Next 16 em `node_modules/next/dist/docs/` |
| `provar-nginx.sh` (Docker) | script | não há provas em Docker hoje; RESEARCH Pattern 4 e "nginx — arquivos provados em Docker" l.634 |
| Cifra do cofre / RLS / grants | serviço/SQL | nenhuma migração existente usa grant/RLS; RESEARCH l.513-613 |
| Página "Sem acesso" | componente | só existe o texto em célula de painel |

## Metadados
**Escopo da busca:** `apps/api/{migracoes,deploy,src}`, `.github/workflows`, `packages/dominio/src`, `apps/web/src/{app,features/shell}`
**Verificação de rastreio:** `git ls-files` confirmou que `apps/api/deploy/*` e `apps/web/src/app` são rastreados; nenhum caminho de espelho gitignored é citado.
**Data:** 2026-10-22
