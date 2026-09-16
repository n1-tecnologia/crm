# Phase 1: O CRM N1 ganha persistência e login - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

O CRM N1 deixa de ser protótipo: toda operação do domínio chega ao `apps/api` por HTTP e roda na Unidade de Trabalho (hidratar → operação pura → diff → revisão); o estado do Espaço de Trabalho vive no Postgres da plataforma, não no seed; o Espaço "Gestão" › Pasta "Financeiro" › Listas "Contas a pagar" e "Contas a receber" existem no banco, configuradas conforme os SPECs de processo, sem Tarefas fictícias.

**Metade já feita e commitada** (`9fb2754` → `d713253`): persistência com hidratação do `DataState` (PERS-01) e login no Supabase Auth com Membro resolvido por `Member.userId` (PERS-02). Esta discussão cobre o que resta: PERS-04 (rotas HTTP por operação), PERS-05 (`store.ts` → `POST`), PERS-06 (bootstrap do Espaço "Gestão"), PERS-07 (colunas geradas e índices), PERS-09 (reconvite). PERS-08 (onde o `apps/api` roda) está bloqueado por D11 e não é código desta fase.

Fora do escopo: qualquer capacidade nova (Solicitação de pagamento, motor de Automações, telas portadas) — pertencem às Phases 2–5.

</domain>

<decisions>
## Implementation Decisions

### Camada HTTP do `apps/api`
- **D-01:** **Fastify** em `apps/api`, processo próprio. Schema-first com `zod` nas bordas; tipagem de rota. É a recomendação D4 do plano, confirmada. Route handlers do Next e Hono foram considerados e descartados: o primeiro acoplaria a API ao app web e exigiria pooler + limites de serverless; o segundo não traz bateria inclusa.
- **D-02:** **Autenticação por JWT do Supabase, navegador → `apps/api` direto.** O front manda o access token em `Authorization: Bearer`; o Fastify verifica a assinatura contra o JWKS do projeto (`epomplsskqpluxuujpxl`) e resolve o Membro por `Member.userId === sub` dentro do Espaço de Trabalho. Sem estado, um salto só. O mesmo middleware serve depois ao `automation/` com um token de serviço (Phase 2, D-DEC-14). BFF via Next foi descartado: um salto a mais por operação e o Next viraria proxy de tudo.

### O que a API devolve depois de gravar
- **D-03:** `POST /operacoes/:nome` devolve **o `OperationResult` + só o que mudou**: os registros gravados e removidos (coleção, id, dados, ordem) e a revisão nova do Espaço de Trabalho. O front aplica o diff no store respeitando a ordem fracionária. A Unidade de Trabalho já calcula essa lista em `gravar()` (`upserts`/`removidos`) — hoje só devolve contagens; falta expô-la. Estado inteiro na resposta (~475 KB por clique) e re-hidratação após cada POST (duas idas e voltas) foram descartados pela latência medida (~234 ms por ida e volta).
- **D-04:** A carga inicial é `GET /estado` com o Espaço de Trabalho inteiro — decorre de D-DEC-01 (hidratar tudo) e não foi rediscutido.

### Otimismo na tela
- **D-05:** **Híbrido: recusa na hora, gravação espera.** `run()` roda a operação numa **cópia** do estado. Se o domínio recusar (`ok: false` — RN-CP-02, permissão, requisito de saída…), o erro aparece instantâneo e **nada vai ao servidor**. Se aceitar, a cópia é descartada, o `POST` é enviado, e o store só muda quando o diff voltar. Um caminho de estado só, sem id provisório, sem rollback. Otimismo total (aplicar local + reconciliar ids) e pessimismo puro foram descartados — o primeiro pelo custo de dois caminhos de estado com `nextId` sendo um contador e timestamps `new Date()`; o segundo por fazer até uma recusa de validação esperar a rede.
- **D-06:** Se o servidor informar que a revisão do cliente estava defasada (outra pessoa gravou no meio — a UoW já tenta 3 vezes e re-hidrata internamente), **o front nunca fica com estado que o servidor não tem**: re-hidrata por `GET /estado`. Como sinalizar isso na resposta fica com o planejador.

