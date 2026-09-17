# apps/api — o backend

Ler primeiro: [`CONTEXT.md`](./CONTEXT.md) (a arquitetura) e
[`../../CONTEXT.md`](../../CONTEXT.md) (o mapa das camadas do monorepo).
Este arquivo é o roteiro operacional: como subir, preparar o banco e rodar
os testes — não repete o que já está documentado lá.

## 1. Subir

Da raiz do monorepo:

```
npm run dev
```

Sobe `apps/web` (porta 3001) e `apps/api` (porta 3002) juntos. Para subir só
o backend: `npm run dev -w @n1/api`.

Variáveis de ambiente: copie `apps/api/.env.example` para `apps/api/.env` e
preencha com os valores do projeto Supabase (`DATABASE_URL`, `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`). O arquivo `.env` nunca é commitado — só o
`.env.example`, com os nomes das variáveis, sem valor real. O mesmo vale
para `apps/web/.env.local.example` (`NEXT_PUBLIC_API_URL`, `API_URL`).

## 2. Preparar o banco

Nesta ordem, uma vez por banco novo:

```
npm run migrar -w @n1/api          # aplica as migrações numeradas (schema plataforma)
npm run usuarios:seed -w @n1/api   # cria as contas de teste <nome>@n1.teste no Supabase Auth
npm run bootstrap:gestao -w @n1/api # materializa o Espaço "Gestão" › Financeiro, com a Maryane
```

`npm run migrar` é idempotente: aplica só as migrações que faltam, registradas
em `apps/api/migracoes/`, e nunca reescreve uma já aplicada. `bootstrap:gestao`
também é idempotente: só grava em Espaço de Trabalho vazio — rodar de novo
sobre um Espaço com dado real não sobrescreve nada (ver
`apps/api/src/bootstrap/CONTEXT.md`).

## 3. Rodar os testes

```
npm run test -w @n1/api
```

Sem `DATABASE_URL` definida, todo teste de integração (persistência, rotas,
bootstrap, e2e) pula — só os testes que não tocam banco rodam (D-DEC-09). Com
`DATABASE_URL` (e, para os que falam com o Supabase Auth, `SUPABASE_URL` +
`SUPABASE_SECRET_KEY`) definidas em `apps/api/.env` ou no ambiente, os testes
de integração rodam de verdade contra o Postgres do projeto — inclusive
`src/e2e/criar-conta.test.ts`, o cenário ponta a ponta do critério 1 da Fase 1
(ver `src/e2e/CONTEXT.md`). `npm run check` (raiz) roda os três workspaces:
typecheck, lint, tokens e testes.

## 4. Exportar o ClickUp (Fase 0, PREP-02)

Insumo da importação das Fases 2/3 e prova de paridade (CON-09) — nada disto
grava no Postgres da plataforma.

**Pré-requisito:** `CLICKUP_API_TOKEN` em `apps/api/.env` — um token pessoal
gerado em ClickUp › Configurações › Apps › API Token. Nunca commitado (o
`.gitignore` já cobre `.env*`); `apps/api/.env.example` documenta só o nome
da variável, sem valor.

**Comando:**

```
npm run exportar:clickup -w @n1/api
```

Flags (`--chave=valor` ou booleanas, sem biblioteca de parsing):

- `--lista=<id>` — repetível; default as 3 Listas do Financeiro (Solicitação,
  Contas a pagar, Contas a receber)
- `--amostra=<n>` — limita a `n` Tarefas por Lista; o manifesto sai marcado
  `amostra: true` (não é prova de paridade)
- `--sem-anexos` — pula o download de anexos
- `--sem-time-in-status` — pula o `time_in_status` por Tarefa
- `--pasta=<dir>` — muda a pasta de destino (default
  `apps/api/exportacoes/clickup/`)
- `--so-manifesto` — não exporta nada; só regenera `MANIFESTO.md`/`.json` a
  partir do que já está em disco (não precisa de token)

