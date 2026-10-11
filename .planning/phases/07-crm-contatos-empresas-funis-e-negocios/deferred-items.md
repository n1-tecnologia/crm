# Deferred Items — Fase 07 (CRM)

Falhas encontradas no portão `npm run check` que NÃO são desta fase: nenhum
arquivo delas foi tocado em 07-01..07-12 e as duas foram reproduzidas
isoladamente no checkout principal (HEAD `8e910a5`, `DATABASE_URL` do
`apps/api/.env`, o Supabase da plataforma) antes de serem registradas aqui.
Tudo o mais do portão está verde: tipos (3 workspaces), lint (0 erros, 3
avisos pré-existentes), tokens, contratos, `@n1/web` 507/507, `@n1/dominio`
1667/1667 e, em `@n1/api`, 1149 testes verdes — inclusive todos os do CRM
(que, contra o banco remoto, pulam por desenho e foram provados contra o
container local: 159/159 sem nenhum pulado).

## Deferred Items

- `apps/api/src/e2e/lote-contas-a-pagar.test.ts` falha contra o banco remoto (5 de 6)
  status: open
  **What:** os cinco casos do cenário "PAG-05, critério 5: 61 contas fecham num só gesto — uma transação, revisão +1, tempo de lock medido contra DEC-06" falham nas asserções de tempo de lock/semeadura contra o Supabase da plataforma: (a) "uma transação por gesto — 200, alteradas:61, ocorrenciasCriadas:61, revisão avança exatamente 1"; (b) "o que foi para o banco é o que o relatório diz — 61 ocorrências novas, as 61 origens em pago sem recorrência"; (c) "reexecução no-op — alteradas:0, jaEstavam:61, contagem de Tarefas idêntica, revisão avança 1 e só 1"; (d) "o piso e o teto do lock (DEC-06) — tLote custa uma hidratação, tN custa 61"; (e) "falha parcial atravessa o HTTP como valor — 200 (não 4xx), as 4 boas ficam no banco". O sexto caso passa.
  **Where:** `semear` em `lote-contas-a-pagar.test.ts:150` e as asserções em `:186`, `:214`, `:235`, `:254`, `:306`.
  **Why deferred:** é o e2e do Financeiro (Fase 3, Plan 03-12), já registrado em `STATE.md` como falha conhecida contra o banco remoto; nada do CRM o toca. Fica para quem revisitar DEC-06 com o volume real (03-12 Task 4).

- `apps/api/src/rotas/formularios-publicos.test.ts` — a suíte "rotasDeFormulariosPublicos — Automação de Canal publicada na Lista de Solicitações (CR-05/05-17)" falha no seed
  status: open
  **What:** o `beforeAll` lança `seed de teste: A pergunta "Centro de Custo (Financeiro)" aponta para um Campo que esta Lista não tem.` em `montarFormularioDeSolicitacao` (`formularios-publicos.test.ts:550`, chamado em `:567`); os 11 casos restantes do arquivo passam e 2 pulam. Reproduzido isolado com `npx vitest run src/rotas/formularios-publicos.test.ts` contra o `.env`.
  **Where:** `apps/api/src/rotas/formularios-publicos.test.ts:550-567` (último commit no arquivo: `06ec0fe`, Plan 05-17).
  **Why deferred:** a suíte monta o Formulário de Solicitação sobre a configuração da Lista que o Espaço de teste carrega do banco da plataforma; o Campo "Centro de Custo (Financeiro)" que a pergunta referencia não está nessa Lista. É configuração do Financeiro (Fases 2/5), fora do CRM e fora dos arquivos desta fase. Precisa de quem conheça o bootstrap da Lista de Solicitações (`solicitacoes:configurar`) para decidir se o seed do teste ou a configuração do Espaço é que está desatualizada.
