# Requisitos — intel sintetizada

Gerado por `/gsd-ingest-docs` (sintetizador) em 2026-09-15.

**Aviso de proveniência.** O manifesto não contém nenhum PRD (o `PRD-FRONTEND-NAVEGAVEL.md` ficou de fora de propósito: descreve o protótipo em memória, e a migração o supera). Os requisitos abaixo são **derivados dos entregáveis por fase do SPEC `03-plano-de-migracao.md`**, com os critérios de aceite vindos do próprio plano e dos SPECs de processo (`constraints.md`). Onde não há acceptance criteria escritos, a entrada diz "aceite: não especificado" — o roadmapper não deve inventar.

**Status verificado contra o código em 2026-09-15** (não contra o que os documentos dizem): `feito` · `em andamento` · `pendente` · `sobreposto` (substituído por decisão travada) · `bloqueado por decisão` (depende de questão aberta).

Formato: `REQ-{fase}-{slug}` · source · descrição · aceite · escopo · status · evidência.

---

## Fase 0 — Preparação (1 semana)

### REQ-f0-schema-plataforma
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 0
- descrição: Schema `plataforma` criado, vazio, sem tocar nas 26 tabelas do `public`.
- aceite: schema existe; `npm run migrar` aplica `001-plataforma.sql`.
- escopo: banco da plataforma
- status: **feito** — no projeto Supabase próprio `epomplsskqpluxuujpxl` (DEC-08), não no `qewznpnmaqhqfyhncdnx` como o plano dizia. Evidência: `apps/api/migracoes/001-plataforma.sql`; commit `b20597d`.

### REQ-f0-exportacao-clickup
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 0
- descrição: Exportação completa das Listas `901109104938` (Solicitação), `901107637383` (Contas a pagar), `901107648977` (Contas a receber): Tarefas, Campos, Comentários, histórico de status, anexos, com paginação.
- aceite: "É o insumo da importação e a prova de paridade depois" (CON-09).
- escopo: ClickUp (leitura)
- status: **pendente** — nenhum artefato de exportação no repositório.

### REQ-f0-spec-solicitacao-de-pagamento
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 0, §5; `docs/08-migracao-financeiro/00-LEIA-PRIMEIRO.md` §O que ainda está em aberto
- descrição: Escrever `docs/07-processos/solicitacao-de-pagamento.md` lendo a Lista real (`901109104938`), no padrão de `contas-a-pagar.md`. "**A lacuna mais séria do levantamento.** ... Reconstruí o processo pelo código, que mostra o que está automatizado, não o que as pessoas fazem." "**É o maior risco do plano** e a primeira tarefa da Fase 0."
- aceite: spec com Status, Campos, papéis, fluxo, automações, permissões e regras, lida da Lista real — e que responda D6 e D8 (ou os deixe explicitamente abertos).
- escopo: documentação de processo; pré-requisito da Fase 2
- status: **pendente** — `docs/07-processos/solicitacao-de-pagamento.md` não existe (verificado). O plano cita o arquivo como se existisse (cross_ref); é uma referência a algo a escrever.

### REQ-f0-de-para-usuarios-clickup
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 0
- descrição: De-para dos 6 IDs de usuário do ClickUp → Membros (CON-11). O inventário amplia: 38 variáveis `CLICKUP_*` com IDs de aprovadores, revisores e "Financeiro".
- aceite: não especificado além da tabela.
- escopo: Fase 0 → usado na importação (Fases 2/3)
- status: **pendente**.

### REQ-f0-rotacao-credenciais-omie
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 0, §5; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §9
- descrição: Rotacionar as credenciais Omie do Marcos Paulo (hardcoded em `tenants/marcos-paulo/config.ts`, no histórico do git). Nas telas novas, credencial só na Integração (CON-10).
- aceite: não especificado.
- escopo: `financeiro-tria` + Omie (fora deste repositório)
- status: **pendente** — não verificável a partir de `crm-n1`.

### REQ-f0-contagem-linhas-legado
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 0 (riscado), §5; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §5.7
- descrição: Medir volume das tabelas legadas.
- status: **feito** (2026-09-15) — maior tabela 9.510 linhas; `solicitacoes_pagamentos` 1.110; risco "volume desconhecido" fechado. Subproduto: CAND-03.

---

## Fase 1 — O CRM N1 ganha persistência e login (3–4 semanas)

