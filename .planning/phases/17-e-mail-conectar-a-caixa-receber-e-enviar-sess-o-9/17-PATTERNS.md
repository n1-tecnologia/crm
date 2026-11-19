# Fase 17: E-mail (Sessão 9) - Mapa de padrões

**Mapeado:** 2026-11-19
**Arquivos analisados:** ~30 (novos e modificados)
**Analogs encontrados:** 28 / 30 (todos os caminhos conferidos com `git ls-files`; nenhum é espelho gitignored)

Camadas (ver `CONTEXT.md` da raiz): `dominio` não depende de nada; `web` e `api` só conhecem o domínio. Comece pelo domínio e desça.

## Classificação dos arquivos

| Arquivo novo/modificado | Papel | Fluxo | Analog mais próximo | Qualidade |
|---|---|---|---|---|
| `packages/dominio/src/crm/fio-de-email.ts` (`mensagemRespondida`, filtros D-17-11) | utilitário (regra pura) | transform | `packages/dominio/src/crm/recebimento.ts` (`destinoDaRecebida`, l.71-81) + `.test.ts` | role-match |
| `packages/dominio/src/crm/mensagens.ts` (modif.: `NovaMensagem` + assunto/cópias) | modelo | request-response | o próprio arquivo (`EnderecoAdicional` l.75, `NovaMensagem` l.135, `validarNovaMensagem` l.156) | exato |
| `packages/dominio/src/crm/recebimento.ts` (modif.: `RecebidaDoProvedor` + `enderecosAdicionais`) | modelo | transform | o próprio arquivo (l.33-50; já tem `assunto`) | exato |
| `apps/api/migracoes/017-email.sql` | migração | CRUD | `apps/api/migracoes/014-instagram.sql` (015 e 016 para variações) | exato |
| `.../provedores/email/estado.ts` (HMAC + PKCE) | utilitário | transform | `instagram/estado.ts` | exato |
| `.../email/token.ts` (renovação preguiçosa) | serviço | request-response | `instagram/token.ts` | exato |
| `.../email/repositorio.ts` (`email_contas`, cursor, `esquecerConta`) | repositório | CRUD | `instagram/repositorio.ts` l.72-96 | exato |
| `.../email/conexao.ts` (senha, OAuth, desconectar) | serviço | request-response | `instagram/conexao.ts` (OAuth) e `whatsapp-cloud/conexao.ts` (formulário) | exato |
| `.../email/oauth/{google,microsoft}.ts` | serviço | request-response | `instagram/cliente.ts` (+ `cliente.test.ts`) | role-match |
| `.../email/entrada.ts` (INSERT na fila) | serviço | event-driven | `instagram/entrada.ts` l.84-96 | exato |
| `.../email/provedor.ts`, `do-ambiente.ts` | provedor | request-response | `instagram/provedor.ts`, `instagram/do-ambiente.ts` | exato |
| `.../email/traduzir.ts` | utilitário | transform | `whatsapp-cloud/traduzir.ts` (+ `traduzir.test.ts`), `evolution/traduzir.ts` | exato |
| `.../email/leitor.ts` (supervisor + sessão IMAP por Canal) | worker | streaming/event-driven | `mensageria/coleta-de-orfaos.ts` (trava, `iniciar/parar`) + `evolution/conferencia.ts` + `ouvinte-pg.ts` | parcial |
| `.../email/rede.ts`, `fabrica-de-conexao.ts`, `erros.ts`, `html.ts` | utilitário | transform | nenhum | sem analog |
| `apps/api/src/rotas/crm/email.ts` | rota | request-response | `rotas/crm/instagram.ts` (3 rotas) e `rotas/crm/whatsapp-oficial.ts` | exato |
| `apps/api/src/index.ts` (modif.: `EMAIL_LEITOR_ATIVO`) | config | event-driven | `index.ts` l.300-339 | exato |
| `apps/api/src/mensageria/registro.ts` (modif.: registrar `email-imap-smtp`) | config | - | o próprio arquivo l.39-91 | exato |
| `apps/api/src/mensageria/contrato-do-provedor.ts` (modif.: `semWebhook`) | teste | - | o próprio arquivo l.30-167 | exato |
| `apps/api/src/mensageria/entregar-mensagem.ts` (modif.: assunto/cópias/fio) | serviço | request-response | o próprio arquivo l.221-243, 318-327 | exato |
| `apps/api/src/servicos/crm/recebimento.ts` (modif.: `mensagemRespondida`, `enderecosAdicionais`) | serviço | CRUD | o próprio arquivo l.161-345 | exato |
| `apps/api/src/servicos/crm/canais.ts` (modif.: ganchos l.234 e l.386) | serviço | CRUD | o próprio arquivo | exato |
| `apps/api/src/rotas/crm/mensagens.ts` (modif.: `NOVA_MENSAGEM` l.49) | rota | request-response | o próprio arquivo | exato |
| `apps/web/.../canais/email/retorno/page.tsx` | componente (página) | request-response | `.../canais/instagram/retorno/page.tsx` + `retorno-do-instagram.test.tsx` | exato |
| `apps/web/src/features/crm/conectar-canal.ts` (trocar `espacoReservado`, ~l.68) | config | - | o próprio arquivo | exato |
| `apps/web/src/features/crm/conectar-provedor.tsx` (formulário IMAP/SMTP) | componente | request-response | o próprio arquivo + `conectar-provedor.test.tsx` | exato |
| `apps/web/src/features/crm/conversation-thread.tsx` (assunto/cópias, ~l.1437) | componente | request-response | o próprio arquivo | exato |
| `apps/web/src/dados/crm/canais.ts` (chamadas `autorizar`/`concluir` de e-mail) | serviço (HTTP) | request-response | `concluirConexaoDoInstagram` no mesmo arquivo | exato |
| testes e dublês do e-mail (IMAP/SMTP falsos) | teste | - | `apps/api/src/testes/servidor-falso.ts`, `armazenamento-falso.ts`, `relogio.ts`, `provedores/instagram/provedor.test.ts` | parcial |

