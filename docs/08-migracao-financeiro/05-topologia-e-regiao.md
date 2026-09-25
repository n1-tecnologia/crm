# Topologia e região — Fase 2 (D-23, D-15, D-11)

**Status:** parcialmente executado. O TLS do Postgres e a medição repetível de
latência já estão no código (Plan 02-15, Task 2). A decisão de região (D-23)
está **tomada** (§2). A publicação do `apps/api` na VPS atrás do nginx
(D-15/D-11) e a medição real a partir de lá continuam pendentes de ação
humana — são mudanças de infraestrutura fora do que um agente de execução de
código pode ou deve fazer sozinho. Este documento é o runbook: a decisão, a
evidência, os comandos exatos e o que falta.

Ver `.planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/02-15-PLAN.md`
(Task 1 e Task 3) para o texto original do plano e `02-RESEARCH.md`
("Before the two-week rehearsal") e `02-CONTEXT.md` (D-23, D-15) para a
decisão de produto já travada.

## 1. O que já está fechado neste plano

- **TLS do Postgres (T-02-TLS):** `apps/api/src/persistencia/conexao.ts`
  trocou `rejectUnauthorized: false` incondicional por `construirSsl()` —
  aceita `DATABASE_CA_CERT` (PEM em env) ou `DATABASE_CA_PATH` (arquivo),
  configura `ssl: { ca, rejectUnauthorized: true }`; `DATABASE_SSL_INSECURE=true`
  é a válvula de escape explícita de desenvolvimento local, com aviso alto no
  log; sem nenhuma das três, a conexão remota **falha** em vez de degradar. O
  blocker que `STATE.md` registrava ("fixar a CA do Supabase antes de o
  `apps/api` ir para a VPS") está fechado no código — falta só fornecer o
  valor real de `DATABASE_CA_CERT`/`DATABASE_CA_PATH` no ambiente onde o
  processo roda.
- **Medição repetível:** `apps/api/src/e2e/latencia.test.ts` mede 200
  transações representativas (`begin → hidratar → update revisão → rollback`)
  contra o Postgres configurado e, quando `SUPABASE_STORAGE_BUCKET` também
  está definido, 50 downloads assinados reais (`urlDeDownload` + `GET`)
  contra o Storage — reporta p50/p95/p99 de cada um. Roda com
  `npm run test -w @n1/api -- src/e2e/latencia.test.ts`; pula inteiro sem
  `DATABASE_URL` (D-DEC-09). A asserção é não bloqueante por padrão (imprime e
  passa); definir `LATENCIA_P95_MAX_MS` a torna um gate — é o mecanismo que o
  Plan 02-27 (pré-corte) liga contra o Postgres/bucket de produção.
- **Decisão de região (D-23):** tomada — ver §2. Nenhuma migração de projeto
  Supabase é necessária como consequência desta escolha.

## 2. Região escolhida (D-23)

**Região escolhida: `permanecer-medindo` — o projeto Supabase da plataforma
continua em `us-west-2` (Oregon).**

**Data da decisão:** 2026-09-25.

**Decidido por:** o dono do produto, apresentado com as duas opções abaixo
(Task 1 deste plano).

**Justificativa:** zero downtime agora, latência transcontinental medida e
registrada, migrar depois custa recópia de banco + Storage e segundo
downtime. A base ainda é pequena hoje, mas a decisão do dono foi não pagar o
custo de reconfiguração de `DATABASE_URL`, chaves Auth e bucket neste
momento — o compromisso passa a ser medir a latência real (§5) e registrá-la
como parte da topologia congelada, não presumi-la.

Como a escolha foi `permanecer-medindo`, a verificação de disponibilidade de
`sa-east-1` no plano contratado (critério de aceite da Task 1 para o caminho
de migração) não se aplica a esta execução — nenhum projeto novo é criado.
Se a decisão for revisada no futuro, essa verificação volta a ser um
pré-requisito antes de agir.

### Evidência considerada

- O projeto da plataforma é `epomplsskqpluxuujpxl` (DEC-08), em `us-west-2`
  (Oregon) — confirmado em `.planning/PROJECT.md` (OQ-ADR-01) e
  `apps/api/README.md` (§6, antes deste plano).
- Única medição indicativa registrada até hoje: **~234 ms por ida e volta**
  de um notebook no Brasil até `us-west-2` (`.planning/PROJECT.md`, linha
  "Latência medida"). Não é uma medição de p50/p95/p99 nem foi feita a
  partir da VPS de produção — é o melhor dado disponível até a VPS rodar
  `latencia.test.ts` de verdade (§5, ainda pendente).
- `02-RESEARCH.md` (achado 8 e "Before the two-week rehearsal"): São Paulo
  (`sa-east-1`) está documentada como disponível pela Supabase, mas **região
  não muda in-place** — exige projeto novo, migração de banco, Auth e
  Storage, reconfiguração de chaves/URLs. Esse custo é exatamente o que a
  decisão `permanecer-medindo` evita pagar agora.
- Meta recomendada por `02-RESEARCH.md`: p95 da transação comum abaixo de
  300 ms. Com a latência transcontinental conhecida (~234 ms de round-trip
  só de rede, sem contar a transação em si), essa meta é o critério que a
  medição real de §5 precisa confirmar ou refutar.

### As duas opções apresentadas (registro histórico)

| Opção | O que muda | Prós | Contras |
|---|---|---|---|
| `migrar-sa-east-1` | Projeto Supabase novo em São Paulo; `DATABASE_URL`, chaves Auth e bucket recriados; migrações reaplicadas; Auth migrado; bootstrap/configuração de Solicitações rerodados | Latência VPS↔banco menor; cumpre D-23 na forma preferida; janela barata, antes de Storage e histórico | Novo `DATABASE_URL`/chaves para reconfigurar em todo lugar; Storage recriado; downtime curto planejado |
| **`permanecer-medindo` (ESCOLHIDA)** | Nenhuma. Medir p50/p95/p99 reais a partir da VPS com `latencia.test.ts` e registrar aqui | Zero downtime agora; nenhuma reconfiguração de chave | Latência transcontinental em toda transação do pipeline; migrar depois custa a mesma recópia de banco + Storage e um segundo downtime, agora com dado real em produção |

## 3. Topologia alvo (D-15/D-11) — desenhada, não publicada

```text
Navegador (apps/web)
    │ HTTPS
    ▼
nginx (VPS do automation/, TLS)
    ├── /saude                     → apps/api  (pública)
    ├── /v1/public/forms/*         → apps/api  (pública, formulário anônimo)
    ├── /v1/integrations/*         → apps/api  (credencial de serviço, Plan 02-09)
    └── (tudo o mais)              → 404/403, NÃO alcança apps/api
                                       inclusive POST /operacoes/:nome e GET /estado —
                                       essas servem só o navegador, pela origem de
                                       apps/web, com a allowlist de CORS (WEB_ORIGIN)

automation/ (mesma VPS, processo separado)
    │ HTTPS + credencial de serviço (Plan 02-09) + Idempotency-Key
    ▼
nginx → /v1/integrations/* → apps/api

apps/api (novo processo na VPS, HOST=0.0.0.0 só atrás do nginx)
    │ Postgres (TLS verificado — construirSsl(), este plano)
    ▼
Supabase da plataforma (epomplsskqpluxuujpxl) — us-west-2 (Oregon), por decisão §2
```

Rotas publicadas: `/saude`, `/v1/public/forms/*`, `/v1/integrations/*`.
Rotas explicitamente bloqueadas na internet: `POST /operacoes/:nome`,
`GET /estado` — servem exclusivamente o navegador pela origem do `apps/web`
(CORS por allowlist, nunca `*`).

Credencial de serviço do `automation/`: emitida pelo CLI do Plan 02-09
(`npm run credencial -w @n1/api`), escopos `payment-requests:read` e
`payment-requests:write`, resolve para o Membro `Agente do pipeline` (D-15) —
nunca anônima na timeline. Guardada no gerenciador de segredos da VPS, nunca
em arquivo versionado.

## 4. Runbook — comandos exatos para quando o dono executar

Nenhum destes comandos foi rodado por este agente: publicar na VPS, editar o
nginx compartilhado e medir a partir de lá são ações de infraestrutura de
produção fora do alcance de uma mudança de código. Como a decisão de região
(§2) foi `permanecer-medindo`, os passos de criação/migração de projeto
Supabase **não se aplicam** — o `DATABASE_URL` atual continua valendo.

1. **Confirmar o bucket privado de anexos** no Supabase Dashboard → Storage →
   Buckets: confirmar que é privado (não público) antes de qualquer upload
   real — vale independente da região.
2. **Publicar o `apps/api` na VPS** (mesma VPS do `automation/`, processo
   separado, `HOST=0.0.0.0` só porque está atrás do nginx):
   ```bash
   # Na VPS: subir apps/api como processo próprio (mesmo gerenciador de
   # processos já usado pelo automation/, ex.: PM2), com as variáveis de
   # ambiente de produção (nunca commitadas), incluindo DATABASE_CA_CERT
   # ou DATABASE_CA_PATH com a CA do Supabase (T-02-TLS, §1).

   # No nginx da VPS: configurar location blocks só para
   #   /saude, /v1/public/forms/*, /v1/integrations/*
   # com TLS (certificado já existente na VPS ou emitido para o novo host/path);
   # tudo o mais retorna 404/403, sem chegar ao apps/api.
   ```
3. **Emitir a credencial de serviço do `automation/`:**
   ```bash
   npm run credencial -w @n1/api -- emitir --nome=automation \
     --escopos=payment-requests:read,payment-requests:write
   # Guardar o segredo emitido no gerenciador de segredos da VPS —
   # nunca em arquivo versionado, nunca no automation/.env commitado.
   ```
4. **Medir a partir da VPS:**
   ```bash
   npm run test -w @n1/api -- src/e2e/latencia.test.ts
   # Opcional, para virar gate: LATENCIA_P95_MAX_MS=300 npm run test -w @n1/api -- src/e2e/latencia.test.ts
   ```
   Anotar os p50/p95/p99 de banco e Storage impressos, e colar em §5 abaixo.
5. **Confirmar a allowlist de rotas a partir da internet:**
   ```bash
   curl -sS https://<host>/saude                    # espera {"ok":true,"servico":"apps/api"}
   curl -sS https://<host>/operacoes/ping            # espera 404/403 — não deve alcançar apps/api
   ```
6. **Atualizar este documento** com os números medidos (§5); atualizar
   `apps/api/README.md` se algo neste runbook mudar na prática.

## 5. Medições reais — PENDENTE

Nenhuma medição de p50/p95/p99 a partir da VPS foi feita neste plano.
Também não foi possível medir a partir deste ambiente de execução: o
worktree usado para rodar `latencia.test.ts` não tem `DATABASE_URL`
configurada (não carrega `apps/api/.env`, que é gitignored), então a suíte
pula a seção de medição inteira (D-DEC-09) e só a seção pura de
`construirSsl()` roda — confirmado, ver Task 2 deste plano. Preencher esta
tabela exige rodar `latencia.test.ts` de dentro da VPS de produção contra o
Supabase e o bucket reais, o que é o passo 4 do runbook (§4).

| Operação | p50 | p95 | p99 | Data | A partir de |
|---|---|---|---|---|---|
| banco (transação representativa) | — | — | — | — | — |
| storage (`urlDeDownload` + `GET`) | — | — | — | — | — |

## 6. Reversibilidade — resumo

| Ação | Reversível? | Custo de reverter |
|---|---|---|
| Fixar CA/TLS no código (`construirSsl()`) | Sim — é código, revertido por outro commit | Baixo |
| Medir latência (`latencia.test.ts`) | Sim — não muda estado | Nenhum |
| Permanecer em `us-west-2` (§2) | Sim, mas migrar depois custa o mesmo que migrar agora, com dado real em produção | Cresce com o tempo |
| Publicar `apps/api` na VPS/nginx | Sim — parar o processo, remover o `location` do nginx | Baixo, desde que feito antes de `automation/` depender dele em produção |
| Emitir/rotacionar credencial de serviço | Sim — CLI de rotação/revogação já existe (Plan 02-09) | Baixo |

## 7. O que fica pendente depois deste plano

- Confirmar que o bucket privado de anexos existe e não é público.
- Publicar o `apps/api` na VPS atrás do nginx com a allowlist de rotas.
- Emitir a credencial de serviço do `automation/` e guardá-la no gerenciador
  de segredos da VPS.
- Rodar `latencia.test.ts` a partir da VPS e preencher §5.
- Confirmar por `curl` que só as rotas necessárias respondem publicamente.
- Só então: `apps/api/README.md` pode deixar de mencionar PERS-08/D11 como
  bloqueado por decisão pendente de infraestrutura (a decisão de região já
  não está pendente — §2).