Critério de pronto da fase (CON-12, refinado por DEC-09): um Membro real cria uma Conta pela tela, ela está no Postgres, `npm run check` verde nos três workspaces; a prova hidratado ≡ seed vale pelos 214 testes contra o banco. ClickUp e `automation/` intocados.

### REQ-f1-persistencia-unidade-de-trabalho
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 1, §4; `docs/08-migracao-financeiro/04-spike-persistencia.md`
- descrição: Repositórios + Unidade de Trabalho: carrega o `DataState` do Espaço de Trabalho, roda a operação pura sem alterá-la, grava o diff com revisão otimista. Preserva `packages/dominio` e os 214 testes.
- aceite: os quatro testes de `persistencia.test.ts` (estado hidratado `toStrictEqual` ao seed; operação grava só o que tocou; recusa grava nada; estado 10×), rodando contra Postgres local e contra o Supabase.
- escopo: `apps/api/src/persistencia/` (`conexao.ts`, `migrar.ts`, `repositorio.ts`, `unidade-de-trabalho.ts`), `packages/dominio/src/colecoes.ts`
- status: **feito** — DEC-01..DEC-07, DEC-09, DEC-10. Evidência: commits `9fb2754`, `3fd7e1b`, `b20597d`; arquivos presentes.

### REQ-f1-tabelas-schema-plataforma
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 1
- descrição (original): uma tabela por entidade que o Financeiro toca, colunas tipadas para o que se filtra, `jsonb` para objetos de valor.
- status: **sobreposto** por DEC-02 (ADR > SPEC): tabela genérica `plataforma.registros` + `plataforma.workspaces`; colunas geradas para o que se filtra entram em REQ-f1-colunas-geradas-indices. Ver `INGEST-CONFLICTS.md` INFO-02.

### REQ-f1-supabase-auth
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 1; `docs/08-migracao-financeiro/04-spike-persistencia.md` §O que vem agora item 1; `docs/PENDENCIAS-FRONTEND.md` A2
- descrição: `/entrar` deixa de escolher Membro e passa a autenticar (Supabase Auth, e-mail e senha); Membro resolvido pelo Usuário (`Member.userId === usuario.id`, A1.4), nunca escolhido; "Trocar de Membro" vira "Sair"; sem Membro, ou Membro `removido`/`pendente`, vê "Sem acesso" (RN-ET-08 / A6.4).
- aceite (do commit `d713253`, verificado contra o dev server): redirecionamento sem sessão; rota pública aberta; Membro vendo a própria conta no HTML do servidor; Membro removido barrado; senha errada recusada; `/sair` apaga a sessão.
- escopo: `apps/web/src/autenticacao/` (`cliente-navegador.ts`, `cliente-servidor.ts`, `sessao.ts`), `apps/web/src/proxy.ts`, `apps/web/src/app/entrar/`, `apps/web/src/app/sair/`, `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` (`npm run usuarios:seed`)
- status: **feito** — commit `d713253`; A2 fechado em `PENDENCIAS-FRONTEND.md`. Subproduto: store zustand por árvore via `StoreProvider` (bug de singleton no SSR corrigido); rotas públicas ganharam `(publico)` com `PublicoProvider` — abriu A9 (OQ-PF-01).
- nota: o plano dizia "Membro resolvido pelo Espaço de Trabalho"; a implementação resolve por `Member.userId` dentro do Espaço de Trabalho da sessão. Não conflita; é mais preciso.

### REQ-f1-rotas-por-operacao
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 1, §4; `docs/08-migracao-financeiro/04-spike-persistencia.md` §O que vem agora item 2
- descrição: `apps/api` servindo o domínio — uma rota HTTP por operação dos 16 módulos de `packages/dominio/src/operations`, `POST /operacoes/:nome` (CON-02), cada rota executando a operação dentro da Unidade de Trabalho (hidratar → operação → diff → revisão).
- aceite: não especificado além de CON-02 e do critério da fase. Regra fixa: a rota não reimplementa regra de negócio (`apps/api/src/index.ts`).
- escopo: `apps/api/src/rotas/`, `apps/api/src/servicos/`, `apps/api/src/index.ts`; escolha da camada HTTP (registrada como pendente em `apps/api/src/rotas/CONTEXT.md` / `apps/api/package.json`: "A camada HTTP ainda não foi escolhida")
- status: **pendente** — `rotas/` "nasce vazia"; `index.ts` exporta `{}`; nenhuma dependência HTTP em `apps/api/package.json`. Risco: baixo, "mecânico, 16 módulos" (CON-14). Depende de D11 só para o deploy, não para o código.