**O que esperar:** as três Listas completas levam de 1 a 2 horas (rate limit
de 100 requisições/minuto do ClickUp) — a execução real do Plan 00-05 levou
2h01m35s para 11.000 requisições, sem interrupção. Rode em segundo plano e
acompanhe o progresso em `apps/api/exportacoes/clickup/exportacao.log`. Pode
interromper a qualquer momento (`Ctrl+C`) e rodar o mesmo comando de novo: o
próprio disco é o checkpoint — só o que falta é pedido de novo, nada é
duplicado nem baixado duas vezes.

**Onde fica o quê:** `apps/api/exportacoes/clickup/` (Tarefas, Campos,
Comentários, `time_in_status`, anexos, um arquivo por recurso/página) fica
**fora do git** — dado pessoal e financeiro (LGPD), o backup dessa pasta é
responsabilidade do dono. Só `apps/api/exportacoes/MANIFESTO.md` e
`MANIFESTO.json` são versionados: contagens por Lista/recurso, hash sha256
por arquivo e um hash agregado — a prova de paridade, sem PII.

**Ressalva de histórico de status:** a API pública do ClickUp não expõe uma
trilha cronológica de mudança de status. O que a exportação grava é
`time_in_status` — tempo acumulado por status, disponível só quando o
ClickApp "Total time in Status" está ligado no Workspace (confirmado ligado
nesta exportação) — mais os Comentários datados. Nenhum dos dois é um
histórico de transições evento a evento.

Para conferir a que e-mail um ClickUp user id corresponde:

```
npm run clickup:usuarios -w @n1/api -- <id> [<id> ...]
```

Para re-exportar do zero, apague a pasta (ou aponte `--pasta` para uma nova)
e rode `exportar:clickup` de novo — o manifesto regenerado substitui o
anterior no próximo commit.

## 5. Contrato HTTP

- `GET /saude` — pública, sem token; confirma que o processo está no ar.
- `GET /estado` — carga inicial do Espaço de Trabalho: `DataState` inteiro,
  revisão, ordens e o Membro da sessão (`Authorization: Bearer <token>`).
- `POST /operacoes/:nome` — uma rota por operação do domínio (despacho pela
  allowlist `OPERACOES`), `{ args: unknown[] }` no corpo; devolve o
  `OperationResult` (mesmo quando `ok:false`, sempre 200) mais o diff e a
  revisão nova (`Authorization: Bearer <token>`).

## 6. PERS-08 — onde o `apps/api` roda: bloqueado por D11

**Ainda não decidido.** A recomendação do plano de migração é a mesma VPS
que já roda o `automation/` (financeiro-tria), atrás da nginx existente —
mas essa decisão (D11) precisa ser tomada em conjunto com OQ-ADR-01 (a
região do projeto Supabase: a latência medida hoje é de um notebook no
Brasil até `us-west-2`, ~234 ms por ida e volta, e o `apps/api` não vai
rodar num notebook). Até D11 e OQ-ADR-01 serem resolvidas, o processo roda
localmente em `127.0.0.1:3002` — é o que este README documenta, nada além
disso. PERS-08 não bloqueia o código desta fase; bloqueia o adapter da Fase
2 apontar de verdade para o `apps/api`.

Pré-requisitos já conhecidos para quando o deploy acontecer — a resolver
**junto com D11**, não neste README:

- Fixar a CA do Supabase e trocar `rejectUnauthorized: false` por `true` em
  `src/persistencia/conexao.ts` (hoje a verificação da cadeia TLS está
  desligada porque o Node não conhece a CA da conexão direta do Supabase —
  ver o comentário no próprio arquivo; o tráfego já é cifrado, só a
  identidade do servidor não é verificada).
- `HOST=0.0.0.0` só faz sentido atrás de um proxy reverso — nunca exposto
  direto.
- `WEB_ORIGIN` precisa ser a origem pública de `apps/web` (o CORS é por
  allowlist explícita, nunca `*`).
- `apps/web` precisa de `NEXT_PUBLIC_API_URL`/`API_URL` apontando para o
  endereço público do `apps/api`, não mais `localhost:3002`.

Nenhum comando de deploy vive neste arquivo — quando D11 for decidida, o
roteiro de deploy nasce onde a decisão nascer.
