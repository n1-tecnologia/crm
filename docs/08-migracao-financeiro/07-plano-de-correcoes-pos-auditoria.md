# Plano de correções pós-auditoria do `financeiro-tria`

Data: 2026-09-28. Origem: auditoria completa do `financeiro-tria` (6 mapas por
subsistema, 31 afirmações críticas verificadas por 3 céticos cada, crítico de
completude) feita antes do primeiro lançamento real no Omie pela plataforma.
Os achados com evidência (`caminho:linha`) estão no **Anexo A**, no fim.

## Execução (2026-09-28) — o código está feito; falta produção

Decisão do dono: **fazer todas as correções sem trocar credenciais** (a 4.1
não foi feita; segredo que estava no código mudou de lugar, com o mesmo
valor). Tudo local, sem push.

| Etapa | Código | O que falta (quem) |
|---|---|---|
| 0 | ✅ API e `automation/` locais parados (inclusive o `tsx watch` que sobrava); commits feitos | Você: A7 pausa pelo CLI (2.1); firewall do macOS |
| 1.1–1.3, 1.6 | ✅ `financeiro-tria` `b31d8db..eaf3d77` | Etapa 3 (teste real) |
| 1.4, 1.5 | ✅ `crm-n1` `9cfca56`, `e60fe50`, `8f959a1`, `2278048`; contrato dos dois lados `02ce704` | — |
| 2.1 | ✅ `5a4d4d5`, `d5913eb`, `dbe19d3` | Você: `contas-a-pagar:configurar --apply` |
| 2.2 | ✅ `be8f557`, `08a6330` | Você: `solicitacoes:configurar --apply` |
| 2.3, 2.4 | — (operação) | Você: SQL da agenda, `outbox:limpar-testes` |
| 3 | ✅ `npm run teste:omie-real` (`5293dc3`, `91ac38c`, `186147c`); rodado no Omie real em 2026-09-28 — lançado, conferido, sem duplicata, excluído | A jornada pela tela (2B do roteiro), quando quiser |
| 4.1 | ⏸ não feita (decisão: mesmas credenciais) | — |
| 4.2–4.5, 4.7 | ✅ `financeiro-tria` `bb3cc14..ed9ef58` | Você: variáveis no `.env` da VPS |
| 4.6 | ✅ roteiro e SQL em `financeiro-tria/supabase/manual/` | Você: SQL Editor, na ordem do README |
| 5 | — | Você: push, deploy, `.env` (roteiro) |
| 6.1–6.4 | ✅ `financeiro-tria` `d21c726..8e241e5`, `ba11906` | Você: SQL de deduplicação; variáveis `PLATAFORMA_*` |
| 6.5 | Parcial: Membro do pipeline ✅; Formulário público no `ws_n1`, aceitar convite e outbox ligado ❌ | Próxima rodada |
| 7 | ✅ CI nos dois repos, testes frágeis, código morto, `scripts/` no typecheck, `npm test` isolado | Itens de produto do CRM N1 (Conhecimento, `conectarIntegracao`, "Formulário desatualizado") ❌ |

Provas: `financeiro-tria` 489/489 testes (isolados, 0 acessos de rede) e
typecheck de `src/` e `scripts/`; servidor integrado sobe sem `PLATAFORMA_*`
(health 200, rotas protegidas 401). `crm-n1` `npm run check` verde sem banco
(domínio 735, web 216, api 549 + 205 de banco pulados) e contrato
`contas-a-pagar-v1` 21/21, com as duas cópias iguais por hash.