### REQ-f1-store-post
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 1; `docs/08-migracao-financeiro/04-spike-persistencia.md` §O que vem agora item 2
- descrição: `apps/web/src/dados/store.ts` troca `run(op)` local (sobre `buildProductSeed()`) por `POST /operacoes/:nome` e passa a hidratar o `DataState` do backend em vez do seed.
- aceite: a API pública do store (`useData`, `useSession`, `useRun`…) não muda — "os cem arquivos que a consomem não sabem de onde o store vem" (comentário do próprio `store.ts`).
- escopo: `apps/web/src/dados/store.ts`, `StoreProvider`
- status: **pendente** — `store.ts` ainda cria `data: buildProductSeed()` e aplica a operação em memória (verificado).

### REQ-f1-bootstrap-espaco-gestao
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 1; `docs/08-migracao-financeiro/04-spike-persistencia.md` §O que vem agora item 3
- descrição: `seed-financeiro.ts` vira script de criação do Espaço "Gestão" › Pasta "Financeiro" › Listas, Campos, Status, Tags, Papéis — **sem as Tarefas fictícias**. (Contas a pagar conforme CON-CP-01..04, CON-CP-09; Contas a receber conforme CON-CR-01..03, CON-CR-05, CON-CR-07, CON-CR-08.)
- aceite: não especificado além do critério da fase ("um Membro real cria uma Conta pela tela, ela está no Postgres").
- escopo: `apps/api` (script), `packages/dominio` (`seed-financeiro.ts`, `seed-contas-a-receber.ts`)
- status: **pendente**.

### REQ-f1-colunas-geradas-indices
- source: `docs/08-migracao-financeiro/04-spike-persistencia.md` §O que ficou de pé, §O que vem agora item 4
- descrição: Colunas geradas (`generated always as (dados->>'…') stored`) e índices em `plataforma.registros` para o que a tela de Contas a pagar filtra (Tarefa primeiro: status, Lista, vencimento, Tag `conta *`, Responsável, Pessoa).
- aceite: não especificado (ADR dá o padrão SQL, não a lista de colunas).
- escopo: migração `002-*.sql` em `apps/api/migracoes/`
- status: **pendente**. Substitui a parte "colunas tipadas para o que se filtra" de REQ-f1-tabelas-schema-plataforma.

### REQ-f1-deploy-apps-api
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §2 (tabela: "Deploy — a definir na Fase 1"), §7 D11
- descrição: Definir e executar onde `apps/api` roda. Recomendação do plano: a mesma VPS do `automation/`, na nginx existente. O ADR observa que a latência medida (~234 ms/ida e volta) é de um notebook no Brasil ao Oregon; "o `apps/api` não vai rodar num notebook".
- aceite: não especificado.
- escopo: infraestrutura
- status: **bloqueado por decisão** (D11; interage com OQ-ADR-01, região do Supabase).

### REQ-f1-reconvite-por-usuario (derivado de DOC — prioridade a confirmar)
- source: `docs/PENDENCIAS-FRONTEND.md` P2
- descrição: RN-ET-11 — reconvidar um Usuário removido reativa o mesmo Membro. Hoje `inviteMember` só casa por `invitedIdentity`, que some quando o Membro aceita (B27), quebrando INV-ET-04 num reconvite. "Fecha quando existir um diretório de Usuário — ou seja, quando existir backend."
- aceite: não especificado.
- escopo: `packages/dominio/src/operations/members.ts`, identidade de Usuário (Supabase Auth)
- status: **pendente** — pré-condição (Usuário real) agora existe (REQ-f1-supabase-auth). Não está no plano; entrou por ser dívida declarada que a Fase 1 destrava.

---

## Fase 2 — Solicitação de pagamento: o front substitui o ClickUp (3–4 semanas)

Pré-requisito: REQ-f0-spec-solicitacao-de-pagamento. Critério de pronto: CON-12 Fase 2. Decisões abertas que a moldam: D6 (Lista própria × status na Lista de Contas), D8 (clique × classificador), D9 (status `aprovado`).

