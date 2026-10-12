# Deferred Items — Fase 08 (Canais de comunicação)

Itens vistos no portão de 08-15 que NÃO são desta fase. As duas falhas
pré-existentes do portão (`src/e2e/lote-contas-a-pagar.test.ts` e
`src/rotas/formularios-publicos.test.ts`) seguem registradas em
`.planning/phases/07-crm-contatos-empresas-funis-e-negocios/deferred-items.md`
e não são repetidas aqui.

## Deferred Items

- `apps/api/src/persistencia/colunas-geradas.test.ts` — "due_date: coluna gerada ordena como dueDate.value" é instável por empate de vencimento
  status: open
  **What:** o teste compara `select id … order by due_date` com a ordenação em JS por `dueDate.value`. Quando três Tarefas de Contas a Pagar têm o mesmo vencimento, o Postgres devolve os empates em ordem não especificada e o `toEqual` falha (visto: `tsk_cp_aluguel_out` fora da posição, junto de `tsk_cp_condominio` e `tsk_cp_energia`). Falhou 1 vez no `npm run check` completo de 08-15 e passou 8/8 re-executado isolado.
  **Where:** `apps/api/src/persistencia/colunas-geradas.test.ts:111-116`. Último commit no arquivo: `0c1a26b` (Plan 01-06).
  **Why deferred:** o arquivo e a migração 002 não foram tocados pela Fase 8 e o teste não lê `plataforma.canais`. Correção sugerida: `order by due_date, id` na consulta e o mesmo desempate (`|| a.id.localeCompare(b.id)`) no sort do JS.
