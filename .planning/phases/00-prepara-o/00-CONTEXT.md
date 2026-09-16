# Phase 0: Preparação - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Tudo o que a Phase 2 consome existe e é confiável: a Lista real de Solicitação de pagamento está exportada e descrita numa spec no padrão de `contas-a-pagar.md`; as três Listas do ClickUp estão em disco como insumo da importação e prova de paridade; os usuários do ClickUp têm um de-para para Membros. Esta fase produz **insumos** (dados, documentos, tabelas) — não telas, não rotas, não operações do domínio.

**Já feito e commitado:** PREP-01 (schema `plataforma`, `b20597d`) e PREP-06 (volume do legado medido, 2026-09-15). Esta discussão cobre o que resta: PREP-02 (exportação), PREP-03 (spec da Solicitação — o maior risco do plano), PREP-04 (de-para). PREP-05 (rotação Omie) foi **retirado por decisão do dono** — ver D-13.

Corre em paralelo com a Phase 1 (que ainda tem 01-12..01-16 planejados e não executados); nada aqui depende dela. PREP-03 e PREP-04 bloqueiam a Phase 2.

Fora do escopo: importar qualquer coisa para o banco da plataforma (Fases 2 e 3), o formulário de Solicitação (SOL-02), o adapter `plataforma.ts` no `automation/` (SOL-05), qualquer mudança no `financeiro-tria` (D-DEC-11).

</domain>

<decisions>
## Implementation Decisions

### Exportação do ClickUp (PREP-02)
- **D-01:** O exportador vive **no monorepo, em `apps/api/src/importacao/clickup/`**, ao lado do futuro importador das Fases 2/3 que vai consumir exatamente esse formato. `CLICKUP_API_TOKEN` só no `.env` do `apps/api` (via `carregarEnv()`), documentado em `.env.example`. Entra no `npm run check`. O `automation/` do financeiro-tria não muda (D-DEC-11), mesmo já tendo `adapters/clickup.ts` e o token na VPS.
- **D-02:** Os dados exportados ficam **fora do git**, numa pasta ignorada (ex.: `apps/api/exportacoes/clickup/`, entrada no `.gitignore`). No repositório entra só um **manifesto** commitado: data da exportação, contagens por Lista e por recurso (Tarefas, Comentários, entradas de histórico, anexos), hashes dos arquivos. O manifesto é a prova de paridade (CON-09) sem expor CPF/CNPJ, dados bancários e NFs que vivem em comentários e anexos. Backup da pasta é responsabilidade do dono.
- **D-03:** Formato: **JSON bruto da API do ClickUp, sem transformar** — um arquivo por recurso e por página (tasks, comments, status history, custom fields da Lista, members, metadados de attachments), exatamente como a API devolve. O mapper (equivalente ao `clickup-payment-mapper.ts`) nasce na importação, não aqui. Nenhum índice normalizado nesta fase.
- **D-04:** **Anexos são baixados agora**, para a mesma pasta fora do git, nomeados por `<task id>/<attachment id>-<nome original>`, com hash no manifesto. Motivo: as URLs do ClickUp podem deixar de valer quando a Lista for arquivada (critério 4 da Phase 2), e a plataforma ainda não tem storage — o upload fica para a importação.

### Spec da Solicitação de pagamento (PREP-03)
- **D-05:** Fonte da verdade: **a exportação real da Lista `901109104938` + o código do `automation/`** (`payment-rules.ts`, `clickup-payment-mapper.ts`, prompts). Claude rascunha `docs/07-processos/solicitacao-de-pagamento.md` no padrão de `contas-a-pagar.md` (mesmas seções §1–§12), marcando explicitamente o que o código e os dados **não** mostram (o que as pessoas fazem fora do sistema); o dono/Financeiro responde só as lacunas marcadas. **PREP-02 vem antes de PREP-03** — a spec é lida da exportação.
- **D-06 (fecha D6 do plano):** A Solicitação vive numa **Lista própria** ("Solicitações de pagamento"), com Vínculo Solicitação → Conta a pagar. Motivos: aprovador e prazo próprios; nem toda Conta nasce de Solicitação; espelha as duas Listas de hoje. A spec descreve o Vínculo e o momento em que a Conta nasce da Solicitação.
- **D-07 (fecha D8 do plano):** Aprovação **por clique é o caminho oficial** (Solicitação de Aprovação, critério 2 da Phase 2). O classificador de comentário por IA fica como **fallback por 90 dias**, medido (quantas aprovações vêm por comentário), desligado se ninguém usar. A spec registra os dois caminhos e a data de revisão.
- **D-08 (OQ-CMP-01/02/04):** A spec **absorve e decide pelo que a exportação mostrar**: `Cartão` e `Link de pagamento` entram como opções do Campo de forma de pagamento se a Lista real os usa; `em revisão` entra como Status se aparece no histórico; a validação de CPF (dígito) e CNPJ (`publica.cnpj.ws`) **fica no `automation/`** (regra do pipeline, D-DEC-11) — a spec diz onde roda, não a reimplementa. O que não aparecer na exportação vai para a §12 ("o que não foi verificado e precisa de decisão"), explicitamente aberto.