### REQ-f2-lista-solicitacoes
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2
- descrição: Lista "Solicitações de pagamento" na ontologia, com os Status de CON-04 e os Campos que o mapper já lê (`01-inventario` §4.3).
- aceite: CON-04.
- status: **pendente**; **bloqueado por decisão** D6 (Lista própria — recomendação — ou Status iniciais na Lista de Contas).

### REQ-f2-formulario-solicitacao
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2
- descrição: Formulário de solicitação — substitui o formulário de Tarefa do ClickUp; "é por onde o pedido entra".
- aceite: não especificado (depende da spec da Solicitação).
- status: **pendente**. Nota: o protótipo já tem rotas públicas de Formulário (`/f/<segredo>`) e a questão A9 (em nome de quem age uma resposta anônima) afeta diretamente este item.

### REQ-f2-tela-aprovacao
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2
- descrição: Tela de aprovação — "A decisão vira Solicitação de Aprovação (B80): um clique, não um texto classificado por IA." Substitui responder no thread do comentário.
- aceite: não especificado; regra de roteamento do aprovador (`APPROVAL_ROUTES` por centro de custo e valor — `01-inventario` §3 etapa 2) precisa existir na plataforma ("**Falta na plataforma** — quatro Membros e uma regra de roteamento", `02-comparativo` §3.3).
- status: **pendente**.

### REQ-f2-timeline-solicitacao
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2
- descrição: Timeline da solicitação: Comentários + Registros de Atividade — substitui a aba de comentários do ClickUp.
- aceite: não especificado.
- status: **pendente**.

### REQ-f2-adapter-plataforma
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2, §2.1; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §10
- descrição: `adapters/plataforma.ts` no `automation/`: os 7 métodos (CON-01) contra `apps/api` por HTTP (DEC-14); degrada enfileirando (CON-06); `clickup.ts` fica, desligado por env.
- aceite: CON-12 Fase 2 (pipeline sem webhook do ClickUp; Omie recebe o mesmo `IncluirContaPagar`).
- escopo: repositório `financeiro-tria` (fora deste repo)
- status: **pendente**. Risco baixo, tamanho P.

### REQ-f2-mapper-plataforma
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2, §2.2
- descrição: `plataforma-payment-mapper.ts` substitui ~400 linhas de parsing do ClickUp por ~50 de leitura tipada de `fieldValues`. "**A troca apaga código, não acrescenta.**" (×3 tenants: não portar três vezes — `01-inventario` §9.)
- aceite: não especificado.
- escopo: `financeiro-tria`
- status: **pendente**.

### REQ-f2-endpoint-solicitacao-criada
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2
- descrição: `POST /webhooks/plataforma/solicitacao-criada` (CON-03), disparado pelo `apps/api` quando a Tarefa nasce — nova entrada do pipeline.
- aceite: não especificado.
- escopo: `apps/api` (disparo) + `automation/` (recepção)
- status: **pendente**. Requer no `apps/api` um mecanismo de evento/webhook de saída — hoje inexistente.

### REQ-f2-classificador-fallback
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2, §7 D8
- descrição: Classificador de comentário como fallback por 90 dias: "Quem responder por comentário em vez de clicar continua atendido".
- status: **pendente**; **bloqueado por decisão** D8 (recomendação: as duas).

### REQ-f2-importacao-solicitacoes
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 2, §2.3
- descrição: Importar `solicitacoes_pagamentos` (1.110 linhas): histórico vira Tarefas fechadas; `comentario` vira o Comentário do RESUMO; credenciais descartadas; `TaskID` + `origem` (CON-08, DEC-17).
- aceite: não especificado.
- status: **pendente**.

---

## Fase 3 — Contas a pagar (2 semanas)

"A parte mais barata, porque a tela **já existe**." Critério de pronto: CON-12 Fase 3.

### REQ-f3-importacao-contas-a-pagar
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 3; `docs/07-processos/contas-a-pagar.md` §12
- descrição: Importar a Lista `901107637383` com `date_created`, `date_closed` e histórico de status (CON-09, CON-CP-12); campo `L` copiado para a Data de vencimento nativa (CAND-02); de-para de usuários (REQ-f0-de-para-usuarios-clickup).
- aceite: "tempo em `para pagar`" preservado como métrica (29–31 dias é o ciclo normal).
- status: **pendente**.

