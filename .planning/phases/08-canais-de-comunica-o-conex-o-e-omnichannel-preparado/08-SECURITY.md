---
phase: "08"
slug: "canais-de-comunica-o-conex-o-e-omnichannel-preparado"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-12"
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| navegador → `apps/api` | sessão (JWT Supabase) → rotas REST `/canais`, `/conversas`, `/mensagens` e `GET /estado` | corpo das Mensagens, identificadores de conta (número/handle), ids de Canal/Conversa |
| Papel do Membro → ações de Canal/Conversa | `exigir(acesso, membro, ação, recurso)` antes de toda transação (B35) | autorização por Papel |
| Espaço A ↔ Espaço B | todo `WHERE` por `workspace_id`; FKs compostas da 008 | isolamento multi-tenant |
| `plataforma.registros` ↔ tabelas relacionais (008) | projeção de Canais em `GET /estado`/`executar()` sem gravação de volta | estado do Espaço |
| provedor (futuro) → `carga_bruta` | payload cru guardado e nunca servido por HTTP | dado pessoal |
| dono → banco da plataforma | aplicação da migração 008 (one-way) | schema de produção |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Information disclosure | `GET /canais`, `GET /estado` (08-01) | high | mitigate | `workspaceId` só de `request.membro.workspaceId`; `workspace_id = $1` em todo `WHERE` do repositório e de `todos`; teste (h) prova que o Espaço B não vê o Ca… — _evidência:_ `workspace_id = $1` em todas as leituras de `repositorios/crm/canais.ts` (9/9); teste (h) | closed |
| T-08-02 | Tampering | `POST /canais` (mass assignment) (08-01) | high | mitigate | `NOVO_CANAL` `.strict()` com só `provedor`/`nome`/`identificador`; `tipo` derivado do provedor no domínio; `conexao`/`estado`/`conexao_simulada` nunca enviad… — _evidência:_ `.strict()` ×5 em `rotas/crm/canais.ts` | closed |
| T-08-03 | Elevation of privilege | `POST /canais` por Membro/Convidado (08-01) | high | mitigate | `exigir(acesso, membro, "criar", "canal")` antes da transação, com `podeNoCrm` estendido (B35); teste (g) — _evidência:_ `exigir(` ×5 em `servicos/crm/canais.ts` | closed |
| T-08-04 | Information disclosure | 409 de unicidade (08-01) | medium | mitigate | `FRASES` traduz `canais_nome_uq`/`canais_conta_uq` em frase pt-BR sem nome de constraint; SQLSTATE desconhecido → 500 genérico — _evidência:_ mitigação aplicada conforme SUMMARY de 08-01 ("Threat Flags") e testes do plano verdes | closed |
| T-08-05 | Denial of service | `GET /estado` num banco sem a 008 (08-01) | high | mitigate | guarda `to_regclass` em `carregarCanaisProjetados` (teste j/k); a 008 é aplicada em 08-14 antes de o portão rodar contra o banco da plataforma — _evidência:_ `to_regclass('plataforma.canais')` em `persistencia/canais-projetados.ts:65` | closed |
| T-08-06 | Tampering | projeção vazando para `plataforma.registros` (08-01) | high | mitigate | projeção fora de `hidratar()`; teste (n) mede `colecao = 'channels'` antes/depois; `executar()` retira os projetados antes de `gravar()` em 08-07 — _evidência:_ `semCanaisProjetados` em 10 pontos de `persistencia/`; teste (n) | closed |
| T-08-07 | Information disclosure | segredo de provedor (08-01) | low | accept | a 008 não tem coluna de credencial; o formulário pede só nome e identificador (D-03) — _evidência:_ risco aceito e documentado no plano 08-01 (ver Accepted Risks Log) | closed |
| T-08-08 | Tampering | slug `[provedor]` da URL (08-01) | low | mitigate | `ehProvedorDeCanal` antes de indexar `PROVEDORES`; slug desconhecido → `notFound()`; teste (q) — _evidência:_ `ehProvedorDeCanal` + `notFound()` em `conectar/[provedor]/page.tsx:19` | closed |
| T-08-09 | Tampering | regra de janela (RN-CXE-19) divergindo entre tela e domínio (08-02) | medium | mitigate | uma função só (`capacidadesDoCanal`) lida por domínio e web; o grep de verificação garante que não sobrou leitor por tipo — _evidência:_ mitigação aplicada conforme SUMMARY de 08-02 ("Threat Flags") e testes do plano verdes | closed |
| T-08-10 | Elevation of privilege | Canal sem `provider` tratado como não oficial (envio fora da janela) (08-02) | medium | mitigate | `provedorDoCanal` cai no padrão do tipo (`whatsapp-cloud`): só um Canal marcado `whatsapp-nao-oficial` perde a janela; teste do seed sem `provider` igual à t… — _evidência:_ mitigação aplicada conforme SUMMARY de 08-02 ("Threat Flags") e testes do plano verdes | closed |
| T-08-11 | Tampering | `configurarCanal` alterando Canal projetado da tabela (08-02) | medium | mitigate | recusa no domínio para `relational: true`; a ponte de 08-07 ainda lança se uma operação mudar um projetado — _evidência:_ mitigação aplicada conforme SUMMARY de 08-02 ("Threat Flags") e testes do plano verdes | closed |
| T-08-12 | Elevation of privilege | editar/simular/desconectar/arquivar por Membro (08-03) | high | mitigate | `exigir(..., "canal")` com a ação específica antes da transação; testes de 403 por ação — _evidência:_ `exigir(` por ação em `servicos/crm/canais.ts`; testes de 403 | closed |
| T-08-13 | Information disclosure | `GET /canais/:id` de outro Espaço (IDOR) (08-03) | high | mitigate | `obter` com `workspace_id = $1 and id = $2`; 404 (não 403); teste (f) — _evidência:_ `workspace_id = $1 and id = $2` no `obter`; 404; teste (f) | closed |
| T-08-14 | Tampering | `PATCH` trocando `tipo`/`identificador`/`conexao` (INV-CXE-02) (08-03) | high | mitigate | `EDICAO_DE_CANAL` `.strict()` com três campos; `atualizar` com lista fixa de colunas; teste (a) — _evidência:_ `EDICAO_DE_CANAL` `.strict()`; colunas fixas | closed |
| T-08-15 | Tampering | `filaPadraoId`/`origemPadraoId` de outro Espaço (08-03) | medium | mitigate | `filaAtiva`/`origemAtiva` escopadas por `workspace_id = $1`; 409 com `campo` — _evidência:_ mitigação aplicada conforme SUMMARY de 08-03 ("Threat Flags") e testes do plano verdes | closed |
| T-08-16 | Repudiation | "Simular conexão" fingindo conexão real (08-03) | medium | mitigate | `conexao_simulada = true` e `conectada_em` gravados; só administração; a marca visível sai em 08-09 — _evidência:_ mitigação aplicada conforme SUMMARY de 08-03 ("Threat Flags") e testes do plano verdes | closed |
| T-08-17 | Tampering | homônimo/conta duplicada entre o seed e a tabela nova (08-03) | low | mitigate | `canalAntigoEmConflito` antes do INSERT/UPDATE (A5) — _evidência:_ mitigação aplicada conforme SUMMARY de 08-03 ("Threat Flags") e testes do plano verdes | closed |
| T-08-18 | Tampering | SQL dinâmico no `UPDATE` e no filtro `q` (08-03) | high | mitigate | nomes de coluna de mapa constante; valores `$n`; `ilike` com `contemTexto` + `CLAUSULA_ESCAPE`; `ORDER BY` fixo — _evidência:_ `CLAUSULA_ESCAPE`/`contemTexto` em `repositorios/crm/canais.ts:163` | closed |
| T-08-19 | Tampering | Conversa/Mensagem cruzando Espaço ou Canal (08-04) | high | mitigate | FKs compostas da 008 provadas (provas 8 e 10); a Mensagem não pode estar noutro Canal que o da Conversa — _evidência:_ FKs compostas `(workspace_id, id)` na 008; provas 8 e 10 de 08-04 | closed |
| T-08-20 | Information disclosure | nome de constraint vazando no 409 do Contato (08-04) | medium | mitigate | `conversas_workspace_id_contato_id_fkey` traduzido em frase pt-BR em `FRASES`; sem frase → 500 genérico — _evidência:_ mitigação aplicada conforme SUMMARY de 08-04 ("Threat Flags") e testes do plano verdes | closed |
| T-08-21 | Denial of service | 500 na exclusão de Contato com Conversa (08-04) | medium | mitigate | pré-checagem `conversasDoContato` com 409 rico — _evidência:_ mitigação aplicada conforme SUMMARY de 08-04 ("Threat Flags") e testes do plano verdes | closed |
| T-08-22 | Spoofing | Mensagem `recebida` criada por pessoa (08-05) | high | mitigate | `DIRECOES_DE_ENVIO` sem `recebida` é a fonte do `z.enum` da rota (08-12); teste garante a ausência — _evidência:_ `DIRECOES_DE_ENVIO = ['enviada','interna']` (`dominio/crm/mensagens.ts:36`) | closed |
| T-08-23 | Information disclosure | `carga_bruta` no tipo público (08-05) | medium | mitigate | `interface Mensagem` sem o campo; só `MensagemRecebidaDoProvedor` (entrada interna) o tem — _evidência:_ mitigação aplicada conforme SUMMARY de 08-05 ("Threat Flags") e testes do plano verdes | closed |
| T-08-24 | Tampering | envio fora da janela pelo oficial (08-05) | medium | mitigate | `validarEnvio` (RN-CXE-19) com as capacidades por (tipo, provedor), aplicada no servidor em 08-12 — _evidência:_ mitigação aplicada conforme SUMMARY de 08-05 ("Threat Flags") e testes do plano verdes | closed |
| T-08-25 | Information disclosure | IDOR em `/conversas/:id`, `canalId`, `contatoId` (08-06) | high | mitigate | toda leitura por `workspace_id = $1`; Canal/Contato de outro Espaço → 404; FKs compostas da 008 como 2ª barreira — _evidência:_ `workspace_id = $1` em 6/6 leituras de `repositorios/crm/conversas.ts` | closed |
| T-08-26 | Tampering | mass assignment de `situacao`/`estado`/`atribuido`/`criadoPor` (08-06) | high | mitigate | `NOVA_CONVERSA` e o `mensagem` aninhado `.strict()`; atribuição e autoria só da sessão; testes (b)/(c) — _evidência:_ `.strict()` ×4 em `rotas/crm/conversas.ts`; testes (b)/(c) | closed |
| T-08-27 | Elevation of privilege | Convidado abrindo/resolvendo Conversa (08-06) | medium | mitigate | `exigir(..., "conversa")` antes da transação; teste de 403 — _evidência:_ mitigação aplicada conforme SUMMARY de 08-06 ("Threat Flags") e testes do plano verdes | closed |
| T-08-28 | Denial of service | listagem sem teto (08-06) | low | mitigate | `limite ≤ LIMITES_CRM.paginaMaxima` (200) — _evidência:_ mitigação aplicada conforme SUMMARY de 08-06 ("Threat Flags") e testes do plano verdes | closed |
| T-08-29 | Information disclosure | conteúdo de Mensagem em log (08-06) | medium | mitigate | o serviço não loga `conteudo`; erros genéricos do `setErrorHandler` não ecoam o corpo — _evidência:_ mitigação aplicada conforme SUMMARY de 08-06 ("Threat Flags") e testes do plano verdes | closed |
| T-08-30 | Tampering | Canal projetado gravado em `registros` (duas fontes de verdade) (08-07) | high | mitigate | `gravar` recebe `semCanaisProjetados`; teste mede `colecao = 'channels'` antes/depois — _evidência:_ `semCanaisProjetados` em `gravar`; teste mede `colecao = 'channels'` | closed |
| T-08-31 | Tampering | operação antiga alterando Canal da tabela (08-07) | medium | mitigate | `semCanaisProjetados` lança e a transação é desfeita; `configurarCanal` já recusa (08-02) — _evidência:_ mitigação aplicada conforme SUMMARY de 08-07 ("Threat Flags") e testes do plano verdes | closed |
| T-08-32 | Denial of service | consulta da projeção dentro da transação num banco sem a 008 (08-07) | high | mitigate | guarda `to_regclass` (lista vazia sem segunda consulta); teste no banco só com 001..007; aplicação em 08-14 antes do portão — _evidência:_ guarda `to_regclass` dentro da transação; teste com 001..007 | closed |
| T-08-33 | Tampering | slug `[provedor]` arbitrário (08-08) | low | mitigate | `ehProvedorDeCanal` no Server Component antes de qualquer render; `notFound()`; React escapa todo texto exibido — _evidência:_ mitigação aplicada conforme SUMMARY de 08-08 ("Threat Flags") e testes do plano verdes | closed |
| T-08-34 | Elevation of privilege | Membro usando o formulário pelo DevTools (08-08) | medium | mitigate | `usePodeNoCrm` só esconde/desabilita; `POST /canais` aplica `exigir(..., "criar", "canal")` (403, 08-01) — _evidência:_ mitigação aplicada conforme SUMMARY de 08-08 ("Threat Flags") e testes do plano verdes | closed |
| T-08-35 | Information disclosure | credencial digitada num campo errado (08-08) | low | accept | o formulário não pede token nem senha (D-03); o espaço reservado não tem campo — _evidência:_ risco aceito e documentado no plano 08-08 (ver Accepted Risks Log) | closed |
| T-08-36 | Repudiation | conexão simulada confundida com conexão real (08-09) | medium | mitigate | marca "conexão simulada" no cabeçalho, faixa de aviso com o texto fixo, só para quem administra; `conexao_simulada` gravado (08-03) — _evidência:_ mitigação aplicada conforme SUMMARY de 08-09 ("Threat Flags") e testes do plano verdes | closed |
| T-08-37 | Elevation of privilege | Membro forçando "Simular conexão" (08-09) | high | mitigate | botão ausente por `usePodeNoCrm`; o servidor responde 403 (08-03) — a tela só esconde — _evidência:_ `usePodeNoCrm` na tela + `exigir` no servidor (403) | closed |
| T-08-38 | Tampering | Canal do seed gravado por REST ou relacional pela operação antiga (08-09) | medium | mitigate | `configurar` decide por `channel.relational`; teste do comportamento 5 cobre os dois caminhos; `configurarCanal` recusa relacional (08-02) — _evidência:_ mitigação aplicada conforme SUMMARY de 08-09 ("Threat Flags") e testes do plano verdes | closed |
| T-08-39 | Tampering | XSS por conteúdo de Mensagem ou nome de Canal (08-10) | high | mitigate | React escapa; nenhum `dangerouslySetInnerHTML` com `content`, `subject` ou `name` (o grep do portão em 08-15 confere) — _evidência:_ `git grep dangerouslySetInnerHTML=` vazio em `features/crm` e páginas da Caixa (rc=1) | closed |
| T-08-40 | Tampering | "Responder por" mudando o Canal de uma Conversa (INV-CXE-04) (08-10) | high | mitigate | a troca só chama `startConversation`, que reutiliza ou cria; teste do 5º comportamento confere os `channelId` — _evidência:_ `startConversation(data, memberId, canal.id, contact.id)` em `conversation-thread.tsx:371` | closed |
| T-08-41 | Spoofing | enviar pelo Canal errado entre dois WhatsApps (08-10) | medium | mitigate | a aba e o compositor usam o id do Canal (não "o primeiro do tipo"); `canalAtivoId` por tipo removido — _evidência:_ mitigação aplicada conforme SUMMARY de 08-10 ("Threat Flags") e testes do plano verdes | closed |
| T-08-42 | Information disclosure | `?canal=` com id de Canal de outro Espaço (08-11) | low | accept | o filtro só compara ids dentro de `state.channels`/`state.conversations` já escopados pelo `GET /estado` do Espaço da sessão; id desconhecido dá lista vazia — _evidência:_ risco aceito e documentado no plano 08-11 (ver Accepted Risks Log) | closed |
| T-08-43 | Tampering | nome de Canal com HTML (08-11) | low | mitigate | renderizado como texto pelo React; sem `dangerouslySetInnerHTML` — _evidência:_ mitigação aplicada conforme SUMMARY de 08-11 ("Threat Flags") e testes do plano verdes | closed |
| T-08-44 | Spoofing | Mensagem `recebida` forjada pela api humana (08-12) | high | mitigate | `direcao: z.enum(DIRECOES_DE_ENVIO)` sem `recebida`; `idExterno`/`ator`/`canalId` fora do corpo `.strict()`; teste (b)/(c) — _evidência:_ `direcao: z.enum(DIRECOES_DE_ENVIO)` em `rotas/crm/mensagens.ts:43`; `.strict()` ×3; testes (b)/(c) | closed |
| T-08-45 | Information disclosure | `carga_bruta` (dado pessoal) em resposta (08-12) | high | mitigate | `COLUNAS_DE_MENSAGEM` sem a coluna; `cargaBruta()` sem rota; teste (f) na string crua da resposta — _evidência:_ `COLUNAS_DE_MENSAGEM` sem `carga_bruta` (0 ocorrências); só `cargaBruta()` lê a coluna; teste (f) | closed |
| T-08-46 | Information disclosure | conteúdo/carga em log (08-12) | medium | mitigate | serviço não loga `conteudo` nem `cargaBruta`; erros genéricos do `setErrorHandler` — _evidência:_ mitigação aplicada conforme SUMMARY de 08-12 ("Threat Flags") e testes do plano verdes | closed |
| T-08-47 | Tampering | envio fora da janela do oficial (08-12) | medium | mitigate | `validarEnvio` com `capacidadesDoCanal` no servidor, independente da tela — _evidência:_ mitigação aplicada conforme SUMMARY de 08-12 ("Threat Flags") e testes do plano verdes | closed |
| T-08-48 | Tampering | "em resposta a" de outra Conversa (08-12) | medium | mitigate | FK composta da 008 + frase `RESPOSTA_DE_OUTRA_CONVERSA` — _evidência:_ mitigação aplicada conforme SUMMARY de 08-12 ("Threat Flags") e testes do plano verdes | closed |
| T-08-49 | Denial of service | JSONB abusivo em `cargaBruta`/`anexos` (08-12) | low | accept | sem rota pública de ingestão nesta fase; `bodyLimit` do Fastify vale para o webhook futuro, que define teto próprio — _evidência:_ risco aceito e documentado no plano 08-12 (ver Accepted Risks Log) | closed |
| T-08-50 | Information disclosure | IDOR entre Espaços na Caixa de Entrada relacional (08-13) | high | mitigate | passo (i) do e2e prova 404 e lista vazia para Membro de outro Espaço em Canal, Conversa e Mensagem — _evidência:_ passo (i) de `e2e/canais-fluxo.test.ts` (404 e lista vazia entre Espaços) | closed |
| T-08-51 | Tampering | teste de banco rodando contra o Supabase do `.env` (08-13) | high | mitigate | `describeComBanco` só com host local (`testes/banco-crm.ts`); o comando do plano fixa `DATABASE_URL` local — _evidência:_ `hostEhLocal()` em `testes/banco-crm.ts:26` | closed |
| T-08-52 | Tampering | aplicação da 008 em produção (08-14) | high | mitigate | decisão do dono sobre o contrato antes (Task 1, `blocking-human`), conferência seca obrigatória, parada se a 008 já constar, aplicação pelo dono, confirmação… — _evidência:_ decisão do dono ("aplicar") e conferência seca antes/depois em `08-PROVAS.md`; a aplicação foi rodada pelo agente sob autorização explícita do dono (desvio registrado), com o humano no circuito em cada passo | closed |
| T-08-53 | Information disclosure | tabelas novas no schema `plataforma` (08-14) | low | accept | mesmo regime de `plataforma.registros` e das tabelas da 007: o `apps/api` é o único cliente, por `DATABASE_URL`; a exposição do schema pelo PostgREST do proj… — _evidência:_ risco aceito e documentado no plano 08-14 (ver Accepted Risks Log) | closed |
| T-08-54 | Information disclosure | segredo colado em `08-PROVAS.md` (08-14) | medium | mitigate | só as linhas do `migrar`; nenhuma `DATABASE_URL`, host ou senha — _evidência:_ mitigação aplicada conforme SUMMARY de 08-14 ("Threat Flags") e testes do plano verdes | closed |
| T-08-55 | Repudiation | portão "verde" escondendo regressão (08-15) | medium | mitigate | `fails_when` aceita só as duas falhas pré-existentes nomeadas; `08-PROVAS.md` lista cada arquivo que falhou com a razão — _evidência:_ mitigação aplicada conforme SUMMARY de 08-15 ("Threat Flags") e testes do plano verdes | closed |
| T-08-56 | Tampering | XSS no chat e nas páginas de Canal (08-15) | high | mitigate | grep de segurança do portão: nenhum atributo de HTML cru em `features/crm` e nas páginas da Caixa de Entrada — _evidência:_ grep de segurança do portão vazio (08-15, `08-PROVAS.md` "Portão") | closed |
| T-08-57 | Information disclosure | saída do portão com segredo em `08-PROVAS.md` (08-15) | low | mitigate | só resumos do vitest e a lista de rotas do build; nada de `.env` — _evidência:_ mitigação aplicada conforme SUMMARY de 08-15 ("Threat Flags") e testes do plano verdes | closed |
| T-08-SC | Tampering | instalações de pacote (08-01..15) | low | accept | nenhum pacote novo em nenhum dos 15 planos (`swr@2.5.1` e `lucide-react` já instalados na Fase 7) — _evidência:_ risco aceito e documentado no plano 08-01..15 (ver Accepted Risks Log) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-07 (08-01) | a 008 não tem coluna de credencial; o formulário pede só nome e identificador (D-03) | planner (08-01-PLAN.md `<threat_model>`), confirmado no fechamento da fase | 2026-10-12 |
| AR-08-02 | T-08-35 (08-08) | o formulário não pede token nem senha (D-03); o espaço reservado não tem campo | planner (08-08-PLAN.md `<threat_model>`), confirmado no fechamento da fase | 2026-10-12 |
| AR-08-03 | T-08-42 (08-11) | o filtro só compara ids dentro de `state.channels`/`state.conversations` já escopados pelo `GET /estado` do Espaço da sessão; id desconhecido dá lista vazia | planner (08-11-PLAN.md `<threat_model>`), confirmado no fechamento da fase | 2026-10-12 |
| AR-08-04 | T-08-49 (08-12) | sem rota pública de ingestão nesta fase; `bodyLimit` do Fastify vale para o webhook futuro, que define teto próprio | planner (08-12-PLAN.md `<threat_model>`), confirmado no fechamento da fase | 2026-10-12 |
| AR-08-05 | T-08-53 (08-14) | mesmo regime de `plataforma.registros` e das tabelas da 007: o `apps/api` é o único cliente, por `DATABASE_URL`; a exposição do schema pelo PostgREST do projeto, se houver, é assunto fora desta fase | planner (08-14-PLAN.md `<threat_model>`), confirmado no fechamento da fase | 2026-10-12 |
| AR-08-06 | T-08-SC (08-01..15) | nenhum pacote novo em nenhum dos 15 planos (`swr@2.5.1` e `lucide-react` já instalados na Fase 7) | planner (08-01..15-PLAN.md `<threat_model>`), confirmado no fechamento da fase | 2026-10-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-12 (secure-phase, L1: registro do planejamento + grep das mitigações `high` no código; sem auditor por ASVS 1)

## Security Audit 2026-10-12

| Metric | Count |
|---|---|
| Threats found | 58 |
| Closed | 58 |
| Open | 0 |