### De-para de usuários (PREP-04)
- **D-09:** O de-para mapeia **ClickUp user ID → e-mail (identidade) + Papel esperado**, resolvido **na importação** (Fases 2/3): o e-mail vira Membro por `inviteMember` — `pendente` se a pessoa ainda não entrou, reativado se já existiu (RN-ET-11, o caminho que 01-10 blindou). Não exige Membros existirem agora (coerente com D-08 da Phase 1: só a Maryane, os demais por convite).
- **D-10:** Mora em **`apps/api/src/importacao/clickup/de-para-usuarios.ts`** — tipado, ao lado do exportador e do futuro importador; entra no typecheck; com teste.
- **D-11:** Os **6 e-mails reais ficam no arquivo versionado** (Elifas `81591229`, Fabíola `81581798`, Thiago `81581826`, Iallas `81582295`, Financeiro `81581816`, revisor FO `81581802`): são e-mails corporativos que já aparecem no `automation/` e nos docs. Nada de senha, token ou credencial.
- **D-12:** Autores fora dos 6 (ex-funcionários, bots, o próprio ClickUp): o exportador **lista todos os user ids encontrados** (em Tarefas, comentários e histórico) com contagem; quem não está no de-para vira, na importação, **Ator `sistema` / origem `clickup` preservando o nome original** no Registro de Atividade — nenhum Membro fantasma. As **38 variáveis `CLICKUP_*`** do `automation/` são catalogadas no mesmo arquivo (id, uso); só as que são ids de usuário entram no de-para.

### Credenciais Omie (PREP-05)
- **D-13:** **Não rotacionar. As credenciais Omie atuais continuam em uso** — decisão do dono em 2026-09-16 ("pode usar as mesmas credenciais do Omie"). Consequência aceita: elas permanecem no histórico do git do `financeiro-tria` (`tenants/marcos-paulo/config.ts`) e por linha em `solicitacoes_pagamentos`/`transacoes`. **PREP-05 e o critério 4 da Phase 0 no ROADMAP devem ser marcados como "risco aceito pelo dono", não como pendentes** — o verificador da fase não deve cobrá-los. CON-10 continua valendo para o que a plataforma cria: nas telas e Integrações novas, credencial só na Integração, nunca por linha, nunca copiada na importação.

### Claude's Discretion
- Nome exato da pasta fora do git e do script (`npm run exportar:clickup -w @n1/api`, no padrão de `migrar` / `bootstrap:gestao` com `vite-node`).
- Formato do manifesto (JSON vs. markdown), granularidade dos hashes (por arquivo), e se o manifesto guarda o `date_updated` mais recente por Lista para permitir re-exportação incremental depois.
- Paginação, rate limit (100 req/min no ClickUp) e retomada de exportação interrompida.
- Como catalogar as 38 `CLICKUP_*` (tabela no mesmo arquivo TS vs. arquivo irmão).
- Se a Lista de Contas a receber (`901107648977`, dormente desde out/2025) é exportada com o mesmo cuidado de anexos ou só Tarefas + campos + histórico.
- Ordem entre PREP-02 e PREP-04 (independentes); PREP-03 depende de PREP-02.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisões já travadas (não rediscutir)
- `.planning/PROJECT.md` — bloco `<decisions>`: D-DEC-08 e D-DEC-13 (dois projetos Supabase distintos; nada de JOIN entre `plataforma` e `public`), D-DEC-11 (o `automation/` fica como está), D-DEC-14 (adapter por HTTP, 7 métodos), D-DEC-17 (`TaskID` + `origem`). Candidata CAND-03 (observabilidade legada descartável — orienta o que **não** exportar).
- `.planning/phases/01-o-crm-n1-ganha-persist-ncia-e-login/01-CONTEXT.md` — D-08 (só a Maryane é Membro; os demais por convite) e D-09 (e-mail de teste por enquanto): o de-para não pode assumir Membros existentes.