### REQ-f3-automacoes-a1-a9
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 3; `docs/07-processos/contas-a-pagar.md` §8
- descrição: A1–A9 rodando no Motor de Automações (CON-CP-06): recorrência ao pagar com dia útil anterior (A1, CON-CP-05), troca de Responsável (A3/A4), cobrança de nota D-5/D-2 (A5/A6), invocação do Agente D-1 (A7/A8), Observadores (A9).
- aceite: CON-CP-06; RN-CP-04..06.
- status: **em andamento** — existem como dados da ontologia no seed em memória (`02-comparativo` §1: "Automações; Regra de Recorrência"); falta o motor que as execute (REQ-x-motor-automacoes).

### REQ-f3-agente-lancamento-omie-real
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 3; `docs/07-processos/contas-a-pagar.md` §9
- descrição: `runLancamentoAgent` deixa de simular; a Ferramenta chama o `automation/`, "que já sabe lançar" (`IncluirContaPagar`, `IncluirAnexo`, idempotência CON-07). Conhecimento do Agente extraído para uma Coleção de Conhecimento (OQ-CP-04). Autonomia: Ensaio na primeira semana, Política de aprovação depois (decisão de produto).
- aceite: CON-CP-07, CON-CP-08, INV-CP-01.
- status: **em andamento** — `runLancamentoAgent` existe com Omie **simulado** (`02-comparativo` §1, §3.3).

### REQ-f3-de-para-categorias-real
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 3, §5; `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` §3.4
- descrição: Substituir `CATEGORIA_OMIE` (24 categorias com **códigos inventados**) e `CNPJ_POR_EMPRESA` (fictício) pelo plano real (`ListarCategorias`) ou pelo RAG do `automation/` (`conciliador_contas`, 276 linhas), com validação contra o plano real e `REVISAR` abaixo do threshold. `CONTA_POR_TAG` (8 tags) + fallback por centro: parcial, concorda nos casos observados. Departamento Omie: falta.
- aceite: não especificado.
- status: **pendente**; depende de OQ-CP-04 (de-para não está em lugar que a API alcance).

### REQ-f3-pagamento-em-lote
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 3; `docs/07-processos/contas-a-pagar.md` §6.5
- descrição: Seleção múltipla + mudança de Status em lote na Lista (CON-CP-11).
- aceite: 61 fechamentos num segundo; cada um dispara A1.
- status: **em andamento** — `contas-view.tsx` tem "ações em lote" (`02-comparativo` §1); falta a versão persistida (DEC-06: escritas serializadas por Espaço — medir).

### REQ-f3-permissao-pessoa-da-conta
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §5; `docs/07-processos/contas-a-pagar.md` §10
- descrição: Aplicar CON-CP-09 — a Pessoa da conta vê só as Tarefas em que é o valor do campo Pessoa; demais Membros sem acesso. Hoje "A Pessoa da conta vê chave Pix de todos".
- aceite: CON-CP-09.
- status: **em andamento** — modelado no protótipo (`02-comparativo` §3.3: "Campo `Pessoa` + Convidado com `ver` só as suas"); a garantia real depende de o backend aplicar permissão (REQ-f1-rotas-por-operacao).

---

## Fase 4 — As outras telas do financeiro-tria (2–3 semanas)

Critério de pronto: `financeiro-tria.vercel.app` pode sair do ar. Regra: DEC-16 — portadas como tela, lendo a API do `automation/` direto; "Nenhuma regra muda — é releitura visual no sistema de design do CRM N1". Ponto de revisão da divisão antes da Fase 2.

