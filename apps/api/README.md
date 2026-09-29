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

## 5. O scheduler de Automações (AUTO-01, Plan 03-08)

`AUTOMACOES_WORKER_ATIVO=true` liga o poller que garante ao menos uma
chamada de `runScheduledAutomations` por (Espaço de Trabalho, Lista, dia
civil) — o relógio do motor de Automações (ver
`apps/api/src/automacoes/CONTEXT.md`). "false" no ambiente local, no molde
do `OUTBOX_WORKER_ATIVO`.

A primeira volta REAL de cada (Espaço, Lista) roda em **ensaio**: mede o que
a agenda faria (as contagens ficam em `plataforma.automacao_agenda`,
`last_error_code = 'ENSAIO_PRIMEIRA_VOLTA'`) e não grava nada — nenhum
Comentário de cobrança, nenhuma invocação do Agente, nenhuma mudança de
Status. Depois de conferir que o relato é aceitável, libere com:

```
npm run automacoes:liberar -w @n1/api -- <workspaceId> <listId>
```

A volta seguinte processa de verdade. `AUTOMACOES_ENSAIO_PRIMEIRA_VOLTA=false`
desliga o gate inteiro — só para uma Lista que nasce sem backlog.

## 5b. A ponte do Agente de lançamento (Contas a pagar, Plan 03-11 e 06-03)

`AGENTE_CONTAS_A_PAGAR_ATIVO=true` liga a ponte que publica o Resumo para
conferência e lança no Omie pelo `automation/` (ver
`apps/api/src/automacoes/CONTEXT.md`, "Os dois momentos da ponte"). Exige
`AGENTE_CONTAS_A_PAGAR_URL`, `PLATAFORMA_LANCAMENTO_TOKEN`,
`AGENTE_CONTAS_A_PAGAR_ESPACO_ID` e `AGENTE_CONTAS_A_PAGAR_LISTA_ID`.

| Variável | Valores (padrão primeiro) | O que decide |
|---|---|---|
| `AGENTE_CONTAS_A_PAGAR_MODO` | `ensaio` \| `conferencia` \| `lancar` | D6-11 — `ensaio`: só `/resolver` e log; `conferencia`: Resumos, conferências e revisões, **zero** `/lancar`; `lancar`: tudo. Só os literais exatos; outro valor cai em `ensaio` com aviso. |
| `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE` | `para-pagar` \| `em-lancamento-omie` | D6-01 — o Resumo aparece assim que a conta fica completa, ou só ao entrar em "em lançamento omie". |
| `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO` | `true` \| `false` | D6-02 — "ok" de um revisor no fio vale como conferência; `false`: só o clique confere (o fio continua pedindo ajuste). |
| `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL` | `nao-encosta` \| `sem-conferencia` | D6-04 — conta Manual: o Agente não encosta; ou Resumo com a Conferência dispensada e lançamento. |
| `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM` | vazio \| texto | G2, **só ambiente de teste** — os dois momentos só olham contas cujo título contém o texto (exato, maiúsculas contam). Produção: vazio. |
| `AGENTE_CONTAS_A_PAGAR_AVISAR_ID` | vazio \| id de Membro | G3, **só ambiente de teste** — toda Menção da ponte vai a esse Membro no lugar do Financeiro (se for Membro ativo; senão, aviso e a regra de sempre). Produção: vazio. |
| `AGENTE_CONTAS_A_PAGAR_INTERVALO_MS` | `900000` | O relógio entre ciclos; uma gravação numa conta cutuca a ponte em até 2 s (D6-12). |
| `AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA` | vazio \| JSON | O CNPJ da Empresa no texto da A5. |

Contas importadas do ClickUp só entram na ponte depois de um movimento de
Status feito na plataforma (G1) — o backlog importado nunca é varrido.

## 6. Contrato HTTP

- `GET /saude` — pública, sem token; confirma que o processo está no ar.
- `GET /estado` — carga inicial do Espaço de Trabalho: `DataState` inteiro,
  revisão, ordens e o Membro da sessão (`Authorization: Bearer <token>`).
- `POST /operacoes/:nome` — uma rota por operação do domínio (despacho pela
  allowlist `OPERACOES`), `{ args: unknown[] }` no corpo; devolve o
  `OperationResult` (mesmo quando `ok:false`, sempre 200) mais o diff e a
  revisão nova (`Authorization: Bearer <token>`).

## 7. PERS-08 — onde o `apps/api` roda: região decidida, VPS pendente

Ver [`docs/08-migracao-financeiro/05-topologia-e-regiao.md`](../../docs/08-migracao-financeiro/05-topologia-e-regiao.md)
(Plan 02-15) para a topologia completa, a decisão de região com data e
justificativa, o runbook de publicação e a tabela de medições.

**O que já está resolvido:** OQ-ADR-01 (a região do projeto Supabase) —
a decisão foi `permanecer-medindo`: o projeto continua em `us-west-2`
(Oregon), registrada em 2026-09-25. A CA do Supabase está fixada em
`src/persistencia/conexao.ts` (`construirSsl()`, `rejectUnauthorized: true`
no caminho padrão) — o blocker de TLS que este README documentava está
fechado no código.

**O que continua pendente (D11 — publicar o `apps/api` na VPS):** a
recomendação do plano de migração é a mesma VPS que já roda o `automation/`
(financeiro-tria), atrás da nginx existente. Até D11 ser executada, o
processo roda localmente em `127.0.0.1:3002` — é o que este README
documenta, nada além disso. PERS-08 não bloqueia o código desta fase;
bloqueia o adapter da Fase 2 apontar de verdade para o `apps/api` em
produção.

Pré-requisitos conhecidos para quando o deploy acontecer — o runbook exato
está no documento de topologia, não aqui:

- `DATABASE_CA_CERT` (ou `DATABASE_CA_PATH`) precisa estar definida no
  ambiente da VPS com a CA real do Supabase — sem isso a conexão remota
  falha por desenho (é o comportamento novo de `construirSsl()`, não um
  bug).
- `HOST=0.0.0.0` só faz sentido atrás de um proxy reverso — nunca exposto
  direto.
- `WEB_ORIGIN` precisa ser a origem pública de `apps/web` (o CORS é por
  allowlist explícita, nunca `*`).
- `apps/web` precisa de `NEXT_PUBLIC_API_URL`/`API_URL` apontando para o
  endereço público do `apps/api`, não mais `localhost:3002`.
- `DATABASE_QUERY_TIMEOUT_MS` (opcional, padrão 30000): o tempo máximo de uma
  consulta, e o mesmo prazo para o Postgres encerrar uma transação largada
  (`limitesDoPool` e `inicioDaTransacao`). Sem ele, uma conexão que o pooler
  derruba no meio só era notada quando o TCP desistia — em 2026-09-29, 16 e 10
  minutos com o Espaço de Trabalho parado. `0` desliga (migração longa, à mão).

Nenhum comando de deploy vive neste arquivo — o roteiro de deploy vive no
documento de topologia linkado acima.