### O que entra no bootstrap
- **D-07:** **Só o Financeiro.** O bootstrap cria o Espaço de Trabalho com: Espaço "Gestão" › Pasta "Financeiro" › Listas "Contas a pagar" e "Contas a receber"; Tipo de Tarefa "Conta"; os Conjuntos de Status com requisitos de saída/entrada; as Definições de Campo (do Espaço, da Pasta e das Listas); as Tags `conta *` e as de cobrança; os Papéis do processo; o Agente de lançamento com a sua Coleção de Conhecimento; as Automações A1–A9 e R2–R7 — tudo conforme `docs/07-processos/contas-a-pagar.md` e `contas-a-receber.md` e como `seed-financeiro.ts` / `seed-contas-a-receber.ts` já montam. **Nada de CRM, IA ou outros Espaços**: cada área chega com a sua fase. **Zero Tarefas, Contatos, Negócios, Conversas ou Registros de Atividade fictícios.**
- **D-08:** **Só a Maryane** como Membro. Consequência da ontologia (B7 — exatamente um Proprietário, sempre Membro): com um Membro só, **a Maryane nasce Proprietária** do Espaço de Trabalho, além do Papel do processo (Financeiro). Marcos Paulo (Aprovador), Walter e os demais entram depois **por convite** (RN-ET-11 / PERS-09), não pelo bootstrap. Isso significa que, ao fim desta fase, o processo de Contas a pagar não fecha ponta a ponta sozinho (falta o Aprovador para `pago`) — é esperado e aceito; o critério da fase é "Membro real cria uma Conta pela tela e ela está no Postgres".
- **D-09:** A Maryane entra com o **e-mail de teste por enquanto** (`maryane@n1.teste`, conta já existente no Auth, senha de desenvolvimento). A troca pelo e-mail real é um update no Auth e no Membro, sem migrar nada — passo separado, fora desta fase.

### Claude's Discretion
- Porta, script de dev (`npm run dev` sobe web + api?), origens CORS, formato de erro HTTP (4xx vs `OperationResult` em 200), versionamento de rota.
- Formato exato do diff na resposta e da mensagem de "revisão defasada".
- Idempotência do bootstrap (re-executar atualiza configuração sem tocar em dados) e se ele lê de `seed-financeiro.ts` direto ou de um arquivo próprio.
- Quais colunas geradas e índices (PERS-07) — o critério de sucesso 3 do ROADMAP lista o que a Lista de Contas a pagar filtra: status, vencimento, Tag `conta *`, Responsável, Pessoa.
- O mecanismo de convite/reconvite (PERS-09), respeitando RN-ET-11.
- O que fazer com o seed em memória do `apps/web` depois que o store passa a hidratar da API (provavelmente: `buildProductSeed()` some do `store.ts` e fica só nos testes e no bootstrap).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisões já travadas (não rediscutir)
- `.planning/PROJECT.md` — bloco `<decisions>`: D-DEC-01..D-DEC-17. Em especial D-DEC-01 (hidratar tudo), D-DEC-02 (tabela genérica + colunas geradas), D-DEC-06 (revisão otimista por Espaço), D-DEC-08 (Supabase próprio), D-DEC-13 (`apps/api` dono do schema), D-DEC-14 (HTTP, nunca SQL direto).
- `docs/08-migracao-financeiro/04-spike-persistencia.md` — o ADR: como a persistência funciona e por quê; os quatro achados; números medidos.
- `.planning/intel/decisions.md`, `.planning/intel/constraints.md` — a síntese completa (CON-01..15 do plano; CON-CP-*; CON-CR-*).

### O plano e os processos
- `docs/08-migracao-financeiro/03-plano-de-migracao.md` §2 (arquitetura-alvo), §3 Fase 1 (entregáveis e "Pronto quando"), §7 (D6–D12 abertas).
- `docs/07-processos/contas-a-pagar.md` — §2 estrutura, §3 Status, §4 Campos, §5 Tags, §8 Automações A1–A9, §9 Agente, §10 permissões, §11 regras. É o que o bootstrap (D-07) materializa.
- `docs/07-processos/contas-a-receber.md` — §2–§4, §6, §8 R1–R7, §9 campos a acrescentar, §10, §11. Idem.
- `.planning/ROADMAP.md` — bloco "Phase 1" (critérios de sucesso 1–5).