## Atribuições de padrões

### `017-email.sql` (migração, CRUD)
**Analog:** `apps/api/migracoes/014-instagram.sql`
Cabeçalho em pt-BR explicando decisões; sem `grant` (a 009 concede por `alter default privileges`); idempotente; trigger `crm_toque_atualizado_em`; credencial NÃO na tabela (vai ao cofre `plataforma.credenciais`, `tipo` = nome do provedor `email-imap-smtp`, o que `canalParaProvedor` lê).
```sql
create table if not exists plataforma.instagram_contas (
  workspace_id   text        not null,
  canal_id       text        not null,
  ...
  atualizado_em  timestamptz not null default now(),
  primary key (workspace_id, canal_id),
  foreign key (workspace_id, canal_id) references plataforma.canais (workspace_id, id) on delete cascade,
  constraint instagram_contas_conta_ck check (length(btrim(conta_id)) > 0)
);
create unique index if not exists instagram_contas_conta_uq on plataforma.instagram_contas (conta_id);
drop trigger if exists instagram_contas_atualizado_em on plataforma.instagram_contas;
create trigger instagram_contas_atualizado_em before update on plataforma.instagram_contas
  for each row execute function plataforma.crm_toque_atualizado_em();
```
Copiar também (l.1-36) o estilo de comentário e o bloco final que desliga RLS (ver o fim de 014). A 017 é a próxima (a 016 é a última). Dado pessoal de terceiros nunca vai a log.