Achados novos durante a execução (decisão sua, ver o roteiro): FINQ sem Conta
de Pagamento mapeada (agora recusa em vez de usar a primeira conta);
`ensureSupplier` do legado nunca cria fornecedor (trata `Client-5113` como
erro); Family Office com `FO_EMPRESA_*_APP_KEY` vazia cai na conta Omie
padrão; o seletor de conta grava `app_key`/`app_secret` nas linhas de
solicitação; retomada do pipeline reexecuta tudo (reenvia WhatsApp se
`NOTIFY_NEW_REQUEST_WHATSAPP` estiver ligado); depois da aprovação na
plataforma não sai RESUMO (spec S5). **Jornada real no navegador
(`npm run jornada:financeiro -w @n1/web`, 2026-09-28, contas N1-488..N1-491):**
o `ws_n1` só tem 2 Membros (Maryane e o usuário de teste), e a configuração
aponta para `mem_marcos_paulo`/`mem_walter`, que não existem — ninguém move
conta para "pago" (regra de entrada do Status) e a A3 falha ("Membro não
encontrado"), deixando a conta sem Aprovador; A9 e R5 também citam
`mem_marcos_paulo`. Corrigir é convidar os dois com esses ids ou remapear a
regra e as Automações (decisão do dono).

## Como ler este plano

- **Etapas em ordem de dependência.** Cada uma tem objetivo, o que muda (com
  arquivo e linha), quem faz, como provar que ficou pronto e um tamanho:
  **P** (horas), **M** (um dia de trabalho), **G** (vários dias).
- **Quem faz.** "Agente" = eu escrevo código, testes e dry-runs. "Você" =
  qualquer escrita em produção (Postgres do CRM N1, Supabase do Financeiro,
  Omie, VPS, `.env`, GitHub), sempre com o comando pronto e um dry-run antes.
- **Regras fixas.** Nada vai para o GitHub sem você pedir. O Omie real só é
  tocado na Etapa 3, com uma conta de valor mínimo. Nenhum teste toca o
  Supabase de produção do Financeiro.

## Estado de partida

| Onde | Situação |
|---|---|
| `crm-n1`, worktree `integra-frontend-main` | Sem commit: painel de Atividade estilo ClickUp, menção por `@`, filtro de Lista no agendador (`AUTOMACOES_LISTA_ID`), regra nova da ponte (lança ao entrar em "em lançamento omie"). Typecheck e testes verdes. |
| `financeiro-tria` | Local em `549ceb5`, 52 commits sem push. VPS de produção em `4149032`, sem as rotas `/v1/integrations/contas-a-pagar/*`, sem `PLATAFORMA_*` e sem `MP_*` no `.env`. |
| `ws_n1` (produção do CRM N1) | Sem Membro no Papel "Agente do pipeline"; A7 (véspera do vencimento) publicada; `plataforma.automacao_agenda` com 5 dias em `falhou`; Espaços de teste `ws_outbox_*` sobrando. |
| Máquina local | `automation/` escuta em todas as interfaces com o `.env` de produção; firewall do macOS desligado. `apps/api` em `vite-node --watch` empilha pontes a cada edição. |

## Ordem recomendada

| Etapa | O que | Tamanho | Depende de | Quem |
|---|---|---|---|---|
| 0 | Estancar (hoje, sem código) | P | — | Você |
| 1 | Lançamento no Omie correto | G | 0 | Agente + você (revisão) |
| 2 | Regras e dados do `ws_n1` | M | — (paralela à 1) | Agente + você (`--apply`) |
| 3 | Teste controlado no Omie real | P | 0, 1, 2.1 | Você (com roteiro) |
| 4 | Segurança do `financeiro-tria` | G | — (4.1, 4.2 e 4.4 hoje) | Agente + você |
| 5 | Publicar: VPS e `apps/api` | G | 1, 4 | Você (com roteiro) |
| 6 | Solicitações pela plataforma (Fase 2) | G | 5 | Agente + você |
| 7 | Limpeza e dívidas | M | — | Agente |

Recomendação: **Etapa 0 hoje**; **4.1, 4.2 e 4.4 em paralelo com a 1**;
**4.3, 4.5 e 4.6 antes da 5**. A Etapa 6 só depois de o lançamento estar em
produção com uma semana de ensaio.

---

## Etapa 0 — Estancar (hoje, sem código)

| # | Ação | Quem | Prova |
|---|---|---|---|
| 0.1 | `Ctrl+C` na API e subir de novo com o mesmo comando (mata as pontes empilhadas pelo `--watch`). Quando não estiver testando, parar também o `automation/` local. | Você | Um só `node` na porta 3002 (`lsof -nP -iTCP:3002`). |
| 0.2 | Pausar a Automação **A7 · D-1: lançar no Omie pelo Agente** no `ws_n1` (tela de Automações). A regra nova a substitui; ligada, ela registra "falhou" na véspera do vencimento de toda conta em "para pagar". | Você | A7 aparece como pausada. |
| 0.3 | Ligar o firewall do macOS (Ajustes → Rede → Firewall). Até a 4.4, o `automation/` local aceita conexões de qualquer máquina da rede em rotas sem senha. | Você | Firewall ativo. |
| 0.4 | Não mover conta nenhuma para "em lançamento omie" até a Etapa 3. | Você | — |
| 0.5 | Commit do que está pronto em `integra-frontend-main` (quatro mudanças da tabela acima), sem push. | Agente, com o seu "sim" | `git log` no worktree. |

---

## Etapa 1 — Lançamento no Omie correto (G)

**Objetivo:** uma conta que entra em "em lançamento omie" é lançada no Omie com
o fornecedor certo, publica o Resumo de pagamento e vai para "lançado omie";
quando não dá, a conta recebe um comentário dizendo o motivo, uma vez só, e
ninguém fica repetindo chamadas ao Omie.

### 1.1 `/lancar` resolve o fornecedor no Omie (`financeiro-tria`)

Hoje `contas-a-pagar-lancamento.ts:183` manda o CNPJ digitado (com pontuação)
em `codigoClienteFornecedor`, campo em que o Omie espera o código interno do
cadastro. O legado faz certo em `payment-automation-service.ts:1417-1430`
(`publicApisAdapter.fetchCnpjDetails` + `omieAdapter.ensureSupplier`) e recusa
quando o código obtido é igual ao documento (`:1886-1901`).

- Nova porta `deps.fornecedor.garantir({ documento, nome, tipo })` em
  `DepsDeLancamento`, chamada antes de `incluir`; wiring real em
  `contas-a-pagar-routes.ts` (`construirDepsDeEscritaReais`) reaproveitando
  `omieAdapter.ensureSupplier` (`omie.ts:100-137`) com `cnpjData` do
  `publica.cnpj.ws` quando for CNPJ, exatamente como o legado.
- Recusa permanente (`ErroPermanenteDaPlataforma`, código novo
  `FORNECEDOR_NAO_RESOLVIDO`) se `supplierId` vier `mock-` ou igual ao
  documento.
- Documento limpo (`\D` fora) e chave Pix normalizada com `classifyPixKey`
  (`payment-rules.ts:484-504`, hoje sem uso no caminho novo): CNPJ/CPF/telefone
  só dígitos; e-mail e aleatória como estão.
- Omie falso (`testing/omie-falso.ts`) passa a exigir código de fornecedor
  diferente do documento, para o teste pegar a regressão.

### 1.2 Recusa do Omie vira erro legível e definitivo

Hoje qualquer falha no `IncluirContaPagar` cai em
`contas-a-pagar-lancamento.ts:198-205` como `ErroTransitorio("ERRO_INTERNO")`
→ HTTP 500 `retryable:true` → a ponte não comenta e repete a cada ciclo. E o
fault do Omie não é logado (só `ConsultarContaPagar`, `REDUNDANT` e
`Client-1166` aparecem: `omie.ts:360, 660, 261`).

- Em `omie.ts` (`callOmie`, `634-667`): um `faultstring` do Omie vira um erro
  tipado (`ErroDoOmie { code, faultstring }`), logado com o código
  (`[omie] IncluirContaPagar recusado: <code> <faultstring>`).
- Em `lancamento.ts:198-205`: `ErroDoOmie` de negócio vira
  `ErroPermanenteDaPlataforma("OMIE_RECUSOU", faultstring)`; só rede, 5xx e
  timeout continuam transitórios.
- Em `lancamento.ts:139`, a resolução (`ListarCategorias`, `ListarContasCorrentes`,
  `ListarDepartamentos`, Supabase) entra num `try`: falha de rede ali é
  transitória, não 422 permanente como hoje (`routes.ts:191`).
- A ponte já trata `permanente:true` comentando na conta — o texto passa a
  incluir o motivo do Omie.

### 1.3 Miudezas do mesmo caminho

- `reaproveitado:true` em todos os caminhos que acham o título (hoje só na
  primeira consulta: `lancamento.ts:164-173`; `omie.ts:269` descarta o flag).
- Conta corrente sem match cai na **primeira da lista** sem aviso
  (`contas-a-pagar-resolucao.ts`, `resolveContaPagamento`): passa a recusar
  com `revisar`, como a categoria.
- Fallback `ilike` e linhas sem `similarity` são tratadas como `1`
  (`resolucao.ts:219, 237`): sem similaridade real, o veredito é `revisar`,
  nunca `resolvida`.
- Tamanho de `codigo_lancamento_integracao` (`tria:contas-a-pagar:<id>`, ~30
  caracteres): confirmar o limite do Omie na Etapa 3; se estourar, trocar por
  hash curto e determinístico.

### 1.4 Ponte (`crm-n1`, `apps/api/src/automacoes/invocar-agente.ts`)

- Timeout de 60 s só no `/lancar` (o `/resolver` fica em 10 s): o `/lancar`
  faz de 6 a 8 chamadas em série a 4 rps.
- Contador de falhas transitórias por conta: na 3ª seguida, comenta uma vez
  ("O Omie não respondeu/recusou 3 vezes: <resumo>") e só volta a tentar quando
  um Campo da conta mudar (`impressaoDaConta`), não a cada ciclo.
- `aquecer()` deixa de chamar `/resolver` para toda conta em "para pagar" a
  cada ciclo (esse pré-aquecimento só servia à A7 por timer; com a A7 pausada
  é custo puro no Omie e na OpenAI). O de-para passa a ser resolvido por conta,
  na hora do lançamento.
- `faltantesParaOmie` sai da ponte e vira regra do domínio (ver 2.1), para a
  tela e a ponte concordarem.
- `index.ts`: `import.meta.hot?.dispose(() => { ponte.parar(); worker.parar(); scheduler.parar(); })`
  para o `vite-node --watch` não empilhar workers a cada edição.

### 1.5 A7 no domínio

A7 (`packages/dominio/src/seed-financeiro.ts:388`, gatilho `vencimento(-1)`)
deixa de existir como Automação por timer. Duas opções:

- **Simples (recomendada agora):** A7 é despublicada no `ws_n1` (0.2) e
  removida do seed; a ponte é o executor e a `AgentExecution` nasce só no
  lançamento ou na recusa (já é assim na regra nova).
- **Completa (depois):** A7 vira Automação de evento "entrou em 'em lançamento
  omie'" que abre uma Execução `pendente` do Agente, e a ponte fecha essa
  Execução ao lançar. Dá visibilidade na tela ("aguardando o Omie…"), mas exige
  desenho no motor de Automações.

### 1.6 Testes e contrato

- Fixture de contrato compartilhada `contratos/contas-a-pagar-v1/` (corpo de
  `/resolver`, `/lancar`, resposta e envelope de erro), usada pelos dois repos,
  nos moldes de `payment-requests-v1`.
- Teste da composição real (`contasAPagarRouter()` com Omie falso e credencial
  fictícia) cobrindo: fornecedor procurado/criado, documento ≠ código, recusa
  do Omie → 422 `OMIE_RECUSOU`, rede → 500, `reaproveitado` nos 4 caminhos.
- Ponte: casos novos para timeout longo, 3 falhas → 1 comentário, e "sem
  aquecer para 'para pagar'".

**Prova da Etapa 1:** `tsc` e testes verdes nos dois repos (automation rodado
isolado, como na auditoria: cwd vazio + guarda de rede); depois a Etapa 3.

---

## Etapa 2 — Regras e dados do `ws_n1` (M)

### 2.1 O que o Omie exige, o Status também exige

`erpMissingFields` (`packages/dominio/src/operations/financeiro.ts:189-208`) e
a saída de "para pagar" (`seed-financeiro.ts:102`, `dadoDePagamento`) ganham
**Categoria de pagamento**, **Fornecedor**, **CNPJ/CPF** (condicional, já
existe no `erpMissingFields`) e **Nome do fornecedor**. A tela passa a listar
esses campos ao bloquear o Status; a ponte usa só `erpMissingFields`.

Aplicar no `ws_n1` exige um evolver: novo CLI `contas-a-pagar:configurar`
(dry-run por padrão, `--apply` grava), nos moldes de
`apps/api/src/bootstrap/configuracao-por-empresa.cli.ts`. **Você roda o
`--apply`.**

### 2.2 Membro "Agente do pipeline" no `ws_n1`

Sem ele toda linha do agendador falha (`credenciais-de-servico.ts:104`) e hoje
a API roda com `AUTOMACOES_ATOR_MEMBER_ID=mem_tarjrn` (o seu usuário assina
pelo Agente). `solicitacoes:configurar` já cria o Papel
(`solicitacao-de-pagamento-evolver.ts:351` confere o Membro); passa a criar
também o Membro (convite com `roleId: rol_sp_agente_pipeline`, e-mail de
serviço) quando ausente. **Você roda o `--apply`** e tira a variável do
comando da API.

### 2.3 Agendador em produção, com cuidado

1. Liberar as 5 linhas `falhou` de `plataforma.automacao_agenda` do `ws_n1`
   (SQL que você roda).
2. Subir o agendador **sem** `AUTOMACOES_LISTA_ID` e **com**
   `AUTOMACOES_ENSAIO_PRIMEIRA_VOLTA=true`: a primeira volta de Contas a receber
   (R2, R4, R5 podem mexer nas 240 contas reais) só mede.
3. Ler o relatório (`npm run ensaio:relatorio`) e liberar com
   `npm run automacoes:liberar` (**você**).

### 2.4 Limpeza do banco do CRM N1

`npm run outbox:limpar-testes -w @n1/api -- --apply` (**você**) e remoção dos
Espaços `ws_outbox_*` (dry-run primeiro).

---

## Etapa 3 — Teste controlado no Omie real (P)

Pré-condições: 0 inteira, 1 verde, 2.1 aplicada.

1. Criar **"TESTE OMIE - R$ 1,00"**: Centro de Custo TRIA, Valor 1, vencimento
   em 10 dias, Forma Chave Pix (chave de e-mail de teste), Categoria "Contas de
   consumo", Fornecedor CNPJ com um **CNPJ real** que já exista no Omie,
   Nome do fornecedor.
2. Subir o `automation/` local com `HOST=127.0.0.1` (4.4),
   `INVOICE_CRON_ENABLED=false`, `INVOICE_EMIT_DRAIN_MINUTES=0` e o token.
3. Subir a API com `AGENTE_CONTAS_A_PAGAR_MODO=lancar` (comando pronto, um
   processo só).
4. Mover a conta para **"em lançamento omie"** e esperar um ciclo.
5. Conferir: (a) Terminal da API: `Conta lançada no Omie e movida para
   "lançado omie"`; (b) Atividade da conta: Resumo de pagamento; (c) no Omie:
   fornecedor, categoria, conta corrente TRIA, valor, vencimento, forma
   TRA/01.3, `codigo_lancamento_integracao` inteiro (não truncado).
6. Repetir o ciclo (mover de volta e de novo): o Omie devolve o mesmo título
   (`reaproveitado`), nenhuma duplicata.
7. Excluir o título no Omie e descartar a conta na plataforma.

Se falhar, o comentário do Agente na conta diz o motivo (1.2). Colar aqui.

---

## Etapa 4 — Segurança do `financeiro-tria` (G, produção)

### 4.1 Rotação de credenciais (você; eu preparo a lista e os `.env`)

- Omie: todas as `app_key/app_secret` (Tria, FINQ, Marcos Paulo, Family
  Office). Expostas por `GET /financeiro/solicitacoes` sem senha
  (`routes.ts:334`), pela policy `anon_read` e pelo código versionado (4.2).
- Postgres do CRM N1: senha do `postgres` e do `leitura_importacao` (apareceram
  no chat); tirar do `apps/api/.env` a credencial de superusuário.
- VPS: senha de `root` (apareceu no chat) → chave SSH.
- `PLATAFORMA_LANCAMENTO_TOKEN` gerado hoje: trocar antes de ir para a VPS.

### 4.2 Segredos fora do código

`tenants/marcos-paulo/config.ts:34-35` tem `MP_OMIE_APP_KEY/SECRET` como valor
padrão literal (também no commit de produção). Vira `requiredEnv`, e a VPS
ganha as duas no `.env` **antes** do deploy (senão o boot falha).

### 4.3 Autenticação nas rotas que escrevem

Middleware Bearer em tempo constante (reaproveitar `extrairBearer` de
`contas-a-pagar-routes.ts`) em:

| Rota | Arquivo:linha | Efeito hoje |
|---|---|---|
| `POST /automation/runs/:id/{approve,review,retry-step,cancel}` | `routes.ts:302-326` | lança no Omie sem reler a task |
| `PATCH /financeiro/solicitacoes/:id/aprovado` | `routes.ts:353` | aprova em produção |
| `POST /sync/clickup/payment-requests` | `routes.ts:362` | sincroniza |
| `POST /workflows/:key/run` | `workflow-routes.ts:40` | emite NF, cria cliente no Omie |
| `POST /plano-contas/import`, `DELETE /plano-contas/:id` | `plano-contas-routes.ts:102, 129` | altera a tabela que escolhe a categoria |
| `POST /invoice/run/{mark-7days,emit}` | `invoice-webhooks.ts:92, 95` | emite NF |
| `GET /financeiro/solicitacoes(/:id)` | `routes.ts:334-352` | além do Bearer, projeção **sem credenciais** |

Mais:
- Webhooks do ClickUp (`routes.ts:194-263`): validar a assinatura
  `X-Signature` (HMAC com o secret do webhook; **você** pega o secret no
  ClickUp).
- `PLATAFORMA_LEITURA_TOKEN` hoje autoriza `repetir-passo` com `launch_omie` e
  `executar` workflows (`leituras-plano-contas-routes.ts`): essas duas passam a
  exigir o token de lançamento.
- Webhooks Guru/Kiwify/TMB já usam caminho secreto; ficam como estão.
- O painel Vercel chama tudo isso **sem token** e o login dele é decorativo
  (senha em variável `VITE_*`). Decisão sua (ver "Decisões"): pausar o painel
  agora, já que as telas vivem no CRM N1 (Fase 4), ou mantê-lo e aceitar que
  um token no bundle é público.

### 4.4 Bind local

`server.ts:73`: `app.listen(port, optionalEnv("HOST", "0.0.0.0"))`. Local roda
com `HOST=127.0.0.1`; a VPS mantém o padrão atrás do nginx.

### 4.5 Classificador de aprovação

`adapters/ai.ts:701-704`: a regex de aprovação (`aprov|ok|seguir|pode|liberad|autoriz`)
roda antes da de recusa, então "não aprovado" e "não pode" viram `approved`.
Isso vale sempre que a OpenAI falta ou falha (`:644-646`). Correção: testar
negação primeiro, por palavra inteira, e devolver `irrelevant` quando nada
casa; no prompt (`:633-639`) permitir `irrelevant` e tirar "prefira approved".
Teste (g) de `classificador-de-aprovacao.test.ts:180` passa a rodar sem OpenAI.

### 4.6 Fechar a leitura anônima do Supabase

Migração `20261001120000_remove_anon_read_painel.sql` está "NOT YET APPLIED" e
depende de: painel Vercel pausado, RLS de `transacoes` e
`produtos_cadastrados_emissao_notas` verificada (runbook
`06-runbook-corte-painel-financeiro.md`). **Nunca `supabase db push`**: as
migrações de 09-22/09-25 foram aplicadas à mão e não constam do histórico; o
índice único `(origem, TaskID)` falharia (180 duplicatas). Aplicar à mão no SQL
Editor (**você**) e registrar o histórico com `supabase migration repair`.

### 4.7 Robustez

- `lerCorpoBruto` (`leituras-plataforma-comum.ts`): `JSON.parse` fora do
  `try` derruba o processo com JSON malformado; corrigir e adicionar handler
  global de `unhandledRejection`.
- Rate limiter do Omie é por processo: VPS e local dividem a cota sem saber.
  Regra operacional: **um** `automation/` por vez falando com o Omie.

---

## Etapa 5 — Publicar (G)

1. **Push do `financeiro-tria`** (52 commits + Etapas 1 e 4) — **você**
   decide; sugiro PR para revisão.
2. **Deploy na VPS**: limpar `automation/package*.json` sujos, corrigir
   `ops/deploy` (`npm install tsx` altera o lock), `git pull --ff-only`,
   `.env` de produção ganha `PLATAFORMA_LANCAMENTO_TOKEN`,
   `PLATAFORMA_WEBHOOK_TOKEN`, `PLATAFORMA_BASE_URL`,
   `PLATAFORMA_SERVICE_TOKEN`, `MP_OMIE_*`, `HOST`. **Não** ligar
   `PAYMENT_REQUEST_SOURCE=plataforma` ainda (sem as variáveis o boot cai; com
   elas o legado muda de fonte). Roteiro passo a passo pronto; **você** roda.
3. **`apps/api` do CRM N1 na VPS** (checklist `05-topologia-e-regiao.md`:
   nginx/TLS, CA do Postgres, portas livres — 3001/3002 já ocupadas lá), com
   `AGENTE_CONTAS_A_PAGAR_URL` apontando para o `automation/` da VPS, primeiro
   em `ensaio`, depois `lancar`.
4. **Ensaio de uma semana** em produção (02-27, Task 3) e corte (02-28).

---

## Etapa 6 — Solicitações de pagamento pela plataforma (G)

Pendências da Fase 2 que a auditoria confirmou:

1. `startPaymentRequest` lê a Tarefa pelo ClickUp mesmo com fonte
   `plataforma` (`legacyClickUpRaw`), então `/webhooks/plataforma/solicitacao-criada`
   responde 422 sempre. Passa a ler pelo `PaymentRequestAdapter`.
2. Fila `platform_adapter_commands`: worker de verdade, lease com expiração
   (`lease_until` nunca é lido) e `reivindicarCabeca` por Tarefa (hoje pega a
   cabeça de qualquer Tarefa e deixa comandos órfãos).
3. `solicitacaoInput` não preserva `origem` → segunda linha em vez de update;
   deduplicar os 180 `TaskID` e só então aplicar o índice único.
4. Receipts presos em `recebido`/`falhou` depois de configurar variáveis:
   CLI de reprocessar.
5. No CRM N1: Formulário público no `ws_n1`, `OUTBOX_WORKER_ATIVO=true`,
   credencial de serviço (`npm run credencial emitir`), operação de aceitar
   convite.

---

## Etapa 7 — Limpeza e dívidas (M)

- CI mínima nos dois repos: typecheck + testes isolados (método da auditoria:
  cwd vazio + guarda de rede para o `automation/`).
- `payment-rules.test.ts:37` depende de `CLICKUP_RESPONSAVEL_FINQ_NOME`; fixar
  no teste. `receipts-da-plataforma.test.ts:236-241` exige "NOT YET APPLIED"
  numa migração já aplicada.
- Código morto: `adapters/placeholder-integrations.ts`, `domain/explain-error.ts`.
- `scripts/` do `automation/` fora do typecheck (`tsconfig.json:13`).
- Web do Financeiro (só se o painel continuar vivo): "pago" × "aprovado" em
  Contas a Pagar/Receber, colisão de id na tela Detalhe (empresa `pf`).
- CRM N1: `conectarIntegracao` sem credenciais, upload de Conhecimento só com
  metadados, checagem "Formulário desatualizado" na API pública.
- Trocar `A7`/`aquecer` por documentação clara em
  `docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md`.

---

## Decisões que só você pode tomar

1. **Pausar o painel `financeiro-tria.vercel.app` agora?** Recomendo sim:
   destrava 4.3 e 4.6 e as telas já existem no CRM N1. Rollback é despausar.
2. **Quando rodar as credenciais (4.1)?** Recomendo Omie e VPS hoje; Postgres
   do CRM N1 junto com a Etapa 2.
3. **A7:** despublicar (recomendo) ou manter em paralelo à regra nova.
4. **Push/PR** do `financeiro-tria` e merge de `integra-frontend-main` na sua
   branch do `crm-n1` (e depois em `main`).
5. **Conta de teste da Etapa 3:** valor e fornecedor real a usar.
6. **Ordem entre Etapa 1 e Etapa 4:** recomendo começar pela 1 e pelas 4.1,
   4.2 e 4.4 ao mesmo tempo.

---

## Anexo A — Achados com evidência

Severidade: 🔴 dinheiro/produção, 🟠 confiabilidade, 🟡 dívida.

**Lançamento no Omie (`financeiro-tria/automation/src`)**
- 🔴 Fornecedor não resolvido: `tenants/tria/contas-a-pagar-lancamento.ts:183` envia `entrada.fornecedor.documento` cru como `codigoClienteFornecedor`; nenhum `ensureSupplier` no caminho (`http/contas-a-pagar-routes.ts:367-399`). Legado: `payment-automation-service.ts:1417-1430, 1886-1901`. Confirmado 3/3.
- 🔴 Falha silenciosa em loop: `lancamento.ts:198-205` → `ErroTransitorio(ERRO_INTERNO)` → `routes.ts:188-201` 500 `retryable:true` → ponte `invocar-agente.ts` só `continue`. Fault do `IncluirContaPagar` não é logado. Confirmado (com a ressalva de que leituras falham como 422 permanente: `lancamento.ts:139` fora do `try`).
- 🔴 `/lancar` nunca testado contra o Omie real: `.planning/phases/03-contas-a-pagar/03-07-SUMMARY.md:98` (Task 4 parada). VPS `4149032` não tem a rota.
- 🟠 Consulta falha aberta: `adapters/omie.ts:350-363` engole erro e devolve `null` → segue para `IncluirContaPagar`. Sob concorrência, quem impede duplicata é só o Omie (Client-102/Client-6, `omie.ts:313-344`).
- 🟠 Timeout de 10 s na ponte (`invocar-agente.ts`, `timeoutMs` padrão) contra `/lancar` com 6-8 chamadas em série a 4 rps (`omie.ts:671-679`).
- 🟠 Conta corrente sem match cai na primeira da lista, sem aviso (`contas-a-pagar-resolucao.ts`, `resolveContaPagamento`); Tag `conta ...` ignorada.
- 🟠 Similaridade fictícia `1` no fallback `ilike` e em linhas sem embedding (`resolucao.ts:219, 237`; `adapters/supabase.ts:327-334`).
- 🟠 Chave Pix vai com pontuação; `classifyPixKey` (`payment-rules.ts:484-504`) não é usada no caminho novo.
- 🟡 `reaproveitado` só na 1ª consulta (`lancamento.ts:164-173`; `omie.ts:269`).
- ✅ Idempotência em sequência: `Idempotency-Key` = `tria:contas-a-pagar:<taskId>` obrigatória (`routes.ts:289-297`), consulta antes de incluir (`lancamento.ts:164`; `omie.ts:64, 76, 247`). Nada gravado no Supabase do Financeiro (só leitura de `conciliador_contas`, `supabase.ts:314-334`).
- ✅ Credencial pelo Centro de Custo (`payment-rules.ts:303-326`); Pix → cnab `TRA/01.3` (`omie.ts:205-270`).

**Segurança (`financeiro-tria`)**
- 🔴 Rotas de escrita sem autenticação: `http/routes.ts:302-362`, `http/workflow-routes.ts:40`, `http/plano-contas-routes.ts:102, 129`, `http/invoice-webhooks.ts:92, 95`. Webhooks ClickUp sem assinatura (`routes.ts:194-263`).
- 🔴 `GET /financeiro/solicitacoes` (`routes.ts:334`) devolve a linha inteira com credenciais Omie; `anon_read using(true)` ativa (`supabase/migrations/20261001120000_remove_anon_read_painel.sql` não aplicada).
- 🔴 Credenciais Omie do Marcos Paulo no código: `tenants/marcos-paulo/config.ts:34-35`.
- 🔴 Classificador: `adapters/ai.ts:701-704` (ordem das regex), `:633-639` (prompt), `:644-646` (fallback). Confirmado por execução.
- 🔴 Login do painel decorativo (`src/contexts`, variáveis `VITE_*`, `localStorage 'auth'`).
- 🟠 `automation/` local em todas as interfaces (`server.ts:73`), firewall do macOS desligado.
- 🟠 `PLATAFORMA_LEITURA_TOKEN` autoriza `repetir-passo` com `launch_omie` e `executar` workflows (`http/leituras-plano-contas-routes.ts`).
- 🟠 `lerCorpoBruto` com `JSON.parse` fora do `try` (`http/leituras-plataforma-comum.ts`), sem `unhandledRejection`.
- 🟠 `supabase db push` perigoso: migrações de 09-22/09-25 aplicadas à mão; índice único bloqueado por 180 `TaskID` duplicados.

**Integração com a plataforma (Fase 2)**
- 🔴 `/webhooks/plataforma/solicitacao-criada` sempre 422: `startPaymentRequest` usa `legacyClickUpRaw().getTask()` (`payment-automation-service.ts`).
- 🔴 `PAYMENT_REQUEST_SOURCE=plataforma` na VPS sem `PLATAFORMA_BASE_URL/SERVICE_TOKEN` derruba o boot (`requiredEnv` no carregamento de `adapters/plataforma.ts`).
- 🟠 Fila sem worker, sem expiração de lease, `reivindicarCabeca` por qualquer Tarefa (`adapters/platform-adapter-queue.ts`).
- 🟠 `solicitacaoInput()` não carrega `origem` → insere segunda linha (`webhooks-plataforma.ts`, `handlePlatformApprovalDecision`).
- 🟠 Receipt preso em `recebido`/`falhou` vira `202 duplicated` para sempre (`http/receipts-da-plataforma.ts`).

**Boot e jobs**
- ✅ Só dois timers em todo `automation/src`, ambos em `server.ts:98-132` (cron NF 09h/10h; drenagem). Execução local de hoje: ambos desligados, nenhuma duplicação da VPS. Confirmado 3/3.
- 🔴 Subir local com o `.env` de produção sem `INVOICE_CRON_ENABLED=false` emite NF em dobro com a VPS (lock só em memória, códigos aleatórios).
- 🟠 `vite-node --watch` no `apps/api` reexecuta `index.ts` no mesmo processo sem parar workers (`index.ts:55-135`).

**Testes e saúde**
- Typecheck `automation/`: limpo. 22 arquivos, 322 testes; isolados (cwd vazio + guarda de rede): 320 passam. Falhas reais: `payment-rules.test.ts:37` (env), `classificador-de-aprovacao.test.ts:180` (bug 4.5). `npm test` dentro de `automation/` **não é seguro** (`adapters/env.ts:5-14` carrega o `.env` no import; teste (g) chama a OpenAI).
- Nenhum teste cobre `contasAPagarRouter()` real nem o campo do fornecedor. Sem fixture de contrato para contas a pagar. Sem CI.