### O plano e os requisitos
- `docs/08-migracao-financeiro/03-plano-de-migracao.md` §3 Fase 0 (entregáveis e "por quê"), §7 (D6, D8 — fechados aqui por D-06/D-07).
- `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §3 (pipeline de 7 etapas — o que o `automation/` faz com a Solicitação), §4 (acoplamento com o ClickUp: os 7 métodos e `CLICKUP_API_TOKEN`), §5.7 (volume real: 1.110 solicitações).
- `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` — como o ClickUp mapeia para a ontologia (Lista, Status, Campo, Tag).
- `.planning/REQUIREMENTS.md` — PREP-02, PREP-03, PREP-04 (aceites), CON-09 (importação com paginação e datas originais), CON-10 (credencial nunca copiada), CON-11 (os 6 ids).

### Padrão da spec (PREP-03 copia a forma)
- `docs/07-processos/contas-a-pagar.md` — §1–§12; em especial §3 (Conjunto de Status com transições observadas no histórico), §4 (Campos por grupo), §6 (fluxo passo a passo), §10 (permissões), §11 (regras a validar), §12 (o que não foi verificado).
- `docs/07-processos/contas-a-receber.md` — segundo exemplo do padrão.

### Código do `automation/` a ler para a spec (repositório `financeiro-tria`, fora deste monorepo)
- `automation/src/**/payment-rules.ts` — prazo, documento, roteamento por centro de custo e valor, parsers (619 linhas, com teste).
- `automation/src/**/clickup-payment-mapper.ts` — extração de campos **pelo nome** (lista os nomes reais dos Campos da Lista).
- `automation/src/**/adapters/clickup.ts` — os 7 métodos e a forma das respostas da API.
- Prompts do classificador de comentário e do RESUMO (formato do `📋 RESUMO DE PAGAMENTO` — CON-CP-08 é contrato entre os dois sistemas).

### Convenções
- `CONTEXT.md` (raiz), `apps/api/CONTEXT.md` — regra de dependência; um `CONTEXT.md` por pasta nova (`apps/api/src/importacao/` ganha o seu).
- `apps/api/README.md` — variáveis de ambiente e como rodar scripts com `vite-node`.
- `.planning/codebase/CONVENTIONS.md`, `TESTING.md`, `INTEGRATIONS.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `carregarEnv()` em `apps/api/src/persistencia/conexao.ts` — já resolve `.env` sem `dotenv`; o exportador lê `CLICKUP_API_TOKEN` por ele.
- Padrão de CLI com `vite-node` (`migrar`, `usuarios:seed`, `bootstrap:gestao` em `apps/api/package.json`) — o exportador é mais um script nesse padrão.
- `inviteMember` (`packages/dominio/src/operations/members.ts`, já casando por `userId` OU `invitedIdentity` desde 01-10) e `convidarMembro` (`apps/api/src/servicos/convidar-membro.ts`, resolve e-mail → `userId` na Admin API) — é o caminho que o de-para vai usar na importação; nesta fase só precisa existir a tabela.
- `zod` já no `apps/api` — para tipar o de-para e validar a forma dos JSONs exportados no teste.
- `docs/07-processos/contas-a-pagar.md` — não é código, mas é o molde exato da spec.

### Established Patterns
- Testes de integração pulam sem a variável de ambiente (D-DEC-09): o teste do exportador pula sem `CLICKUP_API_TOKEN`; o teste do de-para e do parser do manifesto rodam sempre.
- Identificadores em inglês, strings/comentários/documentos em pt-BR; comentários dizem **por quê**.
- Migrações e scripts são idempotentes e re-executáveis — a exportação deve poder ser re-rodada (prova de paridade) sem duplicar arquivos.
- `.gitignore` já ignora `.env*` (com exceções `.env.example`); a pasta de exportação segue o mesmo mecanismo.

### Integration Points
- `apps/api/src/importacao/clickup/` — pasta nova (exportador, `de-para-usuarios.ts`, `CONTEXT.md`); o importador das Fases 2/3 nasce ao lado.
- `apps/api/package.json` — script `exportar:clickup`; `apps/api/.env.example` — `CLICKUP_API_TOKEN`.
- `.gitignore` (raiz ou `apps/api/`) — pasta de exportação.
- `docs/07-processos/solicitacao-de-pagamento.md` — arquivo novo (PREP-03).
- `docs/08-migracao-financeiro/` — manifesto da exportação (ou `apps/api/exportacoes/MANIFESTO.md`, a critério do planejador) e a nota sobre D-13.
- `.planning/ROADMAP.md` (critério 4 da Phase 0) e `.planning/REQUIREMENTS.md` (PREP-05) — a atualizar para "risco aceito" (D-13).

</code_context>

<specifics>
## Specific Ideas

- "A spec tem que dizer o que as pessoas fazem, não só o que o código automatiza" — é a lacuna que o plano aponta e a razão de ler a Lista real, não o `automation/`.
- Reprodutibilidade: a mesma exportação re-rodada depois da importação é a prova de paridade — por isso bruto, com manifesto e hashes.
- LGPD guiou D-02 e D-04: dados pessoais e financeiros ficam fora do git; o repo guarda só contagens e hashes.
- D-06 e D-07 seguem exatamente as recomendações do plano (§7) — o dono confirmou em vez de reabrir.

</specifics>

<deferred>
## Deferred Ideas

- **Rotação das credenciais Omie** — retirada desta fase por D-13 (usar as mesmas). Se voltar, o caminho era: roteiro passo a passo (gerar app key/secret no Omie do Marcos Paulo, trocar em `tenants/marcos-paulo/config.ts` + `.env` da VPS, reiniciar PM2, revogar as antigas) + nota datada em `docs/08-migracao-financeiro/` com o erro de autenticação das antigas como prova. Sem fase definida.
- **Limpeza do histórico do git do `financeiro-tria`** — não discutida; só faz sentido junto com uma rotação.
- **Índice normalizado por Lista** (CSV/JSON achatado por Tarefa) — descartado em D-03; pode voltar se a leitura do bruto para a spec se mostrar lenta.
- **Supabase Storage para a exportação** — descartado em D-02; a plataforma não tem storage ainda, volta quando a importação precisar dos anexos no banco (Fase 2/3).

</deferred>

---

*Phase: 00-prepara-o*
*Context gathered: 2026-09-16*