### `email/estado.ts` (utilitário, transform)
**Analog:** `instagram/estado.ts` l.15-75. Copiar com prefixo próprio (`n1/email/estado:`) e chave por serviço (Google/Microsoft) e campo `s`; PKCE derivado (RESEARCH).
```typescript
const PREFIXO = "n1/instagram/estado:";
function assinatura(segredo: string, dados: string): Buffer {
  return createHmac("sha256", segredo).update(PREFIXO + dados).digest();
}
// lerEstado: forma `<dados>.<assinatura>` base64url, timingSafeEqual, `undefined` sem dizer o motivo, validade 10 min
```

### `email/token.ts` (serviço)
**Analog:** `instagram/token.ts` l.69-148: união `TokenParaUsar` (`ok:true|false` com `codigo`), porta `tokenParaUsar(canal)`, `tokensSoDaCredencial` para testes sem banco, `criarTokensPg` + `gravarRenovada` em transação própria (renovação concorrente esbarra em `credenciais_ativa_unica`: desfaz e segue com o token atual). Aqui com `refreshToken`.

### `email/repositorio.ts`
**Analog:** `instagram/repositorio.ts` l.72-96. Molde de `gravarConta` (upsert por `(workspace_id, canal_id)`) e `esquecerConta` (apaga tabelas do provedor e a credencial `dono_tipo='canal'` do cofre, não só revoga):
```typescript
await cliente.query(
  "delete from plataforma.credenciais where workspace_id = $1 and dono_tipo = 'canal' and dono_id = $2 and tipo = $3",
  [workspaceId, canalId, TIPO_DA_CREDENCIAL],
);
```
`esquecerConta` do e-mail também apaga o cursor.

### `email/entrada.ts` (fila de entrada)
**Analog:** `instagram/entrada.ts` l.84-96 (mesmo SQL em `whatsapp-cloud/entrada.ts:89` e `rotas/webhooks-de-mensageria.ts:155-160`). Um item por linha, dedupe por `chave`:
```typescript
const chave = provedor.chaveDaChamada?.(corpo) ?? null;
const r = await pool().query(
  `insert into plataforma.webhooks_recebidos (workspace_id, canal_id, provedor, chave, corpo)
   values ($1, $2, $3, $4, $5::jsonb)
   on conflict (workspace_id, canal_id, chave) where chave is not null do nothing`,
  [conta.workspaceId, canal.id, provedor.provedor, chave, JSON.stringify(corpo)],
);
if ((r.rowCount ?? 0) > 0) guardadas += 1; else repetidas += 1;
```
Diferença: não há `verificarChamada` (é o leitor quem insere) → por isso `semWebhook` no contrato de teste.

### `email/conexao.ts` (conectar por senha e por OAuth)
**Analog:** OAuth: `instagram/conexao.ts` l.139-244 (`iniciar`/`concluir`) e `:124-137` (`marcarComErro`); formulário/senha: `whatsapp-cloud/conexao.ts` (senha só passa pelo corpo e vai ao cofre). Estado do Canal por `mensageria/aplicar-conexao.ts` (`aplicarConexaoAoCanal`). A conexão por senha usa `rede.ts` (D-17-07).

### `email/provedor.ts`, `do-ambiente.ts`
**Analog:** `instagram/provedor.ts` e `instagram/do-ambiente.ts`; implementa `ProvedorDeMensageria` (`mensageria/provedor.ts:110-137`), `EnvioAoProvedor` (:67-91), `ResultadoDoEnvio` (:94-102), `ErroDeProvedor` (:152-160). Registro em `mensageria/registro.ts:39-55`.

### `email/traduzir.ts`
**Analog:** `whatsapp-cloud/traduzir.ts` / `evolution/traduzir.ts` (+ `exemplos/*.json` e `traduzir.test.ts` com amostras reais). MIME interpretado → `RecebidaDoProvedor` (`packages/dominio/src/crm/recebimento.ts:33-50`: `idExterno`, `criadoEm` ISO do provedor, `remetente`, `conteudo`, `anexos`, `emRespostaAIdExterno`, `assunto`, `cargaBruta`).