### O código que esta fase estende
- `apps/api/src/persistencia/unidade-de-trabalho.ts` — `executar()`: hidratar → operação → revisão → `gravar()`. A rota por operação é uma casca em volta disto.
- `apps/api/src/persistencia/repositorio.ts` — `hidratar()`, `gravar()` (calcula `upserts`/`removidos` — a base do diff de D-03), `reordenar()`, `canonico()`, `semear()` (a base do bootstrap).
- `apps/api/src/persistencia/migrar.ts` + `apps/api/migracoes/001-plataforma.sql` — onde entra a migração `002` (colunas geradas, índices).
- `apps/api/src/persistencia/persistencia.test.ts` — o padrão de teste contra o banco (pula sem `DATABASE_URL`).
- `apps/web/src/dados/store.ts` — `StoreProvider`, `run()`, `useData`/`useSession`/`useRun`: a API pública **não muda**; a implementação de `run()` e a origem do estado mudam.
- `apps/web/src/dados/sessao-provider.tsx`, `apps/web/src/app/(shell)/layout.tsx` — onde a sessão é resolvida hoje pelo mapa do seed; passa a vir da API.
- `apps/web/src/autenticacao/` — `cliente-servidor.ts`, `sessao.ts`, `proxy.ts`: de onde sai o access token para D-02.
- `packages/dominio/src/operations/index.ts` — os 16 módulos que viram rotas; `packages/dominio/src/colecoes.ts` — as 45 coleções que o diff percorre; `packages/dominio/src/usuarios-do-seed.ts` — o UUID da Maryane.
- `packages/dominio/src/seed-financeiro.ts`, `seed-contas-a-receber.ts` — a configuração que o bootstrap materializa (sem as Tarefas fictícias).

### Convenções
- `CONTEXT.md` (raiz), `apps/api/CONTEXT.md`, `packages/dominio/CONTEXT.md` — regra de dependência e contratos por camada.
- `.planning/codebase/CONVENTIONS.md`, `TESTING.md`, `ARCHITECTURE.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `executar()` (UoW) já faz transação + revisão otimista + 3 tentativas: cada rota é `executar(workspaceId, (state) => operacao(state, memberId, entrada))`.
- `gravar()` já produz a lista exata de registros tocados — é o diff de D-03, só precisa ser devolvido em vez de contado.
- `semear()` já escreve um `DataState` inteiro num Espaço vazio — é o bootstrap de D-07, com um `DataState` construído só da configuração do Financeiro.
- `carregarEnv()` e `pool()` já resolvem `.env` e TLS.
- `USUARIOS_DO_SEED` + `emailDoSeed()` dão o UUID e o e-mail da Maryane.
- `@supabase/ssr` já está no web; `@supabase/supabase-js` no api.

### Established Patterns
- Operação = função pura `(state, actingMemberId, entrada) → OperationResult`; erro é valor em pt-BR, nunca exceção. A rota preserva isso: um `ok: false` do domínio não é 500.
- Um `CONTEXT.md` por pasta nova (`apps/api/src/rotas/`, `servicos/`, `repositorios/` já têm o contrato escrito).
- Testes de integração pulam sem `DATABASE_URL` (D-DEC-09).
- Identificadores em inglês, strings e comentários em pt-BR; comentários dizem **por quê**.

### Integration Points
- `apps/api/src/index.ts` — o ponto de composição, hoje `export {}`; vira o boot do Fastify.
- `apps/web/src/dados/store.ts` `run()` — de `operation(data, memberId)` local para: clone → operação → se ok, `POST` → aplicar diff.
- `apps/web/src/app/(shell)/layout.tsx` — de `USUARIOS_DO_SEED` para `GET /estado` (ou `/sessao`) com o token.
- `apps/api/migracoes/002-*.sql` — colunas geradas sobre `plataforma.registros` (D-DEC-02 já previu a forma: `add column status_id text generated always as (dados->>'statusId') stored`).

</code_context>

<specifics>
## Specific Ideas

- "Um Membro real cria uma Conta pela tela e, ao recarregar, ela continua lá" — o teste de aceitação que o usuário quer ver funcionando.
- A recusa do domínio tem que aparecer **na hora** — foi o motivo de escolher o híbrido em vez do pessimista.
- Latência importa: 234 ms por ida e volta foi o número que orientou D-03 e D-05.

</specifics>

<deferred>
## Deferred Ideas

- **Membros reais** (Maryane com e-mail real; Marcos Paulo, Walter e demais) — entram por convite quando houver e-mails; não é desta fase.
- **Onde o `apps/api` roda** (D11 / PERS-08) — bloqueado; precisa estar decidido antes de o adapter da Phase 2 apontar para ele. A VPS ao lado do `automation/` é o caminho natural.
- **Região do Supabase** (OQ-ADR-01) — barata agora, cara depois; decisão do dono, fora do código desta fase.
- **Otimismo total com reconciliação de ids** — descartado agora; pode voltar se o híbrido parecer lento demais na prática.
- **`submitForm` em nome do dono do Formulário** (A9 / OQ-PF-01) — questão de ontologia, afeta a Phase 2.

</deferred>

---

*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Context gathered: 2026-09-16*