### REQ-f4-telas-portadas
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 4, §2.4; `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §7
- descrição: Notas fiscais (`transacoes`), Produtos (`produtos_cadastrados_emissao_notas`), Plano de contas (CRUD + import; tabela hoje **vazia**), Extratos do Marcos (upload), Workflows (catálogo + runs), Dashboard, Problemas, Aprovações pendentes. "O que a UI do financeiro-tria informa é **quais leituras** o Financeiro precisa."
- aceite: CON-12 Fase 4.
- status: **pendente**. Pré-requisito implícito: o `automation/` hoje é lido com `anon_read` e sem autenticação (`01-inventario` §1) — a plataforma precisa de um caminho autenticado para essas leituras (não especificado no plano).

---

## Fase 5 — Contas a receber e os outros tenants (2–3 semanas)

### REQ-f5-contas-a-receber
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 5; `docs/07-processos/contas-a-receber.md`
- descrição: "Depende de **D7**: onde o recebimento é controlado hoje? ... Se migrou para o Omie, a Lista da plataforma vira espelho de leitura; se não, `createReceivableSeries` já existe e R2–R7 viram Automações." Restrições CON-CR-01..10.
- aceite: não especificado (o próprio SPEC de processo condiciona tudo a OQ-CR-01).
- status: **bloqueado por decisão** D7. Protótipo em memória existe com as leituras de CAND-05.

### REQ-f5-tenants-marcos-paulo-family-office
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` Fase 5; `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` §3.6
- descrição: As Empresas viram opções do Campo `Empresa`; as regras de cada `config.ts` viram configuração por Empresa — sem clonar serviço. Uma Integração Omie por Empresa (CAND-01, a confirmar).
- aceite: não especificado.
- status: **pendente**.

---

## Transversal (não é de uma fase; o plano marca como peça G de risco alto)

### REQ-x-motor-automacoes
- source: `docs/08-migracao-financeiro/03-plano-de-migracao.md` §4 ("Motor de Automações (evento + agenda) — G — alto — infraestrutura genérica; o Financeiro é o primeiro cliente"), Fase 3
- descrição: Motor que executa `Automation` da ontologia — gatilhos por evento (`AutomationTrigger.kind: evento`) e por agenda (`schedule`), ações `invocarAgente`, `solicitarAprovacao`, `aguardar`, `notificar` (tipos já existem em `packages/dominio/src/types/`). Necessário para A1–A9 (Fase 3), R2–R7 (Fase 5) e para o gatilho "tempo em Status" que C34 pede.
- aceite: não especificado. Observação do ADR sobre `apps/api`: cron interno do `automation/` "sem fila, sem retry persistente: se o processo cair no minuto errado, o dia é pulado" (`01-inventario` §8) — antipadrão a não repetir.
- status: **pendente** — não há nenhum código de execução de Automação em `apps/api`.

### REQ-x-notificar-por-canal
- source: `docs/08-migracao-financeiro/02-comparativo-com-a-plataforma.md` §3.2 (linha `Whatsapp do Solicitante`)
- descrição: Ação de notificar por Canal (WhatsApp via Evolution API) — "A plataforma tem o campo (Z); falta a Ação de notificar por Canal". Derivado de DOC; prioridade a confirmar.
- status: **pendente**.

---

## Índice de status

- feito: REQ-f0-schema-plataforma, REQ-f0-contagem-linhas-legado, REQ-f1-persistencia-unidade-de-trabalho, REQ-f1-supabase-auth
- sobreposto: REQ-f1-tabelas-schema-plataforma
- em andamento: REQ-f3-automacoes-a1-a9, REQ-f3-agente-lancamento-omie-real, REQ-f3-pagamento-em-lote, REQ-f3-permissao-pessoa-da-conta
- bloqueado por decisão: REQ-f1-deploy-apps-api (D11), REQ-f2-lista-solicitacoes (D6), REQ-f2-classificador-fallback (D8), REQ-f5-contas-a-receber (D7)
- pendente: todos os demais (REQ-f0-exportacao-clickup, REQ-f0-spec-solicitacao-de-pagamento, REQ-f0-de-para-usuarios-clickup, REQ-f0-rotacao-credenciais-omie, REQ-f1-rotas-por-operacao, REQ-f1-store-post, REQ-f1-bootstrap-espaco-gestao, REQ-f1-colunas-geradas-indices, REQ-f1-reconvite-por-usuario, REQ-f2-formulario-solicitacao, REQ-f2-tela-aprovacao, REQ-f2-timeline-solicitacao, REQ-f2-adapter-plataforma, REQ-f2-mapper-plataforma, REQ-f2-endpoint-solicitacao-criada, REQ-f2-importacao-solicitacoes, REQ-f3-importacao-contas-a-pagar, REQ-f3-de-para-categorias-real, REQ-f4-telas-portadas, REQ-f5-tenants-marcos-paulo-family-office, REQ-x-motor-automacoes, REQ-x-notificar-por-canal)

Total: 35 requisitos (4 feitos · 1 sobreposto · 4 em andamento · 4 bloqueados por decisão · 22 pendentes).