### `email/leitor.ts` (worker; parcial)
**Analog:** `mensageria/coleta-de-orfaos.ts` l.122-144 (trava consultiva de sessão, no cliente que a pegou) e ciclo `iniciar()/parar()`/`emVoo`; `evolution/conferencia.ts:157` e `ouvinte-pg.ts` para conexão longa e reconexão.
```typescript
const cliente = await pool().connect();
try {
  const { rows } = await cliente.query<{ ok: boolean }>("select pg_try_advisory_lock(hashtext($1)) as ok", [CHAVE_DA_TRAVA]);
  if (!rows[0]?.ok) return NADA;
  try { /* trabalho */ } finally { await cliente.query("select pg_advisory_unlock(hashtext($1))", [CHAVE_DA_TRAVA]); }
} finally { cliente.release(); }
```
Atenção: a trava de sessão vive só na conexão que a pegou; um leitor de longa duração deve segurá-la numa conexão dedicada (achado F5 do RESEARCH). Sem analog de IDLE/IMAP: usar o RESEARCH (Pattern 1 e seguintes).

### `apps/api/src/index.ts` (flag do leitor)
**Analog:** l.300-339. Env opt-in, `registrar` via `app.log`, `aoEncerrar`:
```typescript
if (process.env.COLETA_DE_ORFAOS_ATIVA === "true") {
  const coleta = criarColetaDeOrfaos({ registrar: (nivel, mensagem, dados) => { app.log[nivel](dados ?? {}, mensagem); } });
  coleta.iniciar();
  aoEncerrar(() => coleta.parar());
  app.log.info("coleta de órfãos ativa");
}
```
Novo: `EMAIL_LEITOR_ATIVO` (a unidade de produção fixa em `false` até o dono publicar).

### `rotas/crm/email.ts`
**Analog:** `rotas/crm/instagram.ts` inteiro (41 linhas): rota fina, sem SQL nem regra, zod `.strict()`, `PARAMS_ID` e `responder` de `./comum`.
```typescript
export async function rotasDoInstagram(app: FastifyInstance, opcoes: { readonly servico: ServicoDeConexaoDoInstagram }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  rotas.post("/canais/:id/instagram/autorizar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.iniciar(request.membro, request.params.id)));
  rotas.post("/canais/instagram/concluir", { schema: { body: CONCLUSAO } }, async (request, reply) =>
    responder(reply, await servico.concluir(request.membro, request.body)));
}
```
Rota de conexão por senha: molde `rotas/crm/whatsapp-oficial.ts` (`POST /canais/:id/whatsapp-oficial/conectar`).

### Domínio: `fio-de-email.ts`, `mensagens.ts`, `recebimento.ts`
`fio-de-email.ts`: funções puras com teste ao lado, estilo de `destinoDaRecebida` (entrada tipada, sem I/O, `agora` injetado):
```typescript
export function destinoDaRecebida(entrada: EntradaDoDestino): DestinoDaRecebida {
  const { aberta, ultimaResolvida, janelaDeReaberturaHoras, agora } = entrada;
  if (aberta) return { acao: "usar", ... };
  ...
}
```
`mensagens.ts`: `NovaMensagem` (l.135-149) já tem o padrão de campos opcionais `readonly x?: T | undefined` (ex.: `modeloId`) — adicionar `assunto` e cópias reusando `EnderecoAdicional` (l.75-79, `tipo: "para"|"copia"|"copiaOculta"`) e validar em `validarNovaMensagem` (l.156, `fail("mensagem", "campo")`). Capacidades já prontas: `capacidades.ts:132-146` (`email`, `foraDaJanela: "livre"`, `hasSubjectAndCopies: true`). Normalização: `normalizacao.ts:51` `normalizarEmail`, `:154` `case "email"`.

