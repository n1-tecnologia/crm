# repositorios

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

A persistência. Uma interface por agregado, e a implementação atrás dela — trocar de banco deve ser trocar de implementação, não de serviço.

## O padrão (inaugurado em `crm/`, Fase 7)

- **Uma interface por agregado** (`RepositorioDeContatos`) e a implementação `pg` atrás dela: `criarRepositorioDe…Pg(cliente: Pool | PoolClient)`. O mesmo repositório serve fora de transação (o `Pool`) e dentro dela (o `PoolClient`).
- **Quem abre a transação é o serviço**, com `comTransacao` (`../servicos/crm/transacao.ts`); ele passa o `PoolClient` aos repositórios. O repositório nunca faz `begin`/`commit`.
- **`workspace_id = $1` em todo `WHERE`** — o Espaço vem do serviço, que o tira da sessão; nada aqui o deduz de outro lugar (T-07-01). Valores sempre `$n`, nunca interpolados; a ordenação é fixa.
- **Datas `::text`** (`date` sai como texto, nunca `types.setTypeParser` global), **`numeric` como texto** (não perde precisão) e **`count(*)::int`**.
- **Testes contra o Postgres local**, por `../testes/banco-crm.ts` (`describeComBanco`, `semearMembro`, `limparEspaco`): nunca contra o banco remoto do `.env`.