### Web: `email/retorno/page.tsx`
**Analog:** `.../instagram/retorno/page.tsx` (`"use client"`, `Suspense`, `useSearchParams`, `canalDoState` que só lê o `c` do state para o link de volta e quem confere é a api, `useRehidratar`, `ErroDeApi`, `PageHeader`/`CorpoDeTela`/`EmptyState` de `@/features/shell/ui`):
```typescript
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { concluirConexaoDoInstagram } from "@/dados/crm/canais";
import { useRehidratar } from "@/dados/store";
import { CorpoDeTela, EmptyState, PageHeader } from "@/features/shell/ui";
const CANAIS = "/crm/caixa-de-entrada/configuracoes";
```
Segmento estático `email` vence o `[canal]` vizinho. Teste: `retorno-do-instagram.test.tsx`. AGENTS.md: ler `node_modules/next/dist/docs/` antes de escrever código Next.

### Web: `conectar-canal.ts`
Trocar o `espacoReservado` da chave `"email-imap-smtp"` (l.~64-72) pelo formulário real; molde de outros provedores na mesma tabela e `conectar-provedor.tsx`.

## Padrões compartilhados

- **Credencial no cofre, nunca em log/resposta/erro:** `plataforma.credenciais` (009), `tipo` = nome do provedor; apagar ao desconectar/arquivar (`esquecerConta`; ganchos em `servicos/crm/canais.ts:234` e `:386`).
- **Entrada pela fila + `receberMensagem`:** mesma tubulação de `processador-de-entrada.ts:283-372`; Contato/Conversa/Mensagem por `servicos/crm/recebimento.ts:161-345`.
- **Saída pelo outbox `mensagem.enviar.v1`:** `entregar-mensagem.ts:105-329`; resposta ambígua nunca é reenviada sozinha.
- **Rota fina:** sem SQL e sem regra (`apps/api/src/rotas/CONTEXT.md`); membro vem de `request.membro`.
- **Registro de log:** `registrar(nivel, mensagem, dados)` só com contagens, nunca endereços/corpos.
- **Testes:** contrato `mensageria/contrato-do-provedor.ts` (estender com `semWebhook`); dublês em `apps/api/src/testes/` (`servidor-falso.ts`, `armazenamento-falso.ts`, `relogio.ts`); `exemplos/*.json` de payload por provedor.
- **Cada provedor tem `CONTEXT.md`** (`instagram/CONTEXT.md`, `whatsapp-cloud/CONTEXT.md`): criar `email/CONTEXT.md` e atualizar o `CONTEXT.md` da raiz.
- **Migração aplicada é imutável:** ajuste vira `018`.

## Sem analog

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| `email/rede.ts` (guarda de rede, BlockList) | utilitário | transform | Nenhum guarda SSRF existe; usar Pattern 1 do RESEARCH (l.200-238) |
| `email/fabrica-de-conexao.ts`, `erros.ts` | utilitário | transform | Nenhum cliente IMAP/SMTP; RESEARCH |
| `email/html.ts` (sanitize-html) | utilitário | transform | Sem sanitização de HTML hoje |
| IMAP/SMTP falsos de teste | teste | event-driven | Só `servidor-falso.ts` (HTTP); RESEARCH sugere `imapkit`/`smtp-server`/GreenMail |

## Metadados

**Escopo de busca:** `apps/api/src/mensageria`, `apps/api/src/rotas/crm`, `apps/api/src/servicos/crm`, `apps/api/migracoes`, `packages/dominio/src/crm`, `apps/web/src/features/crm`, `apps/web/src/app/(shell)/crm`
**Linhas de RESEARCH usadas:** "Reuse Map" (l.571-598) e Pattern 1; caminhos antigos do plano de tarefas envelheceram (`NOVA_MENSAGEM` agora em `rotas/crm/mensagens.ts:49`, `abertaDoPar` em `repositorios/crm/conversas.ts:182`).
**Data:** 2026-11-19
